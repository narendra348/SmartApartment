/**
 * password.js
 *
 * Reusable password security utilities using bcryptjs.
 * Provides secure asynchronous hashing and verification functions.
 * Passwords and hashes are strictly protected and never logged.
 */

import bcrypt from 'bcryptjs';

// Recommended cost factor for bcrypt hashing
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password securely.
 *
 * @param {string} plaintext - Plaintext password to hash
 * @returns {Promise<string>} Generated bcrypt hash
 */
export async function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || !plaintext) {
    throw new Error('A valid non-empty plaintext password string is required for hashing.');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plaintext, salt);
}

/**
 * Compare a plaintext password with a stored bcrypt hash.
 *
 * @param {string} plaintext - Plaintext candidate password
 * @param {string} hash - Stored bcrypt password hash
 * @returns {Promise<boolean>} True if matching, false otherwise
 */
export async function comparePassword(plaintext, hash) {
  if (typeof plaintext !== 'string' || typeof hash !== 'string') {
    return false;
  }

  if (!plaintext || !hash) {
    return false;
  }

  return bcrypt.compare(plaintext, hash);
}

/**
 * Helper to determine if a string is already a formatted bcrypt hash.
 * Prevents double-hashing existing hashes.
 *
 * @param {string} str - Candidate string
 * @returns {boolean} True if formatted as a bcrypt hash
 */
export function isHashedPassword(str) {
  if (typeof str !== 'string') return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(str);
}

export default {
  hashPassword,
  comparePassword,
  isHashedPassword,
};
