/**
 * Drop Point Repository - Data Access Layer (Task 1.3)
 * 
 * SITUATION: Drop points need CRUD operations and geospatial queries
 * TASK: Provide type-safe data access with distance calculations
 * ACTION: Encapsulate Prisma queries, use Haversine for distance
 * RESULT: Clean repository pattern matching ListingRepository style
 * 
 * @module DropPointRepository
 */

import { prisma } from '../lib/prisma';
import type { DropPoint, TimeSlotCapacity, DropPointAssignment, Prisma } from '../generated/prisma/client';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface GeoLocation {
    latitude: number;
    longitude: number;
}

export interface NearbyDropPointsFilter {
    location: GeoLocation;
    radiusKm: number;
    limit?: number;
    includeInactive?: boolean;
}

export interface DropPointWithDistance extends DropPoint {
    distanceKm: number;
}

export interface TimeSlotFilter {
    dropPointId: string;
    date: Date;
    startHour?: number;
}

export interface CreateAssignmentInput {
    listingId: number;
    dropPointId: string;
    farmerId: number;
    farmerLocation: GeoLocation;
    distanceKm: number;
    pickupWindowStart: Date;
    pickupWindowEnd: Date;
    cratesNeeded: number;
}

// ============================================================================
// Haversine Distance Calculation
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * 
 * @param point1 - First coordinate (lat/lng)
 * @param point2 - Second coordinate (lat/lng)
 * @returns Distance in kilometers
 */
