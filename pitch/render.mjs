// Renders index.html frame by frame (deterministic seek) and muxes vo.mp3 → pitch.mp4.
// node render.mjs            → full video
// node render.mjs 3 20 47.5  → stills at those seconds in frames/
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const URL = process.env.PITCH_URL ?? 'http://localhost:8765/index.html?render'
const FPS = 30
const stills = process.argv.slice(2).map(Number)
const browser = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome` })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
const total = await page.evaluate(() => window.TOTAL)

if (stills.length) {
  mkdirSync('frames', { recursive: true })
  for (const t of stills) { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path: `frames/t${t}.png` }) }
} else {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', 'vo.mp3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'pitch.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] })
  const n = Math.ceil(total * FPS)
  for (let f = 0; f < n; f++) {
    await page.evaluate(t => window.seek(t), f / FPS)
    if (!ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }))) await new Promise(r => ff.stdin.once('drain', r))
    if (f % 300 === 0) console.log(`${f}/${n}`)
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r))
}
await browser.close()
