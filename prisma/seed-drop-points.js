"use strict";
/**
 * Seed Data - Drop Points for Kolar District (Task 1.2)
 *
 * SITUATION: Testing requires realistic drop point data
 * TASK: Seed 10 drop points in Kolar, Karnataka for testing
 * ACTION: Create drop points with varied capacities and locations
 * RESULT: Predictable test data for geospatial queries
 *
 * @module seed-drop-points
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../src/generated/prisma/client");
const prisma = new client_1.PrismaClient();
const KOLAR_DROP_POINTS = [
    {
        name: 'Kolar Main Drop Point',
        address: 'Near KSRTC Bus Stand, Station Road, Kolar, Karnataka 563101',
        district: 'Kolar',
        latitude: 13.1378,
        longitude: 78.1300,
        operatingHours: {
            monday: { open: '06:00', close: '18:00' },
            tuesday: { open: '06:00', close: '18:00' },
            wednesday: { open: '06:00', close: '18:00' },
            thursday: { open: '06:00', close: '18:00' },
            friday: { open: '06:00', close: '18:00' },
            saturday: { open: '06:00', close: '14:00' },
            sunday: { open: '08:00', close: '12:00' },
        },
        maxDailyCapacity: 5000,
        crateInventory: { tomato: 100, potato: 80, onion: 60, carrot: 40 },
    },
    {
        name: 'Bangarpet Collection Center',
        address: 'Market Road, Bangarpet, Kolar District, Karnataka 563114',
        district: 'Kolar',
        latitude: 12.9913,
        longitude: 78.1780,
        operatingHours: {
            monday: { open: '05:30', close: '17:00' },
            tuesday: { open: '05:30', close: '17:00' },
            wednesday: { open: '05:30', close: '17:00' },
            thursday: { open: '05:30', close: '17:00' },
            friday: { open: '05:30', close: '17:00' },
            saturday: { open: '05:30', close: '13:00' },
            sunday: { open: '07:00', close: '11:00' },
        },
        maxDailyCapacity: 3500,
        crateInventory: { tomato: 70, potato: 60, onion: 50, mango: 30 },
    },
    {
        name: 'Mulbagal Farmer Hub',
        address: 'NH 75, Mulbagal, Kolar District, Karnataka 563131',
        district: 'Kolar',
        latitude: 13.1631,
        longitude: 78.3939,
        operatingHours: {
            monday: { open: '06:00', close: '16:00' },
            tuesday: { open: '06:00', close: '16:00' },
            wednesday: { open: '06:00', close: '16:00' },
            thursday: { open: '06:00', close: '16:00' },
            friday: { open: '06:00', close: '16:00' },
            saturday: { open: '06:00', close: '12:00' },
            sunday: { open: '00:00', close: '00:00' }, // Closed
        },
        maxDailyCapacity: 2500,
        crateInventory: { tomato: 50, potato: 40, cauliflower: 30 },
    },
    {
        name: 'Malur Agri Depot',
        address: 'Old Madras Road, Malur, Kolar District, Karnataka 563130',
        district: 'Kolar',
        latitude: 13.0051,
        longitude: 77.9344,
        operatingHours: {
            monday: { open: '05:00', close: '18:00' },
            tuesday: { open: '05:00', close: '18:00' },
            wednesday: { open: '05:00', close: '18:00' },
            thursday: { open: '05:00', close: '18:00' },
            friday: { open: '05:00', close: '18:00' },
            saturday: { open: '05:00', close: '15:00' },
            sunday: { open: '06:00', close: '12:00' },
        },
        maxDailyCapacity: 4000,
        crateInventory: { tomato: 80, potato: 70, onion: 60, cabbage: 40 },
    },
    {
        name: 'Chintamani East Hub',
        address: 'DC Office Road, Chintamani, Chikkaballapur District, Karnataka 563125',
        district: 'Kolar',
        latitude: 13.4003,
        longitude: 78.0543,
        operatingHours: {
            monday: { open: '06:30', close: '17:30' },
            tuesday: { open: '06:30', close: '17:30' },
            wednesday: { open: '06:30', close: '17:30' },
            thursday: { open: '06:30', close: '17:30' },
            friday: { open: '06:30', close: '17:30' },
            saturday: { open: '06:30', close: '14:00' },
            sunday: { open: '08:00', close: '12:00' },
        },
        maxDailyCapacity: 3000,
        crateInventory: { tomato: 60, potato: 50, banana: 40 },
    },
    {
        name: 'Srinivaspur Mandis Point',
        address: 'APMC Yard, Srinivaspur, Kolar District, Karnataka 563135',
        district: 'Kolar',
        latitude: 13.3367,
        longitude: 78.2132,
        operatingHours: {
            monday: { open: '04:00', close: '16:00' },
            tuesday: { open: '04:00', close: '16:00' },
            wednesday: { open: '04:00', close: '16:00' },
            thursday: { open: '04:00', close: '16:00' },
            friday: { open: '04:00', close: '16:00' },
            saturday: { open: '04:00', close: '12:00' },
            sunday: { open: '00:00', close: '00:00' }, // Closed
        },
        maxDailyCapacity: 4500,
        crateInventory: { mango: 100, tomato: 80, potato: 60 },
    },
    {
        name: 'Kolar Gold Fields Center',
        address: 'KGF Main Road, Kolar Gold Fields, Kolar District, Karnataka 563115',
        district: 'Kolar',
        latitude: 12.9512,
        longitude: 78.2773,
        operatingHours: {
            monday: { open: '06:00', close: '17:00' },
            tuesday: { open: '06:00', close: '17:00' },
            wednesday: { open: '06:00', close: '17:00' },
            thursday: { open: '06:00', close: '17:00' },
            friday: { open: '06:00', close: '17:00' },
            saturday: { open: '06:00', close: '13:00' },
            sunday: { open: '07:00', close: '11:00' },
        },
        maxDailyCapacity: 2000,
        crateInventory: { tomato: 40, potato: 35, onion: 30 },
    },
    {
        name: 'Bethamangala Village Point',
        address: 'Bethamangala, Kolar District, Karnataka 563122',
        district: 'Kolar',
        latitude: 13.1789,
        longitude: 78.0765,
        operatingHours: {
            monday: { open: '07:00', close: '15:00' },
            tuesday: { open: '07:00', close: '15:00' },
            wednesday: { open: '07:00', close: '15:00' },
            thursday: { open: '07:00', close: '15:00' },
            friday: { open: '07:00', close: '15:00' },
            saturday: { open: '07:00', close: '12:00' },
            sunday: { open: '00:00', close: '00:00' }, // Closed
        },
        maxDailyCapacity: 1500,
        crateInventory: { tomato: 30, potato: 25, carrot: 20 },
    },
    {
        name: 'Vemagal Farmer Collection',
        address: 'Vemagal Village, Kolar District, Karnataka 563138',
        district: 'Kolar',
        latitude: 13.0632,
        longitude: 78.0234,
        operatingHours: {
            monday: { open: '06:00', close: '14:00' },
            tuesday: { open: '06:00', close: '14:00' },
            wednesday: { open: '06:00', close: '14:00' },
            thursday: { open: '06:00', close: '14:00' },
            friday: { open: '06:00', close: '14:00' },
            saturday: { open: '06:00', close: '12:00' },
            sunday: { open: '00:00', close: '00:00' }, // Closed
        },
        maxDailyCapacity: 1200,
        crateInventory: { tomato: 25, potato: 20, cabbage: 15 },
    },
    {
        name: 'Bowringpet Hub',
        address: 'Bowringpet, Kolar District, Karnataka 563139',
        district: 'Kolar',
        latitude: 12.9897,
        longitude: 78.0890,
        operatingHours: {
            monday: { open: '05:30', close: '16:30' },
            tuesday: { open: '05:30', close: '16:30' },
            wednesday: { open: '05:30', close: '16:30' },
            thursday: { open: '05:30', close: '16:30' },
            friday: { open: '05:30', close: '16:30' },
            saturday: { open: '05:30', close: '13:00' },
            sunday: { open: '07:00', close: '11:00' },
        },
        maxDailyCapacity: 2200,
        crateInventory: { tomato: 45, potato: 40, onion: 35, banana: 25 },
    },
];
async function seedDropPoints() {
    console.log('🌱 Seeding drop points for Kolar district...');
    for (const dropPoint of KOLAR_DROP_POINTS) {
        const existing = await prisma.dropPoint.findFirst({
            where: { name: dropPoint.name },
        });
        if (existing) {
            console.log(`  ⏭️  Skipping "${dropPoint.name}" - already exists`);
            continue;
        }
        await prisma.dropPoint.create({
            data: {
                name: dropPoint.name,
                address: dropPoint.address,
                district: dropPoint.district,
                latitude: dropPoint.latitude,
                longitude: dropPoint.longitude,
                operatingHours: dropPoint.operatingHours,
                maxDailyCapacity: dropPoint.maxDailyCapacity,
                crateInventory: dropPoint.crateInventory,
                isActive: true,
            },
        });
        console.log(`  ✅ Created "${dropPoint.name}"`);
    }
    console.log('✅ Seed complete!');
}
async function main() {
    try {
        await seedDropPoints();
    }
    catch (error) {
        console.error('❌ Seed failed:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
