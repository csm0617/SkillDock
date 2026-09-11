// Extract DSH theme tokens from the ui-theme client bundle for mockup fidelity.
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const text = readFileSync(file, 'utf8')

const patterns = [
  ['--dsh-', /--dsh-[a-z0-9-]+\s*:\s*[^;}"]+/g],
  ['font', /--dsw-font[a-z0-9-]*\s*:\s*[^;}"]+/g],
  ['typography', /--dsw-typography[a-z0-9-]*\s*:\s*[^;}"]+/g],
  ['radius', /--dsw-radius[a-z0-9-]*\s*:\s*[^;}"]+/g],
  ['scrollbar', /--dsw-scrollbar[a-z0-9-]*\s*:\s*[^;}"]+/g],
  ['motion', /--dsw-motion[a-z0-9-]*\s*:\s*[^;}"]+/g],
]

for (const [label, re] of patterns) {
  const seen = new Map()
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const i = raw.indexOf(':')
    const key = raw.slice(0, i).trim()
    if (!seen.has(key)) seen.set(key, raw.slice(i + 1).trim())
  }
  console.log(`=== ${label} (${seen.size}) ===`)
  for (const key of [...seen.keys()].sort()) console.log(`${key} = ${seen.get(key)}`)
}

// Dark-mode: find selector blocks that mention dark and print their start.
console.log('=== dark selectors ===')
const darkRe = /\[data-[a-z-]*theme[^\]]*\]|\.dsw-dark|prefers-color-scheme\s*:\s*dark/g
const found = new Set()
for (const m of text.matchAll(darkRe)) found.add(m[0])
console.log([...found].join('\n') || '(none)')
