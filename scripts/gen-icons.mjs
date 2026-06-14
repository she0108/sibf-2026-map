import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// 검정 바탕 + 흰 "SIBF". maskable 안전 영역(중앙 80%) 안에 글자가 들어가도록 크기를 잡는다.
function draw(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const family = GlobalFonts.families.find((f) => /arial/i.test(f.family))?.family || 'sans-serif'
  // 글자 폭이 안전 영역(약 62%)을 넘지 않도록 폰트 크기를 줄여 맞춘다.
  let fontSize = size * 0.34
  const maxWidth = size * 0.62
  for (;;) {
    ctx.font = `700 ${fontSize}px ${family}`
    if (ctx.measureText('SIBF').width <= maxWidth || fontSize <= 8) break
    fontSize -= 2
  }
  ctx.fillText('SIBF', size / 2, size / 2 + size * 0.02)
  return canvas.toBuffer('image/png')
}

for (const size of [192, 512]) {
  writeFileSync(join(out, `icon-${size}.png`), draw(size))
}
// iOS 홈화면용
writeFileSync(join(out, 'apple-touch-icon.png'), draw(180))
console.log('icons written to', out)
