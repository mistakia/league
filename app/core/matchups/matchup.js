import { Record, List } from 'immutable'

import { matchup_types } from '@constants'

// This Record serves BOTH kinds of scoreboard entry, and their identities are
// genuinely different things -- which is why it carries two id fields rather
// than one.
//
// An H2H entry is a row of `matchups`, so its identity is `matchup_id`. A
// TOURNAMENT entry is a GROUP of `playoffs` rows sharing a playoff week ordinal,
// so its identity is `playoff_week_number` and there is no matchup id anywhere
// in it. Until the uid retirement both arrived as a single field called `uid`,
// and folding them back together under `matchup_id` would have kept exactly the
// ambiguity that rename removed -- a playoff week ordinal is not a matchup id,
// and calling it one is the same class of error as naming the ordinal
// `playoff_round` when 2 and 3 are the same round.
//
// Each field is null on the other type. Read `matchup_identity()` rather than
// either field wherever the code does not already know which kind it holds --
// the scoreboard's selection key and the matchup page's URL segment are both
// that case.
export const Matchup = new Record({
  matchup_id: null,
  playoff_week_number: null,
  tids: new List(),
  home_team_id: null,
  away_team_id: null,
  type: null,
  season_year: null,
  week: null,
  lid: null,

  away_points: null,
  home_points: null,

  away_projection: null,
  home_projection: null,

  points: new List(),
  points_manual: new List(),
  projections: new List()
})

// The selection key for either kind of entry. `matchups.selected` holds whichever
// one applies, and `get_selected_matchup` picks the collection to search by the
// same season-phase test the sagas use to set it.
export const matchup_identity = (matchup) =>
  matchup.type === matchup_types.TOURNAMENT
    ? matchup.playoff_week_number
    : matchup.matchup_id

export function create_matchup({
  matchup_id,
  playoff_week_number,
  tids,
  home_team_id,
  away_team_id,
  type,
  season_year,
  week,
  lid,

  away_points,
  home_points,

  away_projection,
  home_projection,

  points = [],
  points_manual = [],
  projections = []
} = {}) {
  return new Matchup({
    matchup_id,
    playoff_week_number,
    tids: new List(tids),
    home_team_id,
    away_team_id,
    type,
    season_year,
    week,
    lid,
    away_points,
    home_points,
    away_projection,
    home_projection,

    points: new List(points),
    points_manual: new List(points_manual),
    projections: new List(projections)
  })
}
