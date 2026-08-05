import { Record, List } from 'immutable'

export const Matchup = new Record({
  uid: null,
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

export function create_matchup({
  uid,
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
    uid,
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
