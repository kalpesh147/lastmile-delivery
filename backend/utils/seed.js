require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Zone = require('../models/Zone');
const RateCard = require('../models/RateCard');
const CodSurcharge = require('../models/CodSurcharge');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding...');

  // Admin user
  const adminEmail = 'admin@lastmile.com';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: 'Admin@123',
      role: 'admin',
    });
    console.log('Created admin:', adminEmail, '/ password: Admin@123');
  }

  // Zones
  const zonesData = [
    { name: 'North Zone', code: 'NZ', pincodes: ['110001', '110002', '110003'] },
    { name: 'South Zone', code: 'SZ', pincodes: ['560001', '560002', '560003'] },
  ];
  for (const z of zonesData) {
    await Zone.findOneAndUpdate({ code: z.code }, z, { upsert: true, new: true });
  }
  console.log('Zones seeded');

  // Rate cards: B2B/B2C x intra/inter
  const rateCardsData = [
    { orderType: 'B2C', zoneRelation: 'intra', baseRate: 30, perKgRate: 10 },
    { orderType: 'B2C', zoneRelation: 'inter', baseRate: 50, perKgRate: 15 },
    { orderType: 'B2B', zoneRelation: 'intra', baseRate: 40, perKgRate: 8 },
    { orderType: 'B2B', zoneRelation: 'inter', baseRate: 70, perKgRate: 12 },
  ];
  for (const rc of rateCardsData) {
    await RateCard.findOneAndUpdate(
      { orderType: rc.orderType, zoneRelation: rc.zoneRelation },
      rc,
      { upsert: true, new: true }
    );
  }
  console.log('Rate cards seeded');

  // COD surcharge
  await CodSurcharge.findOneAndUpdate(
    { orderType: 'B2C' },
    { orderType: 'B2C', surchargeType: 'flat', value: 20 },
    { upsert: true }
  );
  await CodSurcharge.findOneAndUpdate(
    { orderType: 'B2B' },
    { orderType: 'B2B', surchargeType: 'percentage', value: 2 },
    { upsert: true }
  );
  console.log('COD surcharge config seeded');

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
