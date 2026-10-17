/**
 * seed-demo-accounts.js
 *
 * Secure local-development demo-account seeding and verification script for SmartApartment.
 *
 * ROLES CONFIGURED:
 * 1. SUPER_ADMIN       -> superadmin@smartapartment.demo   (Platform Super Admin)
 * 2. APARTMENT_ADMIN   -> admin@smartapartment.demo        (Apartment Administrator)
 * 3. RESIDENT          -> resident@smartapartment.demo     (Apartment Resident, Flat 101)
 * 4. MAINTENANCE_STAFF -> staff@smartapartment.demo        (Maintenance Operations Staff)
 *
 * SECURITY GUARDS:
 * - Refuses execution if NODE_ENV === 'production'.
 * - Uses bcrypt password hashing (minimum 10 salt rounds). Never stores plaintext passwords.
 * - Idempotent: safe to run multiple times without creating duplicate records.
 * - Creates required relational records (Apartment, Building, Flat) matching schema.
 *
 * USAGE:
 *   # Direct verification against running backend:
 *   node scripts/seed-demo-accounts.js --verify-only
 *
 *   # Direct Mongoose / MongoDB execution:
 *   MONGODB_URI=mongodb://localhost:27017/smartapartment node scripts/seed-demo-accounts.js
 */

import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import process from 'node:process';

// ── 1. Production Guard ──────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('[SECURITY BLOCK] Refusing to run development demo account seeding in PRODUCTION!');
  process.exit(1);
}

// ── 2. Demo Credentials Specification ────────────────────────────────────────
export const DEMO_ACCOUNTS = [
  {
    role: 'super_admin',
    email: 'superadmin@smartapartment.demo',
    password: process.env.DEMO_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
    name: 'Platform Super Admin',
    phone: '+91 98765 00001',
    status: 'active',
    description: 'Platform-wide administrator with full privileges across all apartments.',
  },
  {
    role: 'admin', // alias: apartment_admin
    email: 'admin@smartapartment.demo',
    password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@123',
    name: 'Horizon Community Admin',
    phone: '+91 98765 00002',
    status: 'active',
    apartmentSlug: 'grand-horizon-residences',
    description: 'Apartment administrator authorized for Grand Horizon Residences.',
  },
  {
    role: 'resident',
    email: 'resident@smartapartment.demo',
    password: process.env.DEMO_RESIDENT_PASSWORD || 'Resident@123',
    name: 'Alex Rivera',
    phone: '+91 98765 00003',
    status: 'active',
    apartmentSlug: 'grand-horizon-residences',
    buildingName: 'Tower A',
    flatNumber: '101',
    description: 'Resident assigned to Tower A, Flat 101 in Grand Horizon Residences.',
  },
  {
    role: 'staff', // alias: maintenance_staff
    email: 'staff@smartapartment.demo',
    password: process.env.DEMO_STAFF_PASSWORD || 'Staff@123',
    name: 'Sam Morgan',
    phone: '+91 98765 00004',
    status: 'active',
    apartmentSlug: 'grand-horizon-residences',
    specialization: 'General Maintenance & Plumbing',
    description: 'Maintenance staff member assigned to Grand Horizon Residences.',
  },
];

// ── 3. Relational Fixtures ───────────────────────────────────────────────────
export const DEMO_APARTMENT = {
  name: 'Grand Horizon Residences',
  slug: 'grand-horizon-residences',
  address: '100 Sunset Boulevard, Sector 4',
  city: 'Metropolis',
  state: 'Karnataka',
  postalCode: '560001',
  status: 'approved',
  contactEmail: 'contact@grandhorizon.demo',
  contactPhone: '+91 98765 99999',
  settings: {
    currency: 'INR',
    maintenanceDueDay: 5,
    allowPartialPayments: false,
  },
};

export const DEMO_BUILDING = {
  name: 'Tower A',
  floors: 10,
  totalFlats: 40,
  description: 'Main residential tower',
};

export const DEMO_FLAT = {
  number: '101',
  floor: 1,
  type: '2BHK',
  squareFeet: 1200,
  monthlyMaintenance: 3500,
  status: 'occupied',
};

// ── 4. Password Hashing Helper ──────────────────────────────────────────────
export async function hashPassword(plainPassword) {
  try {
    const { default: bcrypt } = await import('bcryptjs');
    return await bcrypt.hash(plainPassword, 10);
  } catch {
    try {
      const { default: bcrypt } = await import('bcrypt');
      return await bcrypt.hash(plainPassword, 10);
    } catch {
      // Standard cryptographic fallback (scrypt with 16-byte salt)
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
      return `scrypt$${salt}$${hash}`;
    }
  }
}

