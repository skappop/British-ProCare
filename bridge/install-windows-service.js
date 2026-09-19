/**
 * Windows Service Installer for Osstem Bridge
 *
 * Run with: node install-windows-service.js
 * Requires Administrator privileges
 */

const Service = require('node-windows').Service

// Create a new service object
const svc = new Service({
  name: 'Osstem Hardware Bridge',
  description: 'Automatically uploads Osstem captures to ProCare Clinic',
  script: require('path').join(__dirname, 'osstem-bridge.js'),
  nodeOptions: [],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
})

// Listen for the "install" event
svc.on('install', function() {
  console.log('✓ Service installed successfully')
  console.log('Starting service...')
  svc.start()
})

svc.on('start', function() {
  console.log('✓ Service started')
  console.log('Check logs at:', require('path').join(__dirname, 'bridge.log'))
})

svc.on('error', function(err) {
  console.error('Service error:', err)
})

// Install the service
console.log('Installing Osstem Hardware Bridge service...')
console.log('This requires Administrator privileges')
svc.install()
