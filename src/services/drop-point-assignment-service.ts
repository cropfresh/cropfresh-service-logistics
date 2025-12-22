/**
 * Drop Point Assignment Service - Business Logic (Tasks 1.4-1.6)
 * 
 * SITUATION: Farmers need optimal drop point assignment after listing confirmed
 * TASK: Implement nearest-first algorithm with capacity and crate constraints
 * ACTION: Query nearby points, filter by constraints, assign best option
 * RESULT: Farmer gets optimal drop point for produce delivery
 * 
 * @module DropPointAssignmentService
 */

import {
    dropPointRepository,
    GeoLocation,
    DropPointWithDistance,
} from '../repositories/drop-point-repository';
import type { DropPoint, DropPointAssignment } from '../generated/prisma/client';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface AssignDropPointInput {
    listingId: number;
    farmerId: number;
    farmerLocation: GeoLocation;
    cropType: string;
    quantityKg: number;
    preferredDate?: Date; // Defaults to tomorrow
}

export interface DropPointAssignmentResult {
    assignment: DropPointAssignment;
    dropPoint: {
        id: string;
        name: string;
        address: string;
        location: GeoLocation;
        distanceKm: number;
    };
    pickupWindow: {
        start: Date;
        end: Date;
    };
    cratesNeeded: number;
}

export interface NearbyDropPointInfo {
    id: string;
    name: string;
    address: string;
    location: GeoLocation;
    distanceKm: number;
    isOpen: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SEARCH_RADIUS_KM = 20;
const CRATES_PER_50KG = 1; // 1 crate per 50kg
const DEFAULT_TIME_SLOT_START_HOUR = 7; // 7 AM
const DEFAULT_TIME_SLOT_DURATION_HOURS = 2; // 7-9 AM

// ============================================================================
// Service Errors
// ============================================================================

export class DropPointAssignmentError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'DropPointAssignmentError';
    }
}

// ============================================================================
// Service Class
// ============================================================================

export class DropPointAssignmentService {

    /**
     * Assign optimal drop point to a listing (AC2 Algorithm)
     * 
     * Algorithm:
     * 1. Find drop points within radius, sorted by distance
     * 2. For each (nearest-first):
     *    - Check time slot capacity
     *    - Check crate availability
     *    - If both pass, assign
     * 3. Fallback: assign to nearest even if over capacity
     */
    async assignDropPoint(input: AssignDropPointInput): Promise<DropPointAssignmentResult> {
        const {
            listingId,
            farmerId,
            farmerLocation,
            cropType,
            quantityKg,
            preferredDate = this.getNextBusinessDay(),
        } = input;

        // 1. Calculate crates needed
        const cratesNeeded = Math.ceil(quantityKg / 50) * CRATES_PER_50KG;

        // 2. Find nearby drop points
        const nearbyDropPoints = await dropPointRepository.findNearby({
            location: farmerLocation,
            radiusKm: DEFAULT_SEARCH_RADIUS_KM,
            limit: 20,
        });

        if (nearbyDropPoints.length === 0) {
            throw new DropPointAssignmentError(
                'No drop points found within search radius',
                'NO_DROP_POINTS'
            );
        }

        logger.info(
            { listingId, nearbyCount: nearbyDropPoints.length, radiusKm: DEFAULT_SEARCH_RADIUS_KM },
            'Found nearby drop points'
        );

        // 3. Try to find optimal drop point (nearest with capacity + crates)
        let assignedDropPoint: DropPointWithDistance | null = null;
        let slotId: number | null = null;

        for (const dropPoint of nearbyDropPoints) {
            // 3a. Check time slot capacity
            const capacityCheck = await dropPointRepository.checkSlotCapacity(
                dropPoint.id,
                preferredDate,
                DEFAULT_TIME_SLOT_START_HOUR,
                quantityKg
            );

            if (!capacityCheck.hasCapacity) {
                logger.debug(
                    { dropPointId: dropPoint.id, availableKg: capacityCheck.availableKg },
                    'Drop point slot at capacity, trying next'
                );
                continue;
            }

            // 3b. Check crate availability
            const crateCheck = await dropPointRepository.checkCrateAvailability(
                dropPoint.id,
                cropType,
                cratesNeeded
            );

            if (!crateCheck.hasAvailability) {
                logger.debug(
                    { dropPointId: dropPoint.id, availableCrates: crateCheck.availableCrates, needed: cratesNeeded },
                    'Drop point lacks crates, trying next'
                );
                continue;
            }

            // Found suitable drop point!
            assignedDropPoint = dropPoint;
            slotId = capacityCheck.slot?.id ?? null;
            break;
        }

        // 4. Fallback: assign to nearest regardless of capacity
        if (!assignedDropPoint) {
            logger.warn(
                { listingId },
                'No optimal drop point found, falling back to nearest'
            );
            assignedDropPoint = nearbyDropPoints[0];

            // Create or get the slot for capacity tracking
            const capacityCheck = await dropPointRepository.checkSlotCapacity(
                assignedDropPoint.id,
                preferredDate,
                DEFAULT_TIME_SLOT_START_HOUR,
                quantityKg
            );
            slotId = capacityCheck.slot?.id ?? null;
        }

        // 5. Reserve capacity
        if (slotId) {
            await dropPointRepository.reserveCapacity(slotId, quantityKg);
        }

        // 6. Calculate pickup window
        const pickupWindowStart = new Date(preferredDate);
        pickupWindowStart.setHours(DEFAULT_TIME_SLOT_START_HOUR, 0, 0, 0);

        const pickupWindowEnd = new Date(preferredDate);
        pickupWindowEnd.setHours(
            DEFAULT_TIME_SLOT_START_HOUR + DEFAULT_TIME_SLOT_DURATION_HOURS,
            0, 0, 0
        );

        // 7. Create assignment record
        const assignment = await dropPointRepository.createAssignment({
            listingId,
            dropPointId: assignedDropPoint.id,
            farmerId,
            farmerLocation,
            distanceKm: assignedDropPoint.distanceKm,
            pickupWindowStart,
            pickupWindowEnd,
            cratesNeeded,
        });

        logger.info(
            {
                listingId,
                dropPointId: assignedDropPoint.id,
                dropPointName: assignedDropPoint.name,
                distanceKm: assignedDropPoint.distanceKm,
            },
            'Drop point assigned successfully'
        );

        return {
            assignment,
            dropPoint: {
                id: assignedDropPoint.id,
                name: assignedDropPoint.name,
                address: assignedDropPoint.address,
                location: {
                    latitude: Number(assignedDropPoint.latitude),
                    longitude: Number(assignedDropPoint.longitude),
                },
                distanceKm: assignedDropPoint.distanceKm,
            },
            pickupWindow: {
                start: pickupWindowStart,
                end: pickupWindowEnd,
            },
            cratesNeeded,
        };
    }

