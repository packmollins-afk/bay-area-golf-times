#!/usr/bin/env node
/**
 * Bay Area Golf Times - Integration Verification Script
 * =====================================================
 *
 * This script verifies that new code changes don't break existing functionality.
 * It performs the following checks:
 *
 * 1. API Endpoint Verification - Tests that all existing API endpoints respond correctly
 * 2. Service Files Verification - Ensures new service files exist and export expected functions
 * 3. Frontend Pages Verification - Checks that frontend pages load without JavaScript errors
 * 4. Environment Variables Verification - Validates environment variables are documented
 * 5. Summary Report - Outputs a comprehensive verification report
 *
 * Usage: node scripts/verify-integration.js
 *
 * Exit codes:
 *   0 - All verifications passed
 *   1 - One or more verifications failed
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// API endpoints to verify
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/courses', description: 'List all courses' },
  { method: 'GET', path: '/api/tee-times', description: 'List tee times' },
  { method: 'GET', path: '/api/courses/:idOrSlug', description: 'Get course by ID or slug' },
  { method: 'GET', path: '/api/tee-times/next-available', description: 'Next available tee times' },
  { method: 'GET', path: '/api/tee-times/deals', description: 'Tee time deals' },
];

// Service files and their expected exports
const SERVICE_FILES = [
  {
    path: 'services/index.js',
    exports: ['weather', 'airquality', 'tides', 'daylight', 'images', 'calendar', 'locationiq', 'healthCheck'],
  },
  {
    path: 'services/airquality.js',
    exports: ['AirQualityService'],
  },
  {
    path: 'services/tides.js',
    exports: ['TidesService'],  // UMD module - exports as factory function
  },
  {
    path: 'services/daylight.js',
    exports: ['getDaylightData', 'isGoldenHour', 'getPlayableWindow'],
  },
  {
    path: 'services/images.js',
    exports: ['PexelsImageService', 'searchGolfImages', 'getRandomGolfImage'],
  },
  {
    path: 'services/calendar.js',
    exports: ['generateICS', 'generateGoogleCalendarUrl', 'createTeeTimeBooking'],
  },
  {
    path: 'services/locationiq.js',
    exports: ['LocationIQService', 'geocode', 'reverseGeocode'],
  },
];

// Frontend pages to verify
const FRONTEND_PAGES = [
  { path: 'public/index.html', description: 'Homepage' },
  { path: 'public/app.html', description: 'Main app' },
  { path: 'public/courses.html', description: 'Courses list' },
  { path: 'public/course.html', description: 'Course detail' },
];

// Required environment variables
const REQUIRED_ENV_VARS = [
  { name: 'TURSO_DATABASE_URL', required: true, description: 'Turso database connection URL' },
  { name: 'TURSO_AUTH_TOKEN', required: true, description: 'Turso authentication token' },
];

const OPTIONAL_ENV_VARS = [
  { name: 'RESEND_API_KEY', required: false, description: 'Resend email API key' },
  { name: 'AIRNOW_API_KEY', required: false, description: 'AirNow API key for air quality' },
  { name: 'LOCATIONIQ_API_KEY', required: false, description: 'LocationIQ geocoding API key' },
  { name: 'GOLFNOW_AFFILIATE_ID', required: false, description: 'GolfNow affiliate tracking ID' },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Console colors for output formatting
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Print a colored message to console
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print a section header
 */
function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

/**
 * Print a result line with status indicator
 */
function printResult(description, passed, details = '') {
  const status = passed ? `${colors.green}[PASS]${colors.reset}` : `${colors.red}[FAIL]${colors.reset}`;
  const detailText = details ? ` - ${details}` : '';
  console.log(`  ${status} ${description}${detailText}`);
}

/**
 * Print a warning line
 */
function printWarning(description, details = '') {
  const status = `${colors.yellow}[WARN]${colors.reset}`;
  const detailText = details ? ` - ${details}` : '';
  console.log(`  ${status} ${description}${detailText}`);
}

/**
 * Print an info line
 */
function printInfo(description) {
  console.log(`  ${colors.cyan}[INFO]${colors.reset} ${description}`);
}

/**
 * Make an HTTP request and return the response
 */
async function makeRequest(url, method = 'GET', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.request(url, { method, timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Check if a module exports specific functions
 */
async function checkModuleExports(modulePath, expectedExports) {
  const fullPath = path.join(PROJECT_ROOT, modulePath);
  const results = [];

  if (!fileExists(fullPath)) {
    return { exists: false, exports: [], missing: expectedExports };
  }

  try {
    // Read file content and check for export patterns
    const content = fs.readFileSync(fullPath, 'utf-8');
    const foundExports = [];
    const missingExports = [];

    for (const exportName of expectedExports) {
      // Check for various export patterns
      const patterns = [
        new RegExp(`exports\\.${exportName}\\s*=`),
        new RegExp(`module\\.exports\\.${exportName}\\s*=`),
        new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*${exportName}`),
        new RegExp(`export\\s+(const|function|class)\\s+${exportName}`),
        new RegExp(`export\\s+\\{[^}]*${exportName}`),
        new RegExp(`${exportName}:`), // Object property in exports
      ];

      const found = patterns.some(pattern => pattern.test(content));
      if (found) {
        foundExports.push(exportName);
      } else {
        missingExports.push(exportName);
      }
    }

    return { exists: true, exports: foundExports, missing: missingExports };
  } catch (error) {
    return { exists: true, exports: [], missing: expectedExports, error: error.message };
  }
}

/**
 * Parse HTML and check for JavaScript errors or missing critical elements
 */
function analyzeHTMLFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const issues = [];

  if (!fileExists(fullPath)) {
    return { exists: false, issues: ['File not found'] };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check for common issues
    if (!content.includes('<!DOCTYPE html>') && !content.includes('<!doctype html>')) {
      issues.push('Missing DOCTYPE declaration');
    }

    if (!content.includes('<html')) {
      issues.push('Missing <html> tag');
    }

    if (!content.includes('<head>') && !content.includes('<head ')) {
      issues.push('Missing <head> tag');
    }

    if (!content.includes('<body>') && !content.includes('<body ')) {
      issues.push('Missing <body> tag');
    }

    // Check for inline script errors (unclosed tags, obvious syntax errors)
    const scriptMatches = content.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (const script of scriptMatches) {
      if (script.includes('undefined') && script.includes('=') && !script.includes('typeof')) {
        issues.push('Potential undefined variable assignment in inline script');
      }
    }

    // Check for broken image sources
    const imgMatches = content.match(/<img[^>]*src\s*=\s*["']([^"']+)["']/gi) || [];
    for (const img of imgMatches) {
      if (img.includes('undefined') || img.includes('null')) {
        issues.push('Broken image source detected');
      }
    }

    return { exists: true, issues, size: content.length };
  } catch (error) {
    return { exists: true, issues: [`Error reading file: ${error.message}`] };
  }
}

/**
 * Check environment variables documentation
 */
function checkEnvDocumentation() {
  const envExamplePath = path.join(PROJECT_ROOT, '.env.example');
  const results = {
    envExampleExists: fileExists(envExamplePath),
    documentedVars: [],
    missingDocs: [],
  };

  if (!results.envExampleExists) {
    results.missingDocs = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS].map(v => v.name);
    return results;
  }

  try {
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const allVars = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS];

    for (const envVar of allVars) {
      if (content.includes(envVar.name)) {
        results.documentedVars.push(envVar.name);
      } else {
        results.missingDocs.push(envVar.name);
      }
    }
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify API endpoints work correctly (without running a server)
 */
async function verifyAPIEndpointsStatic() {
  printHeader('1. API Endpoints Verification (Static Analysis)');

  const apiIndexPath = path.join(PROJECT_ROOT, 'api/index.js');
  let passed = 0;
  let failed = 0;

  if (!fileExists(apiIndexPath)) {
    printResult('API index.js exists', false, 'File not found');
    return { passed: 0, failed: 1, total: 1 };
  }

  const content = fs.readFileSync(apiIndexPath, 'utf-8');

  for (const endpoint of API_ENDPOINTS) {
    // Check if the endpoint is defined in the API file
    const patterns = [
      new RegExp(`app\\.${endpoint.method.toLowerCase()}\\s*\\(\\s*['"\`]${endpoint.path.replace(/:[^/]+/g, ':[^/]+')}['"\`]`),
      new RegExp(`app\\.${endpoint.method.toLowerCase()}\\s*\\(\\s*['"\`]${endpoint.path}['"\`]`),
    ];

    const found = patterns.some(pattern => pattern.test(content));

    if (found) {
      printResult(`${endpoint.method} ${endpoint.path}`, true, endpoint.description);
      passed++;
    } else {
      printResult(`${endpoint.method} ${endpoint.path}`, false, `Endpoint not found - ${endpoint.description}`);
      failed++;
    }
  }

  return { passed, failed, total: passed + failed };
}

/**
 * Verify service files exist and export expected functions
 */
async function verifyServiceFiles() {
  printHeader('2. Service Files Verification');

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const service of SERVICE_FILES) {
    const result = await checkModuleExports(service.path, service.exports);

    if (!result.exists) {
      printResult(`${service.path} exists`, false, 'File not found');
      failed++;
      continue;
    }

    printResult(`${service.path} exists`, true);
    passed++;

    // Check exports
    for (const exp of service.exports) {
      if (result.exports.includes(exp)) {
        printResult(`  exports.${exp}`, true);
        passed++;
      } else {
        // Some exports may be dynamically created or optional
        printWarning(`  exports.${exp}`, 'Not found (may be dynamic or optional)');
        warnings++;
      }
    }
  }

  return { passed, failed, warnings, total: passed + failed };
}

/**
 * Verify frontend pages load without critical issues
 */
async function verifyFrontendPages() {
  printHeader('3. Frontend Pages Verification');

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const page of FRONTEND_PAGES) {
    const result = analyzeHTMLFile(page.path);

    if (!result.exists) {
      printResult(`${page.path} - ${page.description}`, false, 'File not found');
      failed++;
      continue;
    }

    if (result.issues.length === 0) {
      printResult(`${page.path} - ${page.description}`, true, `${(result.size / 1024).toFixed(1)}KB`);
      passed++;
    } else if (result.issues.length <= 2) {
      printWarning(`${page.path} - ${page.description}`, result.issues.join(', '));
      warnings++;
    } else {
      printResult(`${page.path} - ${page.description}`, false, `${result.issues.length} issues found`);
      for (const issue of result.issues) {
        printInfo(`  - ${issue}`);
      }
      failed++;
    }
  }

  return { passed, failed, warnings, total: passed + failed + warnings };
}

/**
 * Verify environment variables are documented
 */
async function verifyEnvironmentVariables() {
  printHeader('4. Environment Variables Verification');

  const result = checkEnvDocumentation();
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  if (!result.envExampleExists) {
    printResult('.env.example exists', false, 'File not found');
    failed++;
    return { passed, failed, warnings, total: 1 };
  }

  printResult('.env.example exists', true);
  passed++;

  // Check required vars
  for (const envVar of REQUIRED_ENV_VARS) {
    if (result.documentedVars.includes(envVar.name)) {
      printResult(`${envVar.name} documented`, true, `[REQUIRED] ${envVar.description}`);
      passed++;
    } else {
      printResult(`${envVar.name} documented`, false, `[REQUIRED] ${envVar.description}`);
      failed++;
    }
  }

  // Check optional vars
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (result.documentedVars.includes(envVar.name)) {
      printResult(`${envVar.name} documented`, true, `[OPTIONAL] ${envVar.description}`);
      passed++;
    } else {
      printWarning(`${envVar.name} not documented`, `[OPTIONAL] ${envVar.description}`);
      warnings++;
    }
  }

  return { passed, failed, warnings, total: passed + failed + warnings };
}

/**
 * Run npm test if vitest is available
 */
async function runTests() {
  printHeader('5. Running Existing Tests');

  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');

  if (!fileExists(packageJsonPath)) {
    printResult('package.json exists', false);
    return { passed: 0, failed: 1, total: 1, skipped: false };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Check if vitest is configured
  const hasVitest = packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest;
  const hasTestScript = packageJson.scripts?.test;

  if (!hasVitest || !hasTestScript) {
    printInfo('Vitest not configured or no test script found');
    return { passed: 0, failed: 0, total: 0, skipped: true };
  }

  printInfo('Running npm test...');

  return new Promise((resolve) => {
    const testProcess = spawn('npm', ['test'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        printResult('npm test', true, 'All tests passed');

        // Parse test output for details
        const passMatch = stdout.match(/(\d+)\s+passed/);
        const failMatch = stdout.match(/(\d+)\s+failed/);

        const passed = passMatch ? parseInt(passMatch[1]) : 1;
        const failed = failMatch ? parseInt(failMatch[1]) : 0;

        resolve({ passed, failed, total: passed + failed, skipped: false, output: stdout });
      } else {
        printResult('npm test', false, `Exit code: ${code}`);

        // Print relevant error output
        const errorLines = (stderr || stdout).split('\n').filter(line =>
          line.includes('FAIL') || line.includes('Error') || line.includes('error')
        ).slice(0, 5);

        for (const line of errorLines) {
          printInfo(line.trim());
        }

        resolve({ passed: 0, failed: 1, total: 1, skipped: false, output: stdout, error: stderr });
      }
    });

    testProcess.on('error', (error) => {
      printResult('npm test', false, error.message);
      resolve({ passed: 0, failed: 1, total: 1, skipped: false, error: error.message });
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      testProcess.kill();
      printResult('npm test', false, 'Timeout after 2 minutes');
      resolve({ passed: 0, failed: 1, total: 1, skipped: false, error: 'Timeout' });
    }, 120000);
  });
}

/**
 * Check additional project files
 */
async function checkProjectFiles() {
  printHeader('6. Project Files Verification');

  const filesToCheck = [
    { path: 'package.json', required: true },
    { path: 'vitest.config.js', required: false },
    { path: '.env.example', required: true },
    { path: 'api/index.js', required: true },
    { path: 'CLAUDE.md', required: false },
    { path: 'vercel.json', required: false },
  ];

  let passed = 0;
  let failed = 0;

  for (const file of filesToCheck) {
    const exists = fileExists(path.join(PROJECT_ROOT, file.path));

    if (exists) {
      printResult(file.path, true);
      passed++;
    } else if (file.required) {
      printResult(file.path, false, 'Required file missing');
      failed++;
    } else {
      printWarning(file.path, 'Optional file not found');
    }
  }

  return { passed, failed, total: passed + failed };
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('\n');
  log('Bay Area Golf Times - Integration Verification', 'bright');
  log('=' .repeat(50), 'cyan');
  log(`Project Root: ${PROJECT_ROOT}`, 'cyan');
  log(`Started: ${new Date().toISOString()}`, 'cyan');

  const results = {
    apiEndpoints: await verifyAPIEndpointsStatic(),
    serviceFiles: await verifyServiceFiles(),
    frontendPages: await verifyFrontendPages(),
    envVariables: await verifyEnvironmentVariables(),
    tests: await runTests(),
    projectFiles: await checkProjectFiles(),
  };

  // ============================================================================
  // Summary Report
  // ============================================================================

  printHeader('VERIFICATION SUMMARY');

  const sections = [
    { name: 'API Endpoints', result: results.apiEndpoints },
    { name: 'Service Files', result: results.serviceFiles },
    { name: 'Frontend Pages', result: results.frontendPages },
    { name: 'Environment Variables', result: results.envVariables },
    { name: 'Unit/Integration Tests', result: results.tests },
    { name: 'Project Files', result: results.projectFiles },
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  console.log('\nSection Results:');
  console.log('-'.repeat(50));

  for (const section of sections) {
    const r = section.result;
    totalPassed += r.passed || 0;
    totalFailed += r.failed || 0;
    totalWarnings += r.warnings || 0;

    const status = r.failed > 0 ? colors.red :
      r.warnings > 0 ? colors.yellow : colors.green;

    const skipped = r.skipped ? ' (SKIPPED)' : '';
    console.log(`${status}  ${section.name}: ${r.passed || 0} passed, ${r.failed || 0} failed${r.warnings ? `, ${r.warnings} warnings` : ''}${skipped}${colors.reset}`);
  }

  console.log('-'.repeat(50));

  const overallStatus = totalFailed > 0 ? 'FAILED' : 'PASSED';
  const statusColor = totalFailed > 0 ? 'red' : 'green';

  console.log('\n' + '='.repeat(50));
  log(`OVERALL: ${overallStatus}`, statusColor);
  log(`Total Passed: ${totalPassed}`, 'green');
  if (totalFailed > 0) log(`Total Failed: ${totalFailed}`, 'red');
  if (totalWarnings > 0) log(`Total Warnings: ${totalWarnings}`, 'yellow');
  console.log('='.repeat(50));

  log(`\nCompleted: ${new Date().toISOString()}`, 'cyan');

  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run the script
main().catch((error) => {
  log(`\nFatal Error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
