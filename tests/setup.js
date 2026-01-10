/**
 * Vitest Test Setup File
 *
 * This file runs before all tests. Use it to:
 * - Load environment variables
 * - Set up global mocks
 * - Configure test database connections
 * - Define global test utilities
 *
 * Note: Vitest globals (describe, it, expect, vi, beforeAll, etc.) are available
 * because globals: true is set in vitest.config.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testEnvPath = path.resolve(__dirname, '../.env.test');
const defaultEnvPath = path.resolve(__dirname, '../.env');

// Try to load test environment first, fall back to default
try {
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath });
  } else {
    dotenv.config({ path: defaultEnvPath });
  }
} catch (error) {
  // Environment files may not exist in CI environments
  console.warn('Could not load environment files:', error.message);
}

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Global test hooks
beforeAll(async () => {
  // Add any global setup here
  // For example: initialize test database connection
});

afterAll(async () => {
  // Add any global cleanup here
  // For example: close database connections, cleanup test data
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified number of milliseconds
   * @param {number} ms - Milliseconds to wait
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a mock Express request object
   * @param {object} overrides - Properties to override
   */
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ...overrides
  }),

  /**
   * Create a mock Express response object
   */
  mockResponse: () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    res.cookie = vi.fn().mockReturnValue(res);
    res.clearCookie = vi.fn().mockReturnValue(res);
    res.redirect = vi.fn().mockReturnValue(res);
    res.set = vi.fn().mockReturnValue(res);
    return res;
  },

  /**
   * Create a mock next function for Express middleware
   */
  mockNext: () => vi.fn()
};

// Suppress console output during tests (optional - comment out if you need to see logs)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});
