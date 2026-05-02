import { db } from './index';
import { voters, incidents, misinfoChecks, rollSnapshots } from './schema';
import crypto from 'crypto';

function hash(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const CATEGORIES = ['INTIMIDATION', 'CASH_FOR_VOTE', 'BOOTH_CAPTURE', 'IMPERSONATION', 'OTHER'];
const VERDICTS = ['TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE'];
const CONSTITUENCIES = ['DL-01', 'MH-24', 'KA-28', 'TN-39', 'WB-22', 'UP-15', 'RJ-05', 'AP-09', 'GJ-12'];

const CITIES = [
  { lat: 28.7041, lng: 77.1025, name: "Delhi" },
  { lat: 19.0760, lng: 72.8777, name: "Mumbai" },
  { lat: 12.9716, lng: 77.5946, name: "Bangalore" },
  { lat: 13.0827, lng: 80.2707, name: "Chennai" },
  { lat: 22.5726, lng: 88.3639, name: "Kolkata" },
  { lat: 17.3850, lng: 78.4867, name: "Hyderabad" },
  { lat: 23.0225, lng: 72.5714, name: "Ahmedabad" },
  { lat: 18.5204, lng: 73.8567, name: "Pune" },
  { lat: 26.9124, lng: 75.7873, name: "Jaipur" },
  { lat: 26.8467, lng: 80.9462, name: "Lucknow" }
];

function getRandomCityGeo() {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)]!;
  // Add jitter for spreading around the city (roughly within 50km)
  const latJitter = (Math.random() - 0.5) * 1.0; 
  const lngJitter = (Math.random() - 0.5) * 1.0;
  return {
    latitude: (city.lat + latJitter).toFixed(6),
    longitude: (city.lng + lngJitter).toFixed(6)
  };
}

const SUMMARIES = [
  "Unidentified group distributing cash in slum areas.",
  "Reports of electronic voting machines malfunctioning.",
  "Party workers preventing voters from reaching the booth.",
  "Fake IDs being used to cast multiple votes.",
  "Local goons threatening voters near the polling station.",
  "Suspicious vehicle dropping off multiple masked individuals.",
  "Campaign materials still being distributed within 100m.",
  "Poling officer seems to be guiding voters to press a specific button.",
  "Power cut at the booth exactly when voting peaked.",
  "Minor scuffle between two opposing party workers."
];

async function seed() {
  console.log('🌱 Generating Massive VoteShield Database...');

  try {
    // 1. Seed Voters
    const mockVoters = [];
    for (let i = 0; i < 200; i++) {
      mockVoters.push({
        voterIdHash: hash(`VOTER${i.toString().padStart(6, '0')}`),
        phoneHash: hash(`+91987654${i.toString().padStart(4, '0')}`),
        constituencyCode: CONSTITUENCIES[Math.floor(Math.random() * CONSTITUENCIES.length)]!,
        language: 'en'
      });
    }
    await db.insert(voters).values(mockVoters);
    console.log(`✅ ${mockVoters.length} voters enrolled`);

    // 2. Seed Incidents (Massive Data)
    const mockIncidents = [];
    for (let i = 0; i < 500; i++) {
      const geo = getRandomCityGeo();
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 72)); // Spread over last 3 days

      mockIncidents.push({
        ticket: `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        reporterHash: hash(`+91987654${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`),
        category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]!,
        urgency: Math.floor(Math.random() * 5) + 1, // 1 to 5
        summary: SUMMARIES[Math.floor(Math.random() * SUMMARIES.length)]!,
        constituency: CONSTITUENCIES[Math.floor(Math.random() * CONSTITUENCIES.length)]!,
        latitude: geo.latitude,
        longitude: geo.longitude,
        status: Math.random() > 0.8 ? 'RESOLVED' : (Math.random() > 0.5 ? 'ASSIGNED' : 'OPEN'),
        assignedSquad: Math.random() > 0.5 ? `Squad ${['Alpha', 'Bravo', 'Charlie', 'Delta'][Math.floor(Math.random() * 4)]}` : null,
        createdAt
      });
    }
    
    // Chunk insert to avoid parameter limit in postgres
    for (let i = 0; i < mockIncidents.length; i += 50) {
      await db.insert(incidents).values(mockIncidents.slice(i, i + 50));
    }
    console.log(`✅ ${mockIncidents.length} incidents seeded`);

    // 3. Seed Misinfo Checks
    const mockMisinfo = [];
    for (let i = 0; i < 300; i++) {
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 72));

      mockMisinfo.push({
        messageHash: hash(`MSG${i}`),
        verdict: VERDICTS[Math.floor(Math.random() * VERDICTS.length)]!,
        explanation: "This has been fact-checked by our simulated engine based on ECI guidelines.",
        responseMs: Math.floor(Math.random() * 1500) + 500,
        createdAt
      });
    }

    for (let i = 0; i < mockMisinfo.length; i += 50) {
      await db.insert(misinfoChecks).values(mockMisinfo.slice(i, i + 50));
    }
    console.log(`✅ ${mockMisinfo.length} misinfo checks seeded`);

    console.log('🎉 Massive Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
