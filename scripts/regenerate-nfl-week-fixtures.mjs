// One-shot fixture regenerator for the REG/POST week encoding migration.
// task: user:task/league/migrate-reg-postseason-week-encoding.md
// generated: 2026-04-23
//
// Walks test/data-view-queries/*.json, parses each expected_query, finds
// every `nfl_week_id in (...)` clause, and remaps any
// {year}_REG_WEEK_{w} where w > era_max(year) to {year}_POST_WEEK_{w - era_max(year)}.
// Deduplicates and re-sorts the IN list. Idempotent.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  parse_nfl_week_identifier,
  format_nfl_week_identifier,
  get_max_weeks_for_season_type
} from '#libs-shared/nfl-week-identifier.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixtures_dir = path.resolve(__dirname, '..', 'test', 'data-view-queries')

const remap_identifier = (id) => {
  const parsed = parse_nfl_week_identifier({ identifier: id })
  if (!parsed) return id
  if (parsed.seas_type !== 'REG') return id
  const era_max = get_max_weeks_for_season_type({
    seas_type: 'REG',
    year: parsed.year
  })
  if (!era_max || parsed.week <= era_max) return id
  return format_nfl_week_identifier({
    year: parsed.year,
    seas_type: 'POST',
    week: parsed.week - era_max
  })
}

const NFL_WEEK_ID_REGEX = /("nfl_week_id"\s+in\s+\()([^)]*)(\))/g

const rewrite_expected_query = (query) => {
  if (typeof query !== 'string') return { query, changed: false }
  let changed = false
  const rewritten = query.replace(
    NFL_WEEK_ID_REGEX,
    (match, open, body, close) => {
      const ids = body
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^'|'$/g, ''))
      const remapped = ids.map(remap_identifier)
      const unique = [...new Set(remapped)]
      const new_body = unique.map((id) => `'${id}'`).join(', ')
      const replacement = `${open}${new_body}${close}`
      if (replacement !== match) changed = true
      return replacement
    }
  )
  return { query: rewritten, changed }
}

const main = () => {
  const files = fs
    .readdirSync(fixtures_dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(fixtures_dir, f))

  let changed_count = 0
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    const json = JSON.parse(raw)
    if (!json.expected_query) continue
    const { query, changed } = rewrite_expected_query(json.expected_query)
    if (!changed) continue
    json.expected_query = query
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
    changed_count += 1
    console.log(`rewrote ${path.basename(file)}`)
  }
  console.log(`rewrote ${changed_count} fixtures`)
}

main()
