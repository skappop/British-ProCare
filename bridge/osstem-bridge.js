/**
 * Osstem Hardware Bridge Service
 *
 * This service monitors Osstem output folders and automatically uploads
 * captured images to your Next.js patient hub, linked to the active patient.
 *
 * Installation:
 *   1. npm install chokidar form-data node-fetch@2
 *   2. Copy .env.bridge.example to .env.bridge and configure
 *   3. Run: node osstem-bridge.js
 *
 * For production: Install as Windows Service using node-windows
 */

const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const fetch = require('node-fetch')

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Your Next.js application URL
  API_BASE_URL: process.env.API_BASE_URL || 'https://your-app.vercel.app',

  // API key for authentication (set in .env.local on Next.js side)
  BRIDGE_API_KEY: process.env.BRIDGE_API_KEY || 'your-secure-api-key-here',

  // Osstem output folders to watch
  WATCH_FOLDERS: [
    process.env.OSSTEM_INTRAORAL_FOLDER || 'C:\\Osstem\\Images',
    process.env.OSSTEM_XRAY_FOLDER || 'C:\\Osstem\\Xrays',
    process.env.OSSTEM_DICOM_FOLDER || 'C:\\Osstem\\DICOM',
  ],

  // How often to check for active patient (milliseconds)
  POLL_INTERVAL: 2000, // 2 seconds

  // Debounce delay to ensure file is fully written (milliseconds)
  FILE_STABLE_DELAY: 1000, // 1 second

  // Supported file extensions
  SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.bmp', '.dcm', '.dicom'],

  // Log file location
  LOG_FILE: process.env.LOG_FILE || path.join(__dirname, 'bridge.log'),
}

// ============================================================================
// STATE
// ============================================================================

let activePatientId = null
let lastPatientCheck = 0
let processingFiles = new Set() // Track files currently being processed

// ============================================================================
// LOGGING
// ============================================================================

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${level}] ${message}\n`

  console.log(logMessage.trim())

  try {
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage)
  } catch (err) {
    console.error('Failed to write to log file:', err)
  }
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

async function getActivePatient() {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/bridge/active-patient`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.BRIDGE_API_KEY}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        log('Authentication failed - check BRIDGE_API_KEY', 'ERROR')
      }
      return null
    }

    const data = await response.json()
    return data.patient_id
  } catch (error) {
    log(`Failed to fetch active patient: ${error.message}`, 'ERROR')
    return null
  }
}

async function uploadImage(filePath, patientId) {
  try {
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // Determine image type from filename or path
    const imageType = detectImageType(filePath)

    log(`Uploading ${fileName} for patient ${patientId} (type: ${imageType})`)

    const formData = new FormData()
    formData.append('file', fs.createReadStream(filePath), fileName)
    formData.append('patient_id', patientId)
    formData.append('image_type', imageType)

    // Add metadata
    const metadata = {
      source: 'osstem-bridge',
      original_filename: fileName,
      captured_at: new Date().toISOString(),
    }
    formData.append('metadata', JSON.stringify(metadata))

    const response = await fetch(`${CONFIG.API_BASE_URL}/api/bridge/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.BRIDGE_API_KEY}`,
      },
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      log(`Upload failed: ${result.error}`, 'ERROR')
      return false
    }

    log(`✓ Upload successful: ${result.image_id} (${result.category})`, 'SUCCESS')
    return true
  } catch (error) {
    log(`Upload error: ${error.message}`, 'ERROR')
    return false
  }
}

// ============================================================================
// IMAGE TYPE DETECTION
// ============================================================================

function detectImageType(filePath) {
  const fileName = path.basename(filePath).toLowerCase()
  const dirName = path.dirname(filePath).toLowerCase()

  // Check for X-ray/DICOM patterns
  if (fileName.includes('xray') || fileName.includes('x-ray') ||
      fileName.includes('pano') || fileName.includes('ceph') ||
      dirName.includes('xray') || dirName.includes('dicom') ||
      fileName.endsWith('.dcm') || fileName.endsWith('.dicom')) {

    if (fileName.includes('pano')) return 'panoramic'
    if (fileName.includes('ceph')) return 'cephalometric'
    return 'xray'
  }

  // Check for intraoral camera patterns
  if (fileName.includes('intra') || dirName.includes('intra') ||
      dirName.includes('images') || dirName.includes('camera')) {

    if (fileName.includes('front')) return 'intraoral_front'
    if (fileName.includes('left')) return 'intraoral_left'
    if (fileName.includes('right')) return 'intraoral_right'
    if (fileName.includes('upper') || fileName.includes('maxilla')) return 'occlusal_upper'
    if (fileName.includes('lower') || fileName.includes('mandib')) return 'occlusal_lower'

    return 'intraoral_front'
  }

  return 'other'
}

