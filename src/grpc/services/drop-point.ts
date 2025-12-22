/**
 * Drop Point gRPC Handlers (Story 3.4)
 * 
 * SITUATION: Gateway needs to call Logistics service for drop point operations
 * TASK: Expose drop point assignment via gRPC
 * ACTION: Handle gRPC calls, delegate to service, map responses
 * RESULT: Type-safe gRPC API for drop point operations
 * 
 * @module droppoint-grpc-handlers
 */

import * as grpc from '@grpc/grpc-js';
import { Logger } from 'pino';
import {
    dropPointAssignmentService,
    DropPointAssignmentResult,
} from '../../services/drop-point-assignment-service';

// Type for gRPC service handlers (generated types not available until proto compile)
type DropPointServiceHandlers = Record<string, (call: any, callback: any) => void>;

// ============================================================================
// Response Mappers
// ============================================================================

function mapAssignmentToResponse(result: DropPointAssignmentResult): any {
    return {
        assignmentId: String(result.assignment.id),
        listingId: result.assignment.listingId,
        dropPoint: {
            id: result.dropPoint.id,
            name: result.dropPoint.name,
            address: result.dropPoint.address,
            location: {
                latitude: result.dropPoint.location.latitude,
                longitude: result.dropPoint.location.longitude,
            },
            distanceKm: result.dropPoint.distanceKm,
            isOpen: true, // TODO: Calculate from operating hours
        },
        pickupWindow: {
            start: result.pickupWindow.start.toISOString(),
            end: result.pickupWindow.end.toISOString(),
        },
        cratesNeeded: result.cratesNeeded,
        status: result.assignment.status,
        listingStatus: 'ASSIGNED',
    };
}

// ============================================================================
// gRPC Handlers
// ============================================================================

export const dropPointServiceHandlers = (logger: Logger): DropPointServiceHandlers => ({

    /**
     * AssignDropPoint - Assign optimal drop point to listing (AC1-2)
     */
    AssignDropPoint: async (call, callback) => {
        try {
            const { listingId, farmerId, farmerLocation, cropType, quantityKg, preferredDate } = call.request;

            logger.info({ listingId, farmerId }, 'AssignDropPoint gRPC called');

            if (!farmerLocation) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Farmer location is required',
                });
            }

            const result = await dropPointAssignmentService.assignDropPoint({
                listingId,
                farmerId,
                farmerLocation: {
                    latitude: farmerLocation.latitude,
                    longitude: farmerLocation.longitude,
                },
                cropType,
                quantityKg,
                preferredDate: preferredDate ? new Date(preferredDate) : undefined,
            });

            logger.info(
                { listingId, dropPointId: result.dropPoint.id },
                'Drop point assigned via gRPC'
            );

            callback(null, mapAssignmentToResponse(result));
        } catch (error: any) {
            logger.error({ error: error.message }, 'AssignDropPoint failed');

            if (error.code === 'NO_DROP_POINTS') {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: error.message,
                });
            }

            callback({
                code: grpc.status.INTERNAL,
                message: error.message || 'Failed to assign drop point',
            });
        }
    },

    /**
     * GetDropPointAssignment - Get existing assignment for a listing
     */
    GetDropPointAssignment: async (call, callback) => {
        try {
            const { listingId } = call.request;

            logger.info({ listingId }, 'GetDropPointAssignment gRPC called');

            const result = await dropPointAssignmentService.getAssignment(listingId);

            if (!result) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: `No assignment found for listing ${listingId}`,
                });
            }

            callback(null, mapAssignmentToResponse(result));
        } catch (error: any) {
            logger.error({ error: error.message }, 'GetDropPointAssignment failed');
            callback({
                code: grpc.status.INTERNAL,
                message: error.message || 'Failed to get assignment',
            });
        }
    },

    /**
     * GetNearbyDropPoints - Get drop points near a location (AC3)
     */
    GetNearbyDropPoints: async (call, callback) => {
        try {
            const { location, radiusKm } = call.request;

            logger.info({ location, radiusKm }, 'GetNearbyDropPoints gRPC called');

            if (!location) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Location is required',
                });
            }

            const dropPoints = await dropPointAssignmentService.getNearbyDropPoints(
                { latitude: location.latitude, longitude: location.longitude },
                radiusKm || 20
            );

            callback(null, {
                dropPoints: dropPoints.map((dp) => ({
                    id: dp.id,
                    name: dp.name,
                    address: dp.address,
                    location: dp.location,
                    distanceKm: dp.distanceKm,
                    isOpen: dp.isOpen,
                })),
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'GetNearbyDropPoints failed');
            callback({
                code: grpc.status.INTERNAL,
                message: error.message || 'Failed to get nearby drop points',
            });
        }
    },

    /**
     * ReassignDropPoint - Reassign to different drop point (AC6)
     */
    ReassignDropPoint: async (call, callback) => {
        try {
            const { listingId, newDropPointId, changeReason } = call.request;

            logger.info({ listingId, newDropPointId }, 'ReassignDropPoint gRPC called');

            const result = await dropPointAssignmentService.reassignDropPoint(
                listingId,
                newDropPointId,
                changeReason
            );

            callback(null, mapAssignmentToResponse(result));
        } catch (error: any) {
            logger.error({ error: error.message }, 'ReassignDropPoint failed');

            if (error.code === 'NOT_FOUND' || error.code === 'DROP_POINT_NOT_FOUND') {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: error.message,
                });
            }

            callback({
                code: grpc.status.INTERNAL,
                message: error.message || 'Failed to reassign drop point',
            });
        }
    },

    /**
     * GetUpcomingDeliveries - Get farmer's upcoming deliveries (AC5)
     */
    GetUpcomingDeliveries: async (call, callback) => {
        try {
            const { farmerId } = call.request;

            logger.info({ farmerId }, 'GetUpcomingDeliveries gRPC called');

            const deliveries = await dropPointAssignmentService.getUpcomingDeliveries(farmerId);

            callback(null, {
                deliveries: deliveries.map(mapAssignmentToResponse),
            });
        } catch (error: any) {
            logger.error({ error: error.message }, 'GetUpcomingDeliveries failed');
            callback({
                code: grpc.status.INTERNAL,
                message: error.message || 'Failed to get upcoming deliveries',
            });
        }
    },
});
