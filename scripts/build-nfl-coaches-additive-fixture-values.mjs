// One-shot generator: rewrites the @@FIXTURE_VALUES@@ marker in the Phase 1
// nfl_coaches own-id additive adhoc with an inline INSERT VALUES block built
// from static-data/pfr-coaches.json. coach_id is computed via derive_coach_id (same
// helper the importer uses) so SQL and JS cannot drift.
//
// Run after the Phase 0 scrape completes:
//   node scripts/build-nfl-coaches-additive-fixture-values.mjs
// Then commit the modified adhoc alongside static-data/pfr-coaches.json.

import fs from 'fs'
import path from 'path'

const FIXTURE_PATH = 'static-data/pfr-coaches.json'
const ADHOC_PATH = 'db/adhoc/2026-05-31-nfl-coaches-own-id-additive.sql'
const BEGIN_MARKER =
  '-- BEGIN GENERATED FIXTURE VALUES (regenerate after static-data/pfr-coaches.json)'
const END_MARKER = '-- END GENERATED FIXTURE VALUES'

// Null-DOB disposition for the 6 PFR pages whose DOB could not be parsed.
// Categorization (Phase 0): bridge-referenced (nfl_game_coaches) x present in
// samhoppen/yearly_coaching_history.csv. Decision rule from task plan body:
//   bridge-referenced OR in YCH         -> keep with sentinel 0000-00-00
//   unreferenced AND not in YCH         -> drop
// Results (2026-05-31 scrape):
//   DoylDe0 Declan Doyle  - not-bridge, YCH=2  -> KEEP sentinel
//   KubiKl1 Klay Kubiak   - not-bridge, YCH=2  -> KEEP sentinel
//   LaFlMi0 Mike LaFleur  - BRIDGE,    YCH=12 -> KEEP sentinel
//   PiolSc0 Scott Pioli   - not-bridge, YCH=0  -> DROP
//   SmitGi0 Giff Smith    - BRIDGE,    YCH=16 -> KEEP sentinel
//   UdinGr0 Grant Udinski - not-bridge, YCH=1  -> KEEP sentinel
// Sentinel coach_id collision: none of the 5 kept (LNAM, FNAM) tuples collide
// with each other or with the real-DOB rows (sentinel DOB is 0000-00-00 so it
// cannot collide with any YYYY-MM-DD coach_id), so no discriminator suffix is
// emitted here. If a future re-scrape adds a colliding sentinel, this map and
// the importer's derive_coach_id sentinel path must be updated together.
const SENTINEL_KEEP = {
  DoylDe0: 'Declan Doyle',
  KubiKl1: 'Klay Kubiak',
  LaFlMi0: 'Mike LaFleur',
  SmitGi0: 'Giff Smith',
  UdinGr0: 'Grant Udinski'
}
// Per the Rothstein seed precedent in the adhoc body: the coach_id text carries
// the literal '0000-00-00' marker, while the dob column stores 1900-01-01
// (PostgreSQL date type rejects 0000-00-00).
const SENTINEL_COACH_ID_DOB = '0000-00-00'
const SENTINEL_DOB_STORAGE = '1900-01-01'

const derive_coach_id = (full_name, dob) => {
  if (!full_name || !dob) return null
  const parts = full_name.trim().split(/\s+/)
  if (parts.length < 2) return null
  const first = parts[0]
  let last = parts[parts.length - 1]
  last = last.replace(/(Jr|Sr|II|III|IV)\.?$/i, '').trim()
  if (!last) {
    if (parts.length < 3) return null
    last = parts[parts.length - 2]
  }
  // Strip non-alpha (apostrophe, hyphen, etc.) before slicing so the LNAM/FNAM
  // segments satisfy the CHECK regex [A-Z]{1,4}. E.g. "O'Leary" -> "OLEA",
  // not "O'LE" (the latter would fail the constraint and abort the txn).
  const lnam = last.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)
  const fnam = first.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)
  if (!lnam || !fnam) return null
  const dob_text =
    typeof dob === 'string' ? dob : dob.toISOString().slice(0, 10)
  return `${lnam}-${fnam}-${dob_text}`
}

