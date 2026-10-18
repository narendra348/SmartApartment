/**
 * env.js
 *
 * Validates and exposes application environment variables with sanitized masking helpers.
 * Never exposes passwords or sensitive credentials in logs.
 */

import 'dotenv/config';

/**
 * Mask sensitive credentials in connection strings (e.g. passwords in Atlas / standard URIs).
 */
export function maskMongoUri(uri) {
  if (!uri) return 'not_configured';
  // Replace credentials :password@ with :*****@
  return uri.replace(/:([^@/]+)@/, ':*****@');
}

/**
 * Validate required and optional environment configuration.
 * Returns an object with parsed configuration or throws descriptive errors.
 */
export function getEnvConfig() {
  const port = parseInt(process.env.PORT, 10) || 5000;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`[Config Error] Invalid PORT specified: "${process.env.PORT}". Must be a number between 1 and 65535.`);
  }

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
  const mongoUri = (process.env.MONGODB_URI || '').trim();
  const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret-change-in-production';
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    PORT: port,
    CLIENT_URL: clientUrl,
    MONGODB_URI: mongoUri,
    SESSION_SECRET: sessionSecret,
    NODE_ENV: nodeEnv,
  };
}

export const env = getEnvConfig();
