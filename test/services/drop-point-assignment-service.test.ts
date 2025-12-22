/**
 * Drop Point Assignment Service - Unit Tests (Story 3.4)
 * 
 * Tests nearest-first drop point assignment algorithm with:
 * - Geolocation-based nearest drop point selection (AC2)
 * - Capacity constraint enforcement (AC2)
 * - Crate availability checks (AC2)
 * - Pickup window calculation (AC1)
 * 
 * Uses jest-mock-extended for Prisma mocking.
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, DropPoint, DropPointAssignment, TimeSlotCapacity } from '@prisma/client';
import { DropPointAssignmentService } from '../../src/services/drop-point-assignment-service';
import { DropPointRepository } from '../../src/repositories/drop-point-repository';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../src/lib/prisma';
const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// ============================================================================
// Test Data
// ============================================================================

const mockDropPoints: Partial<DropPoint>[] = [
    {
        id: 'dp-001',
        name: 'Kolar Main Point',
        address: 'Near KSRTC, Kolar',
        latitude: 13.1378 as any,
        longitude: 78.1300 as any,
        district: 'Kolar',
        isActive: true,
        maxDailyCapacity: 100,
        crateInventory: { '20kg': 50, '50kg': 30 } as any,
        operatingHours: { mon: '06:00-18:00', tue: '06:00-18:00' } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: 'dp-002',
        name: 'Mulbagal Point',
        address: 'Main Road, Mulbagal',
        latitude: 13.1643 as any,
        longitude: 78.3961 as any,
        district: 'Kolar',
        isActive: true,
        maxDailyCapacity: 50,
        crateInventory: { '20kg': 20, '50kg': 10 } as any,
        operatingHours: { mon: '07:00-17:00', tue: '07:00-17:00' } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

const mockFarmerLocation = {
    latitude: 13.1400,
    longitude: 78.1350,
};

// ============================================================================
// Test Suite
// ============================================================================

describe('DropPointAssignmentService', () => {
    let service: DropPointAssignmentService;

    beforeEach(() => {
        mockReset(prismaMock);
        service = new DropPointAssignmentService();
    });

    // --------------------------------------------------------------------------
    // assignDropPoint
    // --------------------------------------------------------------------------

    describe('assignDropPoint', () => {
        it('should assign nearest drop point with capacity (AC2)', async () => {
            // Arrange
            prismaMock.dropPoint.findMany.mockResolvedValue(mockDropPoints as any);
            prismaMock.timeSlotCapacity.findFirst.mockResolvedValue({
                id: 1,
                dropPointId: 'dp-001',
                reserved: 20,
                maxCapacity: 100,
            } as any);
            prismaMock.dropPointAssignment.create.mockResolvedValue({
                id: 1,
                listingId: 1,
                dropPointId: 'dp-001',
                status: 'ASSIGNED',
            } as any);

            // Act
            const result = await service.assignDropPoint({
                listingId: 1,
                farmerId: 1,
                farmerLocation: mockFarmerLocation,
                cropType: 'Tomatoes',
                quantityKg: 50,
            });

            // Assert
            expect(result.dropPoint.name).toBe('Kolar Main Point');
            expect(result.cratesNeeded).toBeGreaterThan(0);
            expect(result.pickupWindow.start).toBeDefined();
            expect(result.pickupWindow.end).toBeDefined();
        });

        it('should calculate distance using Haversine formula (AC2)', async () => {
            // Arrange
            prismaMock.dropPoint.findMany.mockResolvedValue(mockDropPoints as any);
            prismaMock.timeSlotCapacity.findFirst.mockResolvedValue(null);
            prismaMock.dropPointAssignment.create.mockResolvedValue({
                id: 1,
                listingId: 1,
                dropPointId: 'dp-001',
            } as any);

            // Act
            const result = await service.assignDropPoint({
                listingId: 1,
                farmerId: 1,
                farmerLocation: mockFarmerLocation,
                cropType: 'Tomatoes',
                quantityKg: 30,
            });

            // Assert - dp-001 (0.5km away) should be closer than dp-002 (27km away)
            expect(result.dropPoint.id).toBe('dp-001');
            expect(result.dropPoint.distanceKm).toBeLessThan(1);
        });

        it('should skip drop points at capacity (AC2)', async () => {
            // Arrange - first point at capacity
            prismaMock.dropPoint.findMany.mockResolvedValue(mockDropPoints as any);
            prismaMock.timeSlotCapacity.findFirst
                .mockResolvedValueOnce({
                    id: 1,
                    dropPointId: 'dp-001',
                    reserved: 100,
                    maxCapacity: 100,
                } as any)
                .mockResolvedValueOnce({
                    id: 2,
                    dropPointId: 'dp-002',
                    reserved: 10,
                    maxCapacity: 50,
                } as any);
            prismaMock.dropPointAssignment.create.mockResolvedValue({
                id: 1,
                listingId: 1,
                dropPointId: 'dp-002',
            } as any);

            // Act
            const result = await service.assignDropPoint({
                listingId: 1,
                farmerId: 1,
                farmerLocation: mockFarmerLocation,
                cropType: 'Tomatoes',
                quantityKg: 50,
            });

            // Assert - should fall back to dp-002
            expect(result.dropPoint.id).toBe('dp-002');
        });

        it('should calculate correct crates needed (AC1)', async () => {
            // Arrange
            prismaMock.dropPoint.findMany.mockResolvedValue(mockDropPoints as any);
            prismaMock.timeSlotCapacity.findFirst.mockResolvedValue(null);
            prismaMock.dropPointAssignment.create.mockResolvedValue({
                id: 1,
                cratesNeeded: 2,
            } as any);

            // Act
            const result = await service.assignDropPoint({
                listingId: 1,
                farmerId: 1,
                farmerLocation: mockFarmerLocation,
                cropType: 'Tomatoes',
                quantityKg: 50, // Should need 1-2 crates
            });

            // Assert - 50kg / 50kg per crate = 1 crate (minimum 1)
            expect(result.cratesNeeded).toBeGreaterThanOrEqual(1);
        });

        it('should throw error when no drop points available', async () => {
            // Arrange
            prismaMock.dropPoint.findMany.mockResolvedValue([]);

            // Act & Assert
            await expect(
                service.assignDropPoint({
                    listingId: 1,
                    farmerId: 1,
                    farmerLocation: mockFarmerLocation,
                    cropType: 'Tomatoes',
                    quantityKg: 50,
                })
            ).rejects.toThrow();
        });
    });

    // --------------------------------------------------------------------------
    // getNearbyDropPoints
    // --------------------------------------------------------------------------

    describe('getNearbyDropPoints', () => {
        it('should return drop points within radius', async () => {
            // Arrange
            prismaMock.dropPoint.findMany.mockResolvedValue(mockDropPoints as any);

            // Act
            const result = await service.getNearbyDropPoints(mockFarmerLocation, 10);

            // Assert - only dp-001 is within 10km
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0].distanceKm).toBeLessThan(10);
        });

        it('should sort by distance ascending', async () => {
            // Arrange
            prismaMock.dropPoint.findMany.mockResolvedValue(mockDropPoints as any);

            // Act
            const result = await service.getNearbyDropPoints(mockFarmerLocation, 50);

            // Assert
            if (result.length > 1) {
                expect(result[0].distanceKm).toBeLessThanOrEqual(result[1].distanceKm);
            }
        });
    });

    // --------------------------------------------------------------------------
    // getAssignment
    // --------------------------------------------------------------------------

    describe('getAssignment', () => {
        it('should return assignment with drop point details', async () => {
            // Arrange
            prismaMock.dropPointAssignment.findFirst.mockResolvedValue({
                id: 1,
                listingId: 1,
                dropPointId: 'dp-001',
                status: 'ASSIGNED',
                pickupWindowStart: new Date(),
                pickupWindowEnd: new Date(),
                cratesNeeded: 2,
                dropPoint: mockDropPoints[0],
            } as any);

            // Act
            const result = await service.getAssignment(1);

            // Assert
            expect(result).toBeDefined();
            expect(result?.dropPoint.name).toBe('Kolar Main Point');
        });

        it('should return null for non-existent assignment', async () => {
            // Arrange
            prismaMock.dropPointAssignment.findFirst.mockResolvedValue(null);

            // Act
            const result = await service.getAssignment(999);

            // Assert
            expect(result).toBeNull();
        });
    });

    // --------------------------------------------------------------------------
    // reassignDropPoint
    // --------------------------------------------------------------------------

    describe('reassignDropPoint', () => {
        it('should update assignment to new drop point (AC6)', async () => {
            // Arrange
            prismaMock.dropPointAssignment.findFirst.mockResolvedValue({
                id: 1,
                listingId: 1,
                dropPointId: 'dp-001',
                status: 'ASSIGNED',
            } as any);
            prismaMock.dropPoint.findUnique.mockResolvedValue(mockDropPoints[1] as any);
            prismaMock.dropPointAssignment.update.mockResolvedValue({
                id: 1,
                dropPointId: 'dp-002',
                status: 'REASSIGNED',
            } as any);

            // Act
            const result = await service.reassignDropPoint(1, 'dp-002', 'Capacity issue');

            // Assert
            expect(result.dropPoint.id).toBe('dp-002');
        });

        it('should throw error for non-existent assignment', async () => {
            // Arrange
            prismaMock.dropPointAssignment.findFirst.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.reassignDropPoint(999, 'dp-002', 'Test')
            ).rejects.toThrow();
        });
    });
});
