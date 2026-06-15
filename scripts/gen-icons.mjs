import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// 검정 바탕 + 형광 연두(하이라이트 색) "SIBF".
// maskable 안전 영역(중앙 80%) 안에 글자가 들어가도록 크기를 잡는다.
const TEXT_COLOR = '#00ff00'
const LINES = ['SIBF']

function draw(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const family = GlobalFonts.families.find((f) => /arial/i.test(f.family))?.family || 'sans-serif'
  // 가장 넓은 줄이 안전 영역(약 60%)을 넘지 않도록 폰트 크기를 줄여 맞춘다.
  let fontSize = size * 0.3
  const maxWidth = size * 0.6
  for (;;) {
    ctx.font = `700 ${fontSize}px ${family}`
    const widest = Math.max(...LINES.map((t) => ctx.measureText(t).width))
    if (widest <= maxWidth || fontSize <= 8) break
    fontSize -= 2
  }
  const lineH = fontSize * 1.05
  const top = size / 2 - (lineH * (LINES.length - 1)) / 2
  LINES.forEach((t, i) => ctx.fillText(t, size / 2, top + lineH * i))
  return canvas.toBuffer('image/png')
}

for (const size of [192, 512]) {
  writeFileSync(join(out, `icon-${size}.png`), draw(size))
}
// iOS 홈화면용
writeFileSync(join(out, 'apple-touch-icon.png'), draw(180))
console.log('icons written to', out)
