// Chromium for the tests. Uses `playwright-core` (npm i -D playwright-core, or
// set PLAYWRIGHT_CORE to its path) and the browser at CHROME_PATH, or the one
// Playwright installed (npx playwright install chromium).
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')

const CANDIDATES = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean)

function launch() {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p))
  return chromium.launch(executablePath ? { executablePath } : {})
}

module.exports = { launch }
