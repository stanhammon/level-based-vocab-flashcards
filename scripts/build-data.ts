/**
 * Turns data/*.csv into public/data/<code>.json plus public/data/languages.json
 * (SPEC §3.2). With no real CSVs present it falls back to data/sample/, so a
 * fresh clone of the public repo still runs (SPEC §3.4). Any invalid row fails
 * the build with its file and line.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LANGUAGE_CONFIG } from '../src/lib/languages.ts'
import type { LanguageFile, LanguageInfo, Manifest, RawCard } from '../src/lib/wordData.ts'
import { parseCsv } from './csv.ts'

const root = path.resolve(import.meta.dirname, '..')
const dataDir = path.join(root, 'data')
const sampleDir = path.join(dataDir, 'sample')
const outDir = path.join(root, 'public', 'data')

const EXPECTED = ['english translation (short)', 'english translation (full)', 'section number', 'section title']

const csvIn = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.csv'))
        .sort()
        .map((f) => path.join(dir, f))
    : []

let files = csvIn(dataDir)
const sample = files.length === 0
if (sample) {
  files = csvIn(sampleDir)
  console.warn('build-data: no word lists in data/, using the sample list')
}

const errors: string[] = []
const warnings: string[] = []
const languages: LanguageInfo[] = []
const outputs: { name: string; json: string }[] = []

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/')
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'))
  const head = (header?.fields ?? []).map((h) => h.trim().toLowerCase())
  const m = /^(.+) word$/.exec(head[0] ?? '')
  if (!m || head.length !== 5 || EXPECTED.some((h, i) => head[i + 1] !== h)) {
    errors.push(`${rel}:1 header must be "<language> word,${EXPECTED.join(',')}"`)
    continue
  }
  const key = m[1].trim()
  const name = key.replace(/\b\w/g, (c) => c.toUpperCase())
  const config = LANGUAGE_CONFIG[key]
  if (!config) warnings.push(`${rel}: "${key}" has no entry in src/lib/languages.ts; text-to-speech will be off`)
  const code = config?.code ?? key.replace(/[^a-z0-9]+/g, '-')
  if (languages.some((l) => l.code === code)) {
    errors.push(`${rel}: a second file for language "${name}"`)
    continue
  }

  const sections: Record<number, string> = {}
  const cards: RawCard[] = []
  const seen = new Set<string>()
  for (const { line, fields } of rows) {
    const at = `${rel}:${line}`
    if (fields.length !== 5) {
      errors.push(`${at} expected 5 columns, found ${fields.length}`)
      continue
    }
    const [word, short, full, num, title] = fields.map((f) => f.trim())
    if (!word || !short || !title) {
      errors.push(`${at} word, short translation and section title are required`)
      continue
    }
    if (!/^[1-9]\d*$/.test(num)) {
      errors.push(`${at} section number "${num}" is not a positive whole number`)
      continue
    }
    const level = Number(num)
    const id = `${level}:${word}`
    if (seen.has(id)) {
      errors.push(`${at} "${word}" appears twice in section ${level}`)
      continue
    }
    seen.add(id)
    if (sections[level] !== undefined && sections[level] !== title) {
      errors.push(`${at} section ${level} is titled both "${sections[level]}" and "${title}"`)
      continue
    }
    sections[level] = title
    cards.push([word, short, full && full !== short ? full : '', level])
  }
  if (cards.length === 0) {
    errors.push(`${rel}: no words`)
    continue
  }

  const body: LanguageFile = { code, sections, cards }
  const json = JSON.stringify(body)
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 10)
  const levels = Object.keys(sections).map(Number)
  outputs.push({ name: `${code}.json`, json })
  languages.push({
    name,
    code,
    tts: config?.tts ?? [],
    sample,
    count: cards.length,
    minLevel: Math.min(...levels),
    maxLevel: Math.max(...levels),
    file: `/data/${code}.json?v=${hash}`,
  })
}

for (const w of warnings) console.warn(`build-data: ${w}`)
if (errors.length > 0) {
  for (const e of errors.slice(0, 50)) console.error(`build-data: ${e}`)
  if (errors.length > 50) console.error(`build-data: …and ${errors.length - 50} more`)
  process.exit(1)
}
if (languages.length === 0) {
  console.error('build-data: no word lists found in data/ or data/sample/')
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
for (const o of outputs) writeFileSync(path.join(outDir, o.name), o.json)
const manifest: Manifest = { languages: languages.sort((a, b) => a.name.localeCompare(b.name)) }
writeFileSync(path.join(outDir, 'languages.json'), JSON.stringify(manifest))
for (const l of languages) console.log(`build-data: ${l.name}: ${l.count} words, levels ${l.minLevel}–${l.maxLevel}`)
