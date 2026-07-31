// Derive the desktop app icon from the web app's single source-of-truth logo.
//
// Assets live in the web app (apps/web/public) — the desktop shell packages and
// runs the web build, so it depends on web, never the other way around. But the
// desktop icon is a BUILD-TIME packaging asset: electron-builder needs a real
// SQUARE PNG at its buildResources path (build/icon.png) to convert into the
// Windows .ico / mac .icns. So instead of editing two files, we generate the one
// master here, right before electron-builder runs. The output is git-ignored —
// apps/web/public/logo.png stays the only file you edit.
//
// Why the conversion (not a plain copy): the master logo is neither square nor
// large enough for macOS. electron-builder REJECTS a non-square source when
// building .icns, and wants >=512px. So we letterbox the logo onto a transparent
// 1024x1024 canvas (with a little breathing room, as macOS icons conventionally
// have) and re-encode. Windows .ico generation benefits from the same square
// source.
//
// This is done in pure Node (zlib for the PNG streams) rather than pulling in an
// image library — it's a handful of build-time pixels, not worth a native
// dependency that has to resolve on three platforms in CI.
//
// Tolerant by design: if the master is missing we warn and continue, letting
// electron-builder fall back to its default icon rather than failing the build.
// If the conversion itself fails we fall back to copying the master verbatim and
// warn loudly — that still packages on Windows, and fails visibly on macOS.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

// 1024 is the largest size macOS asks for, so everything smaller downsamples from
// a real master rather than being upscaled by the OS.
const CANVAS = 1024
// Fraction of the canvas left empty on each side. macOS icons are drawn inside a
// smaller optical square than the full tile; a flush-to-edge logo looks oversized
// next to every other icon in the Dock.
const PADDING = 0.08

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..', '..', '..')

const source = join(repoRoot, 'apps', 'web', 'public', 'logo.png')
const dest = join(scriptDir, '..', 'build', 'icon.png')

// Invoked at the very bottom of the file: the helpers below close over
// module-level `const`s, which aren't initialised until this module finishes
// evaluating.
function main() {
  if (!existsSync(source)) {
    console.warn(
      `⚠️  [prepare-icon] No logo at ${source} — packaging with the default Electron icon.\n` +
        '   Drop a square PNG (>=512px, ideally 1024) there to brand the app.',
    )
    return
  }

  mkdirSync(dirname(dest), { recursive: true })

  try {
    const logo = decodePng(readFileSync(source))
    const icon = letterboxToSquare(logo, CANVAS, PADDING, backgroundOf(logo))
    writeFileSync(dest, encodePng(icon))
    console.log(
      `✅ [prepare-icon] ${logo.width}x${logo.height} → ${CANVAS}x${CANVAS} square icon at ${dest}`,
    )
  } catch (error) {
    console.warn(
      `⚠️  [prepare-icon] Could not square the logo (${error instanceof Error ? error.message : error}).\n` +
        '   Falling back to a verbatim copy. Windows packaging may still work, but macOS\n' +
        '   .icns generation requires a SQUARE source of at least 512x512 and will fail.',
    )
    copyFileSync(source, dest)
  }
}

// ---------------------------------------------------------------------------
// Minimal PNG codec — 8-bit RGB/RGBA, non-interlaced (what any exported logo is).
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

// Returns { width, height, data } where data is straight (non-premultiplied) RGBA.
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG file')

  let header = null
  const idat = []
  let offset = 8
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length // length + type + data + crc
  }

  if (!header) throw new Error('missing IHDR chunk')
  const { width, height, bitDepth, colorType, interlace } = header
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(
      `unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}); ` +
        'expected 8-bit RGB or RGBA, non-interlaced',
    )
  }

  const channels = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  if (raw.length < (stride + 1) * height) throw new Error('truncated image data')

  const rgba = Buffer.alloc(width * height * 4)
  let opaque = true
  let previous = Buffer.alloc(stride)
  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]
    const line = Buffer.from(raw.subarray(pos, pos + stride))
    pos += stride
    unfilter(filter, line, previous, channels)
    for (let x = 0; x < width; x++) {
      const s = x * channels
      const d = (y * width + x) * 4
      rgba[d] = line[s]
      rgba[d + 1] = line[s + 1]
      rgba[d + 2] = line[s + 2]
      rgba[d + 3] = channels === 4 ? line[s + 3] : 255
      if (rgba[d + 3] !== 255) opaque = false
    }
    previous = line
  }
  return { width, height, data: rgba, opaque }
}

