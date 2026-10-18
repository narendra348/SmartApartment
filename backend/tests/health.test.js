/**
 * health.test.js
 *
 * Automated tests for the Express health endpoint:
 * - GET /api/v1/health returns HTTP 200 with status "ok"
 * - Accurately reports server message, uptime, and timestamp
 * - Accurately reflects database connection status (connected vs disconnected)
 * - Verifies route registration precedence before the catch-all 404 handler
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('GET /api/v1/health - Express Health Endpoint', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('should return HTTP 200 with status "ok" and server running message', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(
      typeof body.message === 'string' && body.message.toLowerCase().includes('running'),
      `Expected message to indicate server is running, got: "${body.message}"`,
    );
    assert.ok(typeof body.uptime === 'number' && body.uptime >= 0);
    assert.ok(!isNaN(Date.parse(body.timestamp)));
    assert.ok(typeof body.database === 'object' && body.database !== null);
  });

  it('should accurately report disconnected database when DB is offline', async () => {
    await disconnectDB();

    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.database.connected, false);
    assert.equal(body.database.state, 'disconnected');
  });

  it('should accurately report connected database when DB is online', async () => {
    const connected = await connectDB();
    if (!connected) {
      console.warn('Skipping live DB check; local MongoDB not reachable.');
      return;
    }

    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.database.connected, true);
    assert.equal(body.database.state, 'connected');
  });

  it('should ensure health route is hit before the catch-all 404 handler', async () => {
    // Health endpoint must succeed (200)
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(healthRes.status, 200);

    // Unregistered path should fall through to 404
    const notFoundRes = await fetch(`${baseUrl}/api/v1/non-existent-route`);
    assert.equal(notFoundRes.status, 404);
  });

  it('should return HTTP 200 with service info on GET /', async () => {
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const body = await rootRes.json();
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.message === 'string');
    assert.equal(body.endpoints.health, '/api/v1/health');
  });
});

describe('MongoDB URI Sanitization Regression Suite', () => {
  it('should clean trailing semicolons, quotes, and w=majority; query params', async () => {
    const { sanitizeMongoUri } = await import('../src/config/env.js');

    assert.equal(
      sanitizeMongoUri('mongodb+srv://user:pass@cluster0.net/smartapartment?retryWrites=true&w=majority;'),
      'mongodb+srv://user:pass@cluster0.net/smartapartment?retryWrites=true&w=majority',
    );
    assert.equal(
      sanitizeMongoUri('"mongodb+srv://user:pass@cluster0.net/smartapartment?retryWrites=true&w=majority;"'),
      'mongodb+srv://user:pass@cluster0.net/smartapartment?retryWrites=true&w=majority',
    );
    assert.equal(
      sanitizeMongoUri('mongodb+srv://user:pass@cluster0.net/smartapartment?w=majority;&retryWrites=true'),
      'mongodb+srv://user:pass@cluster0.net/smartapartment?w=majority&retryWrites=true',
    );
    assert.equal(
      sanitizeMongoUri('mongodb://127.0.0.1:27017/smartapartment;'),
      'mongodb://127.0.0.1:27017/smartapartment',
    );
    assert.equal(
      sanitizeMongoUri('  mongodb+srv://user:pass@cluster0.net/smartapartment?retryWrites=true&w=majority;  '),
      'mongodb+srv://user:pass@cluster0.net/smartapartment?retryWrites=true&w=majority',
    );
  });
});
