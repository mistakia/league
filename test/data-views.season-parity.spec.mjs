/* global describe it */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'

import player_stats from '#libs-server/data-views-column-definitions/player-stats-from-plays-column-definitions.mjs'
import team_stats from '#libs-server/data-views-column-definitions/team-stats-from-plays-column-definitions.mjs'

const expect = chai.expect
const current_dir = path.dirname(fileURLToPath(import.meta.url))

// Golden snapshot of the season (no-output) render -- the with_select array
// produced with empty params -- for every column in the player-stats and
// team-stats from-plays factories. Captured pre-migration (after Phase A, which
// left the factories untouched). The measure-first migration regenerates these
// strings from the explicit `measure` declaration instead of the raw
// with_select_string; this spec is the BLOCKING gate that the regeneration is
// byte-for-byte identical, catching a misclassified column kind silently
// altering the season render or a carve-out string drifting. Covers every
// aggregate shape: SUM, SUM(CASE), ROUND(SUM), COUNT(*), COUNT(CASE), AVG,
// CAST(ROUND(AVG)), compound-ratio CASE, and COUNT(DISTINCT).
const golden = JSON.parse(
  fs.readFileSync(
    path.join(current_dir, 'fixtures/data-views-season-render-golden.json'),
    'utf8'
  )
)

describe('data-views season-total parity (blocking gate for factory migration)', () => {
  const all = { ...player_stats, ...team_stats }

  it('golden covers exactly the current from-plays column set', () => {
    expect(Object.keys(all).sort()).to.deep.equal(Object.keys(golden).sort())
  })

  for (const [column_id, expected] of Object.entries(golden)) {
    it(`${column_id} season render is unchanged`, () => {
      const def = all[column_id]
      expect(def, `${column_id} missing from factory`).to.exist
      const actual = def.with_select ? def.with_select({ params: {} }) : null
      expect(actual).to.deep.equal(expected)
    })
  }
})
