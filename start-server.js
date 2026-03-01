import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting RK Electronics Backend Server...');

// Check if Node.js is installed
exec('node --version', (error, stdout, stderr) => {
  if (error) {
    console.error('Node.js is not installed. Please install Node.js first.');
    process.exit(1);
  }
});

// Check if npm is installed
exec('npm --version', (error, stdout, stderr) => {
  if (error) {
    console.error('npm is not installed. Please install npm first.');
    process.exit(1);
  }
});

// Install dependencies
console.log('Installing dependencies...');
exec('npm install', { cwd: __dirname }, (error, stdout, stderr) => {
  if (error) {
    console.error('Error installing dependencies:', error.message);
    process.exit(1);
  }

  // Run the server
  console.log('Starting the server...');
  exec('npm run dev', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error('Error starting server:', error.message);
      process.exit(1);
    }
  });
});
