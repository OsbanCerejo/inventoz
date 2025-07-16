#!/usr/bin/env node

// EasyPanel startup script
const { spawn } = require('child_process');
const path = require('path');


// Log all environment variables for debugging
console.log('Environment Variables:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- DB_HOST:', process.env.DB_HOST || 'not set');
console.log('- DB_NAME:', process.env.DB_NAME || 'not set');

// Start the main application
const child = spawn('node', ['index.js'], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start child process:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  child.kill('SIGINT');
}); 