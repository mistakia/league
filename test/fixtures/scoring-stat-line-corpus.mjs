// A fixed corpus of stat lines for the scoring-format equivalence gate.
//
// Deliberately production-SHAPED, not exhaustive. The claim the gate makes is
// "moving kicking and DST scoring into league_scoring_formats, at the
// backfilled defaults, changes no existing score" -- so the corpus has to look
// like the gamelogs production actually holds.
//
// The one shape excluded on purpose is a kicker line carrying band counts with
// NO field_goal_yards. That line is where the old and new implementations
// genuinely diverge: the old code's band arm scored it at 3/3/3/4/5 while the
// backfilled bands score it at zero. It is excluded because production has no
// such row -- measured over 2025 REG kickers, 453 gamelogs carry band counts
// and all 453 also carry field goal yards, ZERO carry bands alone. Including it
// would make the gate assert an equivalence that was never true rather than one
// the backfill preserves. The divergence is asserted explicitly and separately
// in the equivalence spec, so it is recorded rather than hidden.

export const corpus_note =
  'Production-shaped stat lines. Band counts always accompany field_goal_yards, matching every kicker gamelog in production; a bands-only line is the known intentional divergence and is asserted separately in the spec.'

export const stat_lines = [
  { name: 'empty', position: '', stats: {} },

  {
    name: 'quarterback',
    position: 'QB',
    stats: {
      passing_attempts: 38,
      passing_completions: 25,
      passing_yards: 301,
      passing_interceptions: 1,
      passing_touchdowns: 3,
      rushing_attempts: 4,
      rushing_yards: 18,
      rushing_yards_excluding_kneels: 22,
      rushing_touchdowns: 1,
      rushing_first_downs: 2,
      fumbles_lost: 1,
      two_point_conversions: 1
    }
  },

  {
    name: 'quarterback with kneels',
    position: 'QB',
    stats: {
      passing_attempts: 30,
      passing_yards: 244,
      passing_touchdowns: 2,
      rushing_attempts: 5,
      rushing_yards: -3,
      rushing_yards_excluding_kneels: 9
    }
  },

  {
    name: 'running back',
    position: 'RB',
    stats: {
      rushing_attempts: 21,
      rushing_yards: 104,
      rushing_touchdowns: 1,
      rushing_first_downs: 6,
      targets: 5,
      receptions: 4,
      receiving_yards: 33,
      receiving_first_downs: 2,
      fumbles_lost: 1
    }
  },

  {
    name: 'wide receiver',
    position: 'WR',
    stats: {
      targets: 11,
      receptions: 8,
      receiving_yards: 122,
      receiving_first_downs: 6,
      receiving_touchdowns: 2,
      rushing_attempts: 1,
      rushing_yards: 7,
      punt_return_touchdowns: 1
    }
  },

  {
    name: 'tight end',
    position: 'TE',
    stats: {
      targets: 7,
      receptions: 6,
      receiving_yards: 61,
      receiving_first_downs: 4,
      receiving_touchdowns: 1
    }
  },

  {
    name: 'returner with all three return touchdowns',
    position: 'WR',
    stats: {
      punt_return_touchdowns: 1,
      kickoff_return_touchdowns: 1,
      fumble_return_touchdowns: 1,
      two_point_conversions: 2
    }
  },

  {
    name: 'kicker',
    position: 'K',
    stats: {
      field_goal_yards: 187,
      field_goals_made: 5,
      field_goals_made_0_19_yards: 0,
      field_goals_made_20_29_yards: 1,
      field_goals_made_30_39_yards: 2,
      field_goals_made_40_49_yards: 1,
      field_goals_made_50_plus_yards: 1,
      extra_points_made: 3
    }
  },

  {
    name: 'kicker with extra points only',
    position: 'K',
    stats: { extra_points_made: 6 }
  },

  {
    name: 'defense shutout',
    position: 'DST',
    stats: {
      defensive_sacks: 5,
      defensive_interceptions: 2,
      defensive_forced_fumbles: 2,
      defensive_recovered_fumbles: 1,
      defensive_three_and_outs: 4,
      defensive_fourth_down_stops: 1,
      defensive_points_against: 0,
      defensive_yards_against: 188,
      defensive_blocked_kicks: 1,
      defensive_safeties: 1,
      defensive_two_point_returns: 0,
      defensive_touchdowns: 1
    }
  },

  {
    name: 'defense blown out',
    position: 'DST',
    stats: {
      defensive_sacks: 1,
      defensive_interceptions: 0,
      defensive_forced_fumbles: 0,
      defensive_recovered_fumbles: 0,
      defensive_three_and_outs: 1,
      defensive_fourth_down_stops: 0,
      defensive_points_against: 45,
      defensive_yards_against: 512,
      defensive_blocked_kicks: 0,
      defensive_safeties: 0,
      defensive_two_point_returns: 0,
      defensive_touchdowns: 0
    }
  },

  {
    name: 'defense exactly at both thresholds',
    position: 'DST',
    stats: {
      defensive_points_against: 20,
      defensive_yards_against: 300,
      defensive_sacks: 3
    }
  }
]