function calculateHaversineDistance(point1: GeoLocation, point2: GeoLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(point2.latitude - point1.latitude);
    const dLng = toRadians(point2.longitude - point1.longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(point1.latitude)) *
        Math.cos(toRadians(point2.latitude)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

// ============================================================================
// Repository Class
// ============================================================================

export class DropPointRepository {

    /**
     * Find drop point by ID
     */
    async findById(id: string): Promise<DropPoint | null> {
        return prisma.dropPoint.findUnique({
            where: { id },
        });
    }

    /**
     * Find all active drop points in a district
     */
    async findByDistrict(district: string): Promise<DropPoint[]> {
        return prisma.dropPoint.findMany({
            where: {
                district,
                isActive: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find nearby drop points sorted by distance
     * 
     * Uses in-memory Haversine calculation. For production scale,
     * consider PostGIS ST_DWithin for indexed geospatial queries.
     */
    async findNearby(filter: NearbyDropPointsFilter): Promise<DropPointWithDistance[]> {
        const { location, radiusKm, limit = 10, includeInactive = false } = filter;

        // Fetch all potentially nearby drop points
        // In production, use bounding box pre-filter for efficiency
        const allDropPoints = await prisma.dropPoint.findMany({
            where: {
                ...(includeInactive ? {} : { isActive: true }),
            },
        });

        // Calculate distances and filter by radius
        const dropPointsWithDistance = allDropPoints
            .map((dp) => ({
                ...dp,
                distanceKm: calculateHaversineDistance(location, {
                    latitude: Number(dp.latitude),
                    longitude: Number(dp.longitude),
                }),
            }))
            .filter((dp) => dp.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, limit);

        // Round distance to 2 decimal places
        return dropPointsWithDistance.map((dp) => ({
            ...dp,
            distanceKm: Math.round(dp.distanceKm * 100) / 100,
        }));
    }

    /**
     * Get available time slots for a drop point on a date
     */
    async getAvailableSlots(filter: TimeSlotFilter): Promise<TimeSlotCapacity[]> {
        const { dropPointId, date, startHour } = filter;

        return prisma.timeSlotCapacity.findMany({
            where: {
                dropPointId,
                slotDate: date,
                ...(startHour !== undefined && { slotStartHour: startHour }),
            },
            orderBy: { slotStartHour: 'asc' },
        });
    }

    /**
     * Check if a time slot has capacity for additional kg
     */
    async checkSlotCapacity(
        dropPointId: string,
        date: Date,
        startHour: number,
        requiredKg: number
    ): Promise<{ hasCapacity: boolean; availableKg: number; slot: TimeSlotCapacity | null }> {
        let slot = await prisma.timeSlotCapacity.findFirst({
            where: {
                dropPointId,
                slotDate: date,
                slotStartHour: startHour,
            },
        });

        // If no slot exists, create one with default capacity
        if (!slot) {
            slot = await prisma.timeSlotCapacity.create({
                data: {
                    dropPointId,
                    slotDate: date,
                    slotStartHour: startHour,
                    slotEndHour: startHour + 2, // 2-hour windows
                    maxCapacityKg: 1000,
                    usedCapacityKg: 0,
                },
            });
        }

        const availableKg = slot.maxCapacityKg - slot.usedCapacityKg;
        const hasCapacity = availableKg >= requiredKg;

        return { hasCapacity, availableKg, slot };
    }

    /**
     * Reserve capacity in a time slot
     */
    async reserveCapacity(
        slotId: number,
        reserveKg: number
    ): Promise<TimeSlotCapacity> {
        return prisma.timeSlotCapacity.update({
            where: { id: slotId },
            data: {
                usedCapacityKg: { increment: reserveKg },
            },
        });
    }

    /**
     * Check crate availability for a crop type
     */
    async checkCrateAvailability(
        dropPointId: string,
        cropType: string,
        requiredCrates: number
    ): Promise<{ hasAvailability: boolean; availableCrates: number }> {
        const dropPoint = await prisma.dropPoint.findUnique({
            where: { id: dropPointId },
            select: { crateInventory: true },
        });

        if (!dropPoint?.crateInventory) {
            return { hasAvailability: false, availableCrates: 0 };
        }

        const inventory = dropPoint.crateInventory as Record<string, number>;
        const normalizedCrop = cropType.toLowerCase();
        const availableCrates = inventory[normalizedCrop] ?? 0;

        return {
            hasAvailability: availableCrates >= requiredCrates,
            availableCrates,
        };
    }

    /**
     * Create a drop point assignment for a listing
     */
    async createAssignment(input: CreateAssignmentInput): Promise<DropPointAssignment> {
        return prisma.dropPointAssignment.create({
            data: {
                listingId: input.listingId,
                dropPointId: input.dropPointId,
                farmerId: input.farmerId,
                farmerLatitude: input.farmerLocation.latitude,
                farmerLongitude: input.farmerLocation.longitude,
                distanceKm: input.distanceKm,
                pickupWindowStart: input.pickupWindowStart,
                pickupWindowEnd: input.pickupWindowEnd,
                cratesNeeded: input.cratesNeeded,
                status: 'ASSIGNED',
            },
        });
    }

    /**
     * Get assignment by listing ID
     */
    async getAssignmentByListingId(listingId: number): Promise<DropPointAssignment | null> {
        return prisma.dropPointAssignment.findUnique({
            where: { listingId },
        });
    }

    /**
     * Get assignment with drop point details
     */
    async getAssignmentWithDropPoint(listingId: number): Promise<
        (DropPointAssignment & { dropPoint: DropPoint }) | null
    > {
        return prisma.dropPointAssignment.findUnique({
            where: { listingId },
            include: { dropPoint: true },
        });
    }

    /**
     * Update assignment (e.g., for reassignment)
     */
    async updateAssignment(
        listingId: number,
        data: Partial<{
            dropPointId: string;
            pickupWindowStart: Date;
            pickupWindowEnd: Date;
            status: string;
            changeReason: string;
            previousDropPointId: string;
        }>
    ): Promise<DropPointAssignment> {
        return prisma.dropPointAssignment.update({
            where: { listingId },
            data: data as any,
        });
    }

    /**
     * Find all active assignments for a farmer
     */
    async findAssignmentsByFarmerId(
        farmerId: number,
        status?: string
    ): Promise<(DropPointAssignment & { dropPoint: DropPoint })[]> {
        return prisma.dropPointAssignment.findMany({
            where: {
                farmerId,
                ...(status && { status: status as any }),
            },
            include: { dropPoint: true },
            orderBy: { pickupWindowStart: 'asc' },
        });
    }
}

// Export singleton instance
export const dropPointRepository = new DropPointRepository();
