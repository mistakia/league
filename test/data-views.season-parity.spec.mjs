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
// team-stats from-plays factories. It is the gate on the season render moving,
// so a misclassified accumulator or a drifting carve-out string fails here
// rather than in production. Covers SUM, SUM(CASE), ROUND(SUM), COUNT(*),
// COUNT(CASE), COUNT(DISTINCT), the guarded-division combine, and the
// remaining raw carve-outs.
//
// It was BLIND to the eight share columns for as long as `create_team_share_stat`
// existed: that factory built the season render inside its own CTE and defined
// no `with_select`, so all eight were stored here as null and three of them had
// moved unseen. Folding the share scan onto the one from-plays factory closed
// that -- every column in the registry now defines a `with_select` and no entry
// here is null. The eight were filled with renders proven byte-identical to
// what the share factory emitted, so the fill records the blind spot closing
// rather than a value moving.
//
// Two regenerations are recorded rather than assumed. The additive conversion
// (ce27846ef) moved NOTHING: all 59 columns rendered byte-identically. The
// ratio conversion moved exactly the 34 player numerator/denominator columns,
// each from a hand-written CASE/CAST form to the one guarded division
// combine-accumulators.mjs emits -- and five of those (pass touchdown, interception and
// interception-worthy percentage, and the two successful-play percentages)
// were guarding on their NUMERATOR, so they rendered blank for a subject with
// a real denominator and no events. That is a value change, covered by
// test/data-view-queries/player-pass-touchdown-percentage-zero-numerator-result-equivalence.json.
//
// The team conversion moved exactly FOUR entries, and they are the AVG
// carve-outs: PROE and CPOE in both their team and player_team variants. Their
// render goes from a single `AVG(x)` to the two accumulators `SUM(x)` and
// `SUM(CASE WHEN x IS NOT NULL THEN 1 ELSE 0 END)`, which is the same value at
// this grain -- the declared denominator IS the AVG's implicit one. What it
// repairs is the POOLING one level out: the outer expression was `sum(<that
// AVG>)`, so the player variant summed a per-GAME mean across every game the
// player was active for and a full season read roughly seventeen times the
// truth. Pinned by
// test/data-view-queries/player-team-completion-percentage-over-expected-single-year-pooling-result-equivalence.json,
// which returns 75 before the conversion against a true 30.
//
// The four `is_rate` statistics moved NOTHING except series conversion, whose
// two entries gained a `nfl_plays.` qualifier on the `esbid` inside their
// distinct key. That is required rather than cosmetic: the season CTE scans
// `nfl_plays` alone, but the PERIOD CTE joins `nfl_games`, which also carries
// `esbid`, so the bare reference is a 42702 the moment the column is asked for
// a count or a mean. Their CTE already carried the two accumulator columns
// under these exact names, so everything else reproduced byte for byte and only
// the OUTER recombination changed.
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

  // A null entry is a column this gate cannot see. There are none, and an entry
  // going null again would be a factory that has stopped declaring a season
  // render -- reported here rather than passing vacuously.
  it('covers every column, with no unreadable entry', () => {
    const blind = Object.keys(golden).filter((key) => golden[key] === null)
    expect(blind, blind.join(', ')).to.have.length(0)
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