    /**
     * Get assignment details for a listing
     */
    async getAssignment(listingId: number): Promise<DropPointAssignmentResult | null> {
        const assignmentWithDp = await dropPointRepository.getAssignmentWithDropPoint(listingId);

        if (!assignmentWithDp) {
            return null;
        }

        const { dropPoint, ...assignment } = assignmentWithDp;

        return {
            assignment,
            dropPoint: {
                id: dropPoint.id,
                name: dropPoint.name,
                address: dropPoint.address,
                location: {
                    latitude: Number(dropPoint.latitude),
                    longitude: Number(dropPoint.longitude),
                },
                distanceKm: Number(assignment.distanceKm),
            },
            pickupWindow: {
                start: assignment.pickupWindowStart,
                end: assignment.pickupWindowEnd,
            },
            cratesNeeded: assignment.cratesNeeded,
        };
    }

    /**
     * Get nearby drop points for display (AC3 alternative drop points)
     */
    async getNearbyDropPoints(
        location: GeoLocation,
        radiusKm: number = DEFAULT_SEARCH_RADIUS_KM
    ): Promise<NearbyDropPointInfo[]> {
        const nearby = await dropPointRepository.findNearby({
            location,
            radiusKm,
            limit: 10,
        });

        const now = new Date();
        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });

        return nearby.map((dp) => ({
            id: dp.id,
            name: dp.name,
            address: dp.address,
            location: {
                latitude: Number(dp.latitude),
                longitude: Number(dp.longitude),
            },
            distanceKm: dp.distanceKm,
            isOpen: this.isDropPointOpen(dp.operatingHours as any, dayOfWeek, now),
        }));
    }

    /**
     * Reassign to a different drop point (AC6)
     */
    async reassignDropPoint(
        listingId: number,
        newDropPointId: string,
        changeReason: string
    ): Promise<DropPointAssignmentResult> {
        const existing = await dropPointRepository.getAssignmentWithDropPoint(listingId);

        if (!existing) {
            throw new DropPointAssignmentError(
                'No existing assignment found',
                'NOT_FOUND'
            );
        }

        const newDropPoint = await dropPointRepository.findById(newDropPointId);

        if (!newDropPoint) {
            throw new DropPointAssignmentError(
                'New drop point not found',
                'DROP_POINT_NOT_FOUND'
            );
        }

        // Update assignment
        await dropPointRepository.updateAssignment(listingId, {
            dropPointId: newDropPointId,
            status: 'REASSIGNED',
            changeReason,
            previousDropPointId: existing.dropPointId,
        });

        // Get updated assignment
        const updated = await this.getAssignment(listingId);

        if (!updated) {
            throw new DropPointAssignmentError(
                'Failed to update assignment',
                'UPDATE_FAILED'
            );
        }

        logger.info(
            { listingId, oldDropPointId: existing.dropPointId, newDropPointId, changeReason },
            'Drop point reassigned'
        );

        return updated;
    }

    /**
     * Get all upcoming deliveries for a farmer (AC5)
     */
    async getUpcomingDeliveries(farmerId: number): Promise<DropPointAssignmentResult[]> {
        const assignments = await dropPointRepository.findAssignmentsByFarmerId(
            farmerId,
            'ASSIGNED'
        );

        return assignments.map((a) => ({
            assignment: a,
            dropPoint: {
                id: a.dropPoint.id,
                name: a.dropPoint.name,
                address: a.dropPoint.address,
                location: {
                    latitude: Number(a.dropPoint.latitude),
                    longitude: Number(a.dropPoint.longitude),
                },
                distanceKm: Number(a.distanceKm),
            },
            pickupWindow: {
                start: a.pickupWindowStart,
                end: a.pickupWindowEnd,
            },
            cratesNeeded: a.cratesNeeded,
        }));
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    private getNextBusinessDay(): Date {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        // Skip Sunday (0)
        if (tomorrow.getDay() === 0) {
            tomorrow.setDate(tomorrow.getDate() + 1);
        }

        return tomorrow;
    }

    private isDropPointOpen(
        operatingHours: Record<string, { open: string; close: string }> | null,
        dayOfWeek: string,
        now: Date
    ): boolean {
        if (!operatingHours) return false;

        const todayHours = operatingHours[dayOfWeek];
        if (!todayHours || todayHours.open === '00:00' && todayHours.close === '00:00') {
            return false; // Closed
        }

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        const [openHour, openMinute] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMinute] = todayHours.close.split(':').map(Number);

        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;

        return currentTime >= openTime && currentTime < closeTime;
    }
}

// Export singleton instance
export const dropPointAssignmentService = new DropPointAssignmentService();