function unfilter(type, line, previous, bpp) {
  const n = line.length
  switch (type) {
    case 0:
      break
    case 1:
      for (let i = bpp; i < n; i++) line[i] = (line[i] + line[i - bpp]) & 0xff
      break
    case 2:
      for (let i = 0; i < n; i++) line[i] = (line[i] + previous[i]) & 0xff
      break
    case 3:
      for (let i = 0; i < n; i++) {
        const left = i >= bpp ? line[i - bpp] : 0
        line[i] = (line[i] + ((left + previous[i]) >> 1)) & 0xff
      }
      break
    case 4:
      for (let i = 0; i < n; i++) {
        const left = i >= bpp ? line[i - bpp] : 0
        const upLeft = i >= bpp ? previous[i - bpp] : 0
        line[i] = (line[i] + paeth(left, previous[i], upLeft)) & 0xff
      }
      break
    default:
      throw new Error(`unknown scanline filter ${type}`)
  }
}

// Bilinear resample. Weights are applied to PREMULTIPLIED colour so transparent
// pixels don't bleed their (arbitrary) RGB into the logo's edges as a dark halo.
function resample(image, targetWidth, targetHeight) {
  const { width: sw, height: sh, data } = image
  const out = Buffer.alloc(targetWidth * targetHeight * 4)
  const xRatio = sw / targetWidth
  const yRatio = sh / targetHeight

  for (let y = 0; y < targetHeight; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + 0.5) * yRatio - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < targetWidth; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + 0.5) * xRatio - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const fx = sx - x0

      const corners = [
        { i: (y0 * sw + x0) * 4, w: (1 - fx) * (1 - fy) },
        { i: (y0 * sw + x1) * 4, w: fx * (1 - fy) },
        { i: (y1 * sw + x0) * 4, w: (1 - fx) * fy },
        { i: (y1 * sw + x1) * 4, w: fx * fy },
      ]

      let alpha = 0
      let r = 0
      let g = 0
      let b = 0
      for (const { i, w } of corners) {
        const a = (data[i + 3] / 255) * w
        alpha += a
        r += data[i] * a
        g += data[i + 1] * a
        b += data[i + 2] * a
      }

      const d = (y * targetWidth + x) * 4
      if (alpha > 0) {
        out[d] = Math.round(Math.min(255, r / alpha))
        out[d + 1] = Math.round(Math.min(255, g / alpha))
        out[d + 2] = Math.round(Math.min(255, b / alpha))
      }
      out[d + 3] = Math.round(Math.min(255, alpha * 255))
    }
  }
  return { width: targetWidth, height: targetHeight, data: out }
}

// Pick the colour to pad with. A logo exported WITHOUT transparency (like ours —
// a yellow mark on a solid tile) letterboxed onto transparency would render as a
// floating rectangle in the Dock, so we extend its own background out to the
// edges instead and get a proper full-bleed icon. A logo that already has
// transparency is padded with transparency, which is what it was drawn for.
// The corner pixel is the background by construction for a centred mark.
function backgroundOf(image) {
  if (!image.opaque) return null
  return [image.data[0], image.data[1], image.data[2], 255]
}

// Scale to fit inside the padded box, then centre it on a square canvas.
function letterboxToSquare(image, size, padding, background) {
  const box = Math.max(1, Math.round(size * (1 - padding * 2)))
  const scale = Math.min(box / image.width, box / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const scaled = resample(image, width, height)

  const canvas = Buffer.alloc(size * size * 4) // zero-filled = fully transparent
  if (background) {
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = background[0]
      canvas[i + 1] = background[1]
      canvas[i + 2] = background[2]
      canvas[i + 3] = background[3]
    }
  }
  const offsetX = Math.round((size - width) / 2)
  const offsetY = Math.round((size - height) / 2)
  for (let y = 0; y < height; y++) {
    scaled.data.copy(
      canvas,
      ((offsetY + y) * size + offsetX) * 4,
      y * width * 4,
      (y + 1) * width * 4,
    )
  }
  return { width: size, height: size, data: canvas }
}

function encodePng(image) {
  const { width, height, data } = image
  const stride = width * 4
  // Paeth-filter every scanline: the canvas is mostly flat transparency, which
  // then deflates to almost nothing.
  const raw = Buffer.alloc((stride + 1) * height)
  let pos = 0
  for (let y = 0; y < height; y++) {
    raw[pos++] = 4
    const rowStart = y * stride
    const prevStart = (y - 1) * stride
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? data[rowStart + i - 4] : 0
      const up = y > 0 ? data[prevStart + i] : 0
      const upLeft = y > 0 && i >= 4 ? data[prevStart + i - 4] : 0
      raw[pos++] = (data[rowStart + i] - paeth(left, up, upLeft)) & 0xff
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

main()
