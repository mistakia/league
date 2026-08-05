/* global describe it */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'

import nfl_plays_column_params, {
  nfl_games_params
} from '#libs-shared/nfl-plays-column-params.mjs'

const expect = chai.expect
const current_dir = path.dirname(fileURLToPath(import.meta.url))
const fixtures_dir = path.join(current_dir, 'data-view-queries')

// A param key the registry does not know is SILENTLY IGNORED twice over, and
// neither symptom is an error:
//
//   1. apply_play_by_play_column_params_to_query iterates the registry and
//      skips anything it does not recognise, so the filter is dropped and the
//      column returns an unfiltered value.
//   2. get_stats_column_param_key derives the from-plays CTE identity from the
//      registry keys, so an unrecognised param contributes NOTHING to the hash
//      -- two columns differing only by that param hash identically, land in
//      one join group, and share a single CTE built from whichever column
//      seeded the group. The second column then renders the first's values
//      under its own header.
//
// This is not hypothetical and it is not old news. The 2026-08-04 boolean-prefix
// rename renamed 81 registry keys; `adjust-specified-year-params-when-year-offset-is-specified.json`
// still requested `motion` and `play_action`, and its emitted SQL quietly went
// from 5 from-plays CTEs to 3. Regenerating the golden would have blessed it,
// because a regenerated golden agrees with whatever the code currently emits.
//
// Scoped to the FROM-PLAYS family, which is where both failure modes live:
// those are the columns whose params are applied by
// apply_play_by_play_column_params_to_query and whose CTE identity comes from
// get_stats_column_param_key. Other column sources carry their own param
// vocabularies (team_unit, dvoa_type, force_player_active, ...) that this
// registry legitimately does not know.
//
// Time-scope params are resolved a layer up rather than declared in the
// registry, so they are listed explicitly and adding one is a deliberate act.
const NON_REGISTRY_PARAMS = new Set([
  'year',
  'week',
  'seas_type',
  'year_offset',
  'week_offset',
  'nfl_week_id',
  'career_year',
  'career_game',
  'output',
  'rate_type',
  'output_column_params',
  'output_match_column_params',
  'rate_type_column_params',
  'rate_type_match_column_params',
  'matched_rate_type_column_params',
  'scoring_format_id',
  'league_format_id',
  'time_type',
  'limit_to_player_active_games',
  'force_player_active',
  // Read straight off params by add-team-stats-play-by-play-with-statement and
  // rate-type-per-team-play to pick the offensive or defensive team column, so
  // it never passes through the registry.
  'team_unit',
  // Consumed by get-data-view-results when it collects matchup opponent types.
  'matchup_opponent_type'
])

const is_from_plays = (column_id) =>
  typeof column_id === 'string' && column_id.endsWith('_from_plays')

const collect_from_plays_param_keys = (node, out) => {
  if (Array.isArray(node)) {
    for (const entry of node) collect_from_plays_param_keys(entry, out)
    return
  }
  if (!node || typeof node !== 'object') return
  if (is_from_plays(node.column_id) && node.params) {
    for (const param_key of Object.keys(node.params)) out.add(param_key)
  }
  for (const value of Object.values(node)) {
    collect_from_plays_param_keys(value, out)
  }
}

describe('data-view fixture param keys are recognised', () => {
  const recognised = new Set([
    ...Object.keys(nfl_plays_column_params),
    ...Object.keys(nfl_games_params),
    ...NON_REGISTRY_PARAMS
  ])

  const filenames = fs
    .readdirSync(fixtures_dir)
    .filter((name) => name.endsWith('.json'))

  it('every from-plays fixture request uses only params the registry can resolve', () => {
    const unrecognised = {}
    for (const filename of filenames) {
      const fixture = JSON.parse(
        fs.readFileSync(path.join(fixtures_dir, filename), 'utf8')
      )
      const keys = new Set()
      collect_from_plays_param_keys(fixture.request, keys)
      const bad = [...keys].filter((key) => !recognised.has(key))
      if (bad.length) unrecognised[filename] = bad.sort()
    }
    expect(unrecognised).to.deep.equal({})
  })
})
