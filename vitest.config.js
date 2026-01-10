import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use Node.js environment for backend testing
    environment: 'node',

    // Setup file to run before tests
    setupFiles: ['./tests/setup.js'],

    // Include test files matching these patterns
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],

    // Exclude node_modules and other non-test directories
    exclude: ['node_modules', 'public', 'scripts'],

    // Global test timeout (10 seconds for unit tests, integration tests have longer timeouts)
    testTimeout: 10000,

    // Hook timeout for beforeAll, afterAll, etc. (longer for integration tests with network calls)
    hookTimeout: 30000,

    // Enable globals (describe, it, expect) without imports
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js', 'api/**/*.js'],
      exclude: [
        'node_modules',
        'tests',
        'scripts',
        'public',
        '**/*.config.js'
      ]
    },

    // Reporter configuration
    reporters: ['default'],

    // Run tests in sequence (useful for database tests)
    sequence: {
      shuffle: false
    }
  }
});