// ============================================================================
// FILE WATCHER
// ============================================================================

async function handleNewFile(filePath) {
  const fileName = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()

  // Check if file extension is supported
  if (!CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
    return
  }

  // Prevent duplicate processing
  if (processingFiles.has(filePath)) {
    return
  }

  processingFiles.add(filePath)
  log(`New file detected: ${fileName}`)

  try {
    // Wait for file to be fully written (Osstem may write in chunks)
    await new Promise(resolve => setTimeout(resolve, CONFIG.FILE_STABLE_DELAY))

    // Check if file still exists and is readable
    if (!fs.existsSync(filePath)) {
      log(`File disappeared: ${fileName}`, 'WARN')
      processingFiles.delete(filePath)
      return
    }

    // Get active patient
    const patientId = await getActivePatient()

    if (!patientId) {
      log(`No active patient - skipping ${fileName}`, 'WARN')
      log('TIP: Open a patient page in the web app to set active patient', 'INFO')
      processingFiles.delete(filePath)
      return
    }

    // Upload the image
    const success = await uploadImage(filePath, patientId)

    if (success) {
      // Optional: Move processed file to archive folder
      // archiveFile(filePath)
    }

  } catch (error) {
    log(`Error processing ${fileName}: ${error.message}`, 'ERROR')
  } finally {
    processingFiles.delete(filePath)
  }
}

function archiveFile(filePath) {
  try {
    const archiveDir = path.join(path.dirname(filePath), '_processed')
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true })
    }

    const fileName = path.basename(filePath)
    const archivePath = path.join(archiveDir, fileName)

    fs.renameSync(filePath, archivePath)
    log(`Archived: ${fileName}`)
  } catch (error) {
    log(`Failed to archive ${filePath}: ${error.message}`, 'WARN')
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log('='.repeat(70))
  log('Osstem Hardware Bridge Service Starting...')
  log('='.repeat(70))
  log(`API Base URL: ${CONFIG.API_BASE_URL}`)
  log(`Active patient poll interval: ${CONFIG.POLL_INTERVAL}ms`)
  log(`Watching folders:`)

  const validFolders = []

  for (const folder of CONFIG.WATCH_FOLDERS) {
    if (fs.existsSync(folder)) {
      log(`  ✓ ${folder}`)
      validFolders.push(folder)
    } else {
      log(`  ✗ ${folder} (NOT FOUND - will be created if files appear)`, 'WARN')
      // Still add to watcher - chokidar will monitor if it's created later
      validFolders.push(folder)
    }
  }

  if (validFolders.length === 0) {
    log('ERROR: No valid folders to watch. Please check OSSTEM_*_FOLDER paths.', 'ERROR')
    process.exit(1)
  }

  // Test API connectivity
  log('Testing API connection...')
  const testPatient = await getActivePatient()
  if (testPatient === null && CONFIG.API_BASE_URL.includes('your-app')) {
    log('WARNING: API_BASE_URL not configured! Update .env.bridge', 'ERROR')
  } else {
    log('✓ API connection successful')
    if (testPatient) {
      log(`✓ Active patient: ${testPatient}`)
    } else {
      log('No active patient currently set')
    }
  }

  // Start file watcher
  log('Starting file watcher...')
  const watcher = chokidar.watch(validFolders, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't process existing files on startup
    awaitWriteFinish: {
      stabilityThreshold: CONFIG.FILE_STABLE_DELAY,
      pollInterval: 100
    }
  })

  watcher
    .on('add', handleNewFile)
    .on('error', error => log(`Watcher error: ${error}`, 'ERROR'))
    .on('ready', () => {
      log('✓ File watcher ready')
      log('='.repeat(70))
      log('Bridge service is now running. Press Ctrl+C to stop.')
      log('Waiting for Osstem captures...')
    })

  // Periodic active patient check (for logging purposes)
  setInterval(async () => {
    const patientId = await getActivePatient()
    if (patientId !== activePatientId) {
      if (patientId) {
        log(`Active patient changed: ${patientId}`)
      } else {
        log('Active patient cleared')
      }
      activePatientId = patientId
    }
  }, CONFIG.POLL_INTERVAL)
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down bridge service...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  log('Shutting down bridge service...')
  process.exit(0)
})

// Start the service
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'ERROR')
  console.error(error)
  process.exit(1)
})
