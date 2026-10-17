/**
 * login-test.mjs — Quick integration smoke test for demo accounts.
 * Verifies health endpoint and all 4 demo account logins.
 */
import http from 'node:http';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/database.js';

const connected = await connectDB();
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api/v1`;

async function post(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
}

async function get(path) {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, json: await r.json() };
}

// Health check
const health = await get('/health');
console.log(`[Health] HTTP ${health.status} | DB connected: ${health.json.database.connected} | ${health.json.message}`);

// Demo account logins
const accounts = [
  { role: 'SUPER_ADMIN',       email: 'superadmin@smartapartment.demo', password: 'SuperAdmin@123' },
  { role: 'APARTMENT_ADMIN',   email: 'admin@smartapartment.demo',      password: 'Admin@123' },
  { role: 'RESIDENT',          email: 'resident@smartapartment.demo',   password: 'Resident@123' },
  { role: 'MAINTENANCE_STAFF', email: 'staff@smartapartment.demo',      password: 'Staff@123' },
];

let allPassed = true;
for (const acc of accounts) {
  const r = await post('/auth/login', { email: acc.email, password: acc.password });
  const user = r.json?.data?.user ?? r.json?.data;
  const role = user?.role ?? '—';
  const ok = r.status === 200 && r.json?.success === true;
  if (!ok) allPassed = false;
  console.log(`[Login] ${ok ? '✓' : '✗'} ${acc.role.padEnd(18)} | HTTP ${r.status} | role=${role} | email=${acc.email}`);
}

server.close();
if (connected) await disconnectDB();
process.exit(allPassed ? 0 : 1);
