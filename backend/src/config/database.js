/**
 * database.js
 *
 * Reusable asynchronous MongoDB connection manager using Mongoose.
 * Supports both local MongoDB instances and MongoDB Atlas clusters.
 *
 * Features:
 * - Prevents duplicate connections.
 * - Handles disconnections and connection errors gracefully.
 * - Sanitizes connection string in logs (never exposes credentials/passwords).
 * - Implements graceful shutdown handlers.
 */

import mongoose from 'mongoose';
import { env, maskMongoUri } from './env.js';

const STATE_NAMES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersRegistered = false;

function registerConnectionEvents() {
  if (listenersRegistered) return;

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Connection established successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB Error]', err.message || err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Database connection disconnected');
  });

  listenersRegistered = true;
}

/**
 * Connect to MongoDB using the configured MONGODB_URI.
 *
 * @param {string} [customUri] - Optional override URI for testing
 * @returns {Promise<boolean>} True if connected, false if failed
 */
export async function connectDB(customUri) {
  const uri = (customUri !== undefined ? customUri : env.MONGODB_URI || '').trim();

  if (!uri) {
    console.error('[MongoDB Config Error] MONGODB_URI environment variable is missing or empty.');
    return false;
  }

  // Prevent duplicate connections if already connected or currently connecting
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoDB] Already connected to database');
    return true;
  }

  if (mongoose.connection.readyState === 2) {
    console.log('[MongoDB] Connection already in progress, awaiting resolution...');
    return new Promise((resolve) => {
      mongoose.connection.once('connected', () => resolve(true));
      mongoose.connection.once('error', () => resolve(false));
    });
  }

  registerConnectionEvents();

  const maskedUri = maskMongoUri(uri);
  console.log(`[MongoDB] Connecting to ${maskedUri}...`);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if server unreachable
      autoIndex: env.NODE_ENV !== 'production',
    });
    console.log(`[MongoDB] Successfully connected to database: ${mongoose.connection.name || 'default'}`);
    return true;
  } catch (err) {
    console.error(`[MongoDB Connection Failed] Unable to connect to ${maskedUri}: ${err.message}`);
    return false;
  }
}

/**
 * Gracefully close the MongoDB connection.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      console.log('[MongoDB] Database connection closed cleanly');
    } catch (err) {
      console.error('[MongoDB Disconnect Error]', err.message);
    }
  }
}

/**
 * Check if the database connection is currently active.
 * @returns {boolean}
 */
export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get human-readable connection state.
 * @returns {'connected' | 'connecting' | 'disconnecting' | 'disconnected'}
 */
export function getDbState() {
  return STATE_NAMES[mongoose.connection.readyState] || 'disconnected';
}

export default {
  connectDB,
  disconnectDB,
  isDbConnected,
  getDbState,
};