const sql_str = (s) => `'${String(s).replace(/'/g, "''")}'`

const main = () => {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`fixture missing: ${FIXTURE_PATH}`)
  }
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))

  const rows = []
  const fixture_by_id = new Map(fixture.map((r) => [r.pfr_coach_id, r]))
  let dropped_null_dob = 0
  let kept_sentinel = 0
  for (const r of fixture) {
    if (!r.pfr_coach_id) continue
    if (!r.dob || !r.full_name) {
      if (Object.prototype.hasOwnProperty.call(SENTINEL_KEEP, r.pfr_coach_id)) {
        const full_name = SENTINEL_KEEP[r.pfr_coach_id]
        const coach_id = derive_coach_id(full_name, SENTINEL_COACH_ID_DOB)
        if (!coach_id) {
          throw new Error(
            `sentinel coach_id derivation failed for ${r.pfr_coach_id}`
          )
        }
        rows.push({
          pfr_coach_id: r.pfr_coach_id,
          full_name,
          dob: SENTINEL_DOB_STORAGE,
          coach_id,
          first_season_pfr: r.first_season_pfr ?? null
        })
        kept_sentinel++
      } else {
        dropped_null_dob++
      }
      continue
    }
    const coach_id = derive_coach_id(r.full_name, r.dob)
    if (!coach_id) {
      dropped_null_dob++
      continue
    }
    rows.push({
      pfr_coach_id: r.pfr_coach_id,
      full_name: r.full_name,
      dob: r.dob,
      coach_id,
      first_season_pfr: r.first_season_pfr ?? null
    })
  }

  // Belt-and-suspenders: every id in SENTINEL_KEEP must be present in fixture
  // (otherwise the map is stale relative to static-data/pfr-coaches.json).
  for (const id of Object.keys(SENTINEL_KEEP)) {
    if (!fixture_by_id.has(id)) {
      throw new Error(
        `SENTINEL_KEEP id ${id} is not in ${FIXTURE_PATH} -- re-derive disposition map`
      )
    }
  }

  // Collision check across all emitted coach_ids (real-DOB + sentinel).
  const seen = new Set()
  for (const r of rows) {
    if (seen.has(r.coach_id)) {
      throw new Error(
        `coach_id collision on ${r.coach_id} (${r.pfr_coach_id}) -- discriminator suffix logic needs to fire`
      )
    }
    seen.add(r.coach_id)
  }

  const value_lines = rows.map(
    (r) =>
      `  (${sql_str(r.pfr_coach_id)}, ${sql_str(r.full_name)}, ${sql_str(r.dob)}::date, ${sql_str(r.coach_id)}, ${r.first_season_pfr ?? 'NULL'})`
  )
  const block = [
    BEGIN_MARKER,
    `INSERT INTO pfr_coach_fixture (pfr_coach_id, full_name, dob, coach_id, first_season_pfr) VALUES`,
    value_lines.join(',\n') + ';',
    END_MARKER
  ].join('\n')

  const adhoc_path = path.resolve(ADHOC_PATH)
  const adhoc = fs.readFileSync(adhoc_path, 'utf-8')
  const begin_idx = adhoc.indexOf(BEGIN_MARKER)
  const end_idx = adhoc.indexOf(END_MARKER)
  if (begin_idx < 0 || end_idx < 0) {
    throw new Error(`fixture markers not found in ${ADHOC_PATH}`)
  }
  const next = adhoc.slice(0, begin_idx) + block + adhoc.slice(end_idx + END_MARKER.length)
  fs.writeFileSync(adhoc_path, next, 'utf-8')
  console.log(
    `wrote ${rows.length} fixture rows into ${ADHOC_PATH} (sentinel-kept=${kept_sentinel} dropped-null-dob=${dropped_null_dob})`
  )
}

main()
