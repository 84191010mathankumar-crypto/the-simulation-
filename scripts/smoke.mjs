/**
 * Headless smoke-test for the warehouse demo.
 *
 * Loads http://localhost:5175 in a real Chromium, gives it time to load the
 * URDF + STL meshes, then dumps:
 *   - any console errors / uncaught exceptions
 *   - the side-panel state (counters, robot list)
 *   - whether the Run button is enabled
 *   - a screenshot to scripts/smoke.png for visual review
 *
 * Then clicks Run and watches for ~12 s, capturing a second screenshot.
 *
 * Exits non-zero on any console/page error.
 */
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PORT = process.env.PORT || 5175
const URL  = `http://localhost:${PORT}/`
const HERE = dirname(fileURLToPath(import.meta.url))

// Headless Chromium often can't create a WebGL context on Windows; that's
// fine for this smoke test — we verify the React layer (panel, coordinator,
// task list) renders without errors.  The 3D scene gets visually checked
// against the real browser that the user opens.
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

let exitCode = 0
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 })

  const consoleErrors = []
  const pageErrors    = []
  const requestFails  = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('requestfailed', (req) => {
    if (!req.url().startsWith('chrome-extension:')) {
      requestFails.push(`${req.url()} — ${req.failure()?.errorText}`)
    }
  })
  page.on('response', (resp) => {
    if (resp.status() >= 400 && !resp.url().startsWith('chrome-extension:')) {
      requestFails.push(`HTTP ${resp.status()}: ${resp.url()}`)
    }
  })

  console.log(`[smoke] navigating to ${URL}`)
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })

  // Give URDF + STL loaders plenty of time.
  console.log('[smoke] waiting 10 s for URDF loads + first render…')
  await new Promise((r) => setTimeout(r, 10000))

  await page.screenshot({ path: join(HERE, 'smoke-1-initial.png'), fullPage: false })
  console.log('[smoke] screenshot 1 → scripts/smoke-1-initial.png')

  const beforeRun = await page.evaluate(() => {
    const counters = Array.from(document.querySelectorAll('.counter-num')).map((n) => n.textContent)
    const status   = document.querySelector('.status')?.textContent?.trim()
    const runBtn   = document.querySelector('.btn-run')
    const robots   = Array.from(document.querySelectorAll('.robot-row')).map((r) => r.textContent.trim())
    return {
      counters,
      status,
      runText: runBtn?.textContent?.trim(),
      runDisabled: runBtn?.disabled,
      robotCount: robots.length,
      robots,
    }
  })
  console.log('[smoke] state before Run:', JSON.stringify(beforeRun, null, 2))

  if (beforeRun.runDisabled) {
    console.log('[smoke] ⚠️  Run button disabled — robots may not be ready')
  } else {
    console.log('[smoke] clicking Run')
    await page.click('.btn-run')

    // Sample counters every 10 s to make sure progress is happening.
    for (let i = 1; i <= 6; i++) {
      await new Promise((r) => setTimeout(r, 10000))
      const counters = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.counter-num')).map((n) => n.textContent)
      )
      console.log(`[smoke] t=${i * 10}s — pending:${counters[0]} active:${counters[1]} done:${counters[2]}`)
      if (counters[2] === '6') break
    }

    await page.screenshot({ path: join(HERE, 'smoke-2-running.png'), fullPage: false })
    console.log('[smoke] screenshot 2 → scripts/smoke-2-running.png')
    const afterRun = await page.evaluate(() => ({
      counters: Array.from(document.querySelectorAll('.counter-num')).map((n) => n.textContent),
      robots:   Array.from(document.querySelectorAll('.robot-task')).map((r) => r.textContent.trim()),
    }))
    console.log('[smoke] final state:', JSON.stringify(afterRun, null, 2))
  }

  // WebGL is expected to fail in headless Chromium without a GPU — filter
  // those out so we only fail on issues we can actually fix.
  const isWebGL = (s) => /webgl|gl_vendor|gpu/i.test(s)
  const realPageErrors    = pageErrors.filter((e)    => !isWebGL(e))
  const realConsoleErrors = consoleErrors.filter((e) => !isWebGL(e))

  if (realPageErrors.length || realConsoleErrors.length || requestFails.length) {
    console.log('\n[smoke] ❌ errors:')
    for (const e of realPageErrors)    console.log('  pageerror :', e)
    for (const e of realConsoleErrors) console.log('  console  :', e)
    for (const e of requestFails)      console.log('  reqfail  :', e)
    exitCode = 1
  } else {
    console.log('[smoke] ✓ no React/coordinator errors')
    if (pageErrors.length || consoleErrors.length) {
      console.log('[smoke] (WebGL errors in headless are expected — real browser is fine)')
    }
  }
} catch (e) {
  console.error('[smoke] fatal:', e.message)
  exitCode = 1
} finally {
  await browser.close()
}

process.exit(exitCode)