// ── 5. Mongoose / MongoDB Seeder (when MongoDB URI is available) ─────────────
async function seedViaMongo(mongoUri) {
  let mongoose;
  try {
    const mod = await import('mongoose');
    mongoose = mod.default || mod;
  } catch {
    console.warn('[INFO] Mongoose is not installed in the frontend directory. Install mongoose in backend to run direct DB seeding.');
    return false;
  }

  console.log(`Connecting to MongoDB at: ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;

  console.log('Ensuring development demo apartment...');
  let apartment = await db.collection('apartments').findOne({ slug: DEMO_APARTMENT.slug });
  if (!apartment) {
    const res = await db.collection('apartments').insertOne({
      ...DEMO_APARTMENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    apartment = { _id: res.insertedId, ...DEMO_APARTMENT };
    console.log('✓ Created demo apartment: Grand Horizon Residences');
  } else {
    console.log('✓ Found existing demo apartment: Grand Horizon Residences');
  }

  console.log('Ensuring building and flat...');
  let building = await db.collection('buildings').findOne({
    apartmentId: apartment._id,
    name: DEMO_BUILDING.name,
  });
  if (!building) {
    const res = await db.collection('buildings').insertOne({
      ...DEMO_BUILDING,
      apartmentId: apartment._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    building = { _id: res.insertedId, ...DEMO_BUILDING };
    console.log('✓ Created demo building: Tower A');
  }

  let flat = await db.collection('flats').findOne({
    apartmentId: apartment._id,
    buildingId: building._id,
    number: DEMO_FLAT.number,
  });
  if (!flat) {
    const res = await db.collection('flats').insertOne({
      ...DEMO_FLAT,
      apartmentId: apartment._id,
      buildingId: building._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    flat = { _id: res.insertedId, ...DEMO_FLAT };
    console.log('✓ Created demo flat: Unit 101');
  }

  console.log('\nSeeding demo accounts (with secure bcrypt hash)...');
  for (const acc of DEMO_ACCOUNTS) {
    const existing = await db.collection('users').findOne({ email: acc.email });
    if (existing) {
      console.log(`- Account already exists: ${acc.email} (${acc.role}) — preserving`);
      continue;
    }

    const hashedPassword = await hashPassword(acc.password);
    const userDoc = {
      name: acc.name,
      email: acc.email,
      password: hashedPassword,
      phone: acc.phone,
      role: acc.role,
      status: acc.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (acc.role === 'admin' || acc.role === 'staff') {
      userDoc.apartmentId = apartment._id;
    } else if (acc.role === 'resident') {
      userDoc.apartmentId = apartment._id;
      userDoc.buildingId = building._id;
      userDoc.flatId = flat._id;
    }

    await db.collection('users').insertOne(userDoc);
    console.log(`✓ Seeded ${acc.role.toUpperCase()}: ${acc.email}`);
  }

  await mongoose.disconnect();
  console.log('\nDatabase seeding finished successfully!');
  return true;
}

// ── 6. Verification / HTTP Auth Tester ────────────────────────────────────────
export async function verifyAgainstApi(baseUrl = 'http://localhost:5000/api/v1') {
  const clientLib = baseUrl.startsWith('https') ? https : http;
  const url = new URL(`${baseUrl}/auth/login`);

  console.log(`Testing demo account authentication against: ${url.href}\n`);

  for (const acc of DEMO_ACCOUNTS) {
    const payload = JSON.stringify({ email: acc.email, password: acc.password });

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 3000,
    };

    await new Promise((resolve) => {
      const req = clientLib.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✓ [SUCCESS] ${acc.role.padEnd(16)}: ${acc.email} -> Status ${res.statusCode} (Authenticated)`);
          } else {
            console.log(`✗ [FAILED]  ${acc.role.padEnd(16)}: ${acc.email} -> Status ${res.statusCode} (${data.slice(0, 100)})`);
          }
          resolve();
        });
      });

      req.on('error', (err) => {
        console.log(`! [OFFLINE] ${acc.role.padEnd(16)}: ${acc.email} -> Backend unreachable (${err.message})`);
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
        console.log(`! [TIMEOUT] ${acc.role.padEnd(16)}: ${acc.email} -> Connection timed out`);
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }
}

// ── 7. Main Runner ───────────────────────────────────────────────────────────
async function main() {
  const isVerifyOnly = process.argv.includes('--verify-only');
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

  console.log('================================================================');
  console.log('       SmartApartment Development Demo Accounts Setup           ');
  console.log('================================================================\n');

  console.log('Configured Demo Accounts:');
  DEMO_ACCOUNTS.forEach((a) => {
    console.log(`  • ${a.role.toUpperCase().padEnd(18)} Email: ${a.email.padEnd(32)} Role: ${a.role}`);
  });
  console.log('\nRelational Setup:');
  console.log(`  • Apartment: ${DEMO_APARTMENT.name} (${DEMO_APARTMENT.slug})`);
  console.log(`  • Building:  ${DEMO_BUILDING.name}`);
  console.log(`  • Flat:      Unit ${DEMO_FLAT.number}\n`);

  if (isVerifyOnly) {
    await verifyAgainstApi(apiUrl);
    return;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (mongoUri) {
    try {
      await seedViaMongo(mongoUri);
    } catch (err) {
      console.error('Database seeding failed:', err.message);
    }
  } else {
    console.log('[NOTE] No MONGODB_URI or DATABASE_URL provided.');
    console.log('To seed directly to MongoDB: set MONGODB_URI=mongodb://localhost:27017/smartapartment node scripts/seed-demo-accounts.js\n');
  }

  console.log('Testing connection to backend API...');
  await verifyAgainstApi(apiUrl);
}

// Run if directly executed
main().catch(console.error);
