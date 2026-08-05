/**
 * League settings field labels
 *
 * Single server-consumable source for the human-readable labels of league
 * scoring, starting-lineup, and roster-limit fields. The strings mirror the
 * labels currently inline in the `app/views/components/league-settings-*`
 * components so the settings UI can consume this map without visible change;
 * the context-doc rules generator consumes it server-side.
 *
 * `scoring_field_labels` is grouped by section (passing / rushing / receiving /
 * misc / kicking / defense) to match both the settings UI sections and the
 * rules-doc scoring table. Every key is a `section` in
 * libs-shared/scoring-columns.mjs, and the registry spec asserts the two agree
 * in both directions.
 * It additionally labels scoring fields that carry no UI control today
 * (`targets`, `rushing_first_downs`, `receiving_first_downs`,
 * `punt_return_touchdowns`, `kickoff_return_touchdowns`,
 * `fumble_return_touchdowns`, `is_excluding_quarterback_kneels`) so no raw field
 * key is ever surfaced.
 */

export const scoring_field_labels = {
  passing: {
    passing_attempts: 'Attempts',
    passing_completions: 'Completions',
    passing_yards: 'Yards',
    passing_interceptions: 'Ints',
    passing_touchdowns: 'Tds'
  },
  rushing: {
    rushing_attempts: 'Attempts',
    rushing_yards: 'Yards',
    fumbles_lost: 'Fumbles',
    rushing_touchdowns: 'Tds',
    rushing_first_downs: 'First Downs'
  },
  receiving: {
    running_back_reception: 'Rec. (RB)',
    wide_receiver_reception: 'Rec. (WR)',
    tight_end_reception: 'Rec. (TE)',
    receptions: 'Rec. (Other)',
    receiving_yards: 'Yards',
    receiving_touchdowns: 'Tds',
    targets: 'Targets',
    receiving_first_downs: 'First Downs'
  },
  misc: {
    two_point_conversions: 'Two PT Conv.',
    punt_return_touchdowns: 'Punt Return Tds',
    kickoff_return_touchdowns: 'Kick Return Tds',
    fumble_return_touchdowns: 'Fumble Return Tds',
    is_excluding_quarterback_kneels: 'Exclude QB Kneels'
  },
  kicking: {
    field_goal_yards: 'FG Yards',
    field_goals_made_0_19_yards: 'FG 0-19',
    field_goals_made_20_29_yards: 'FG 20-29',
    field_goals_made_30_39_yards: 'FG 30-39',
    field_goals_made_40_49_yards: 'FG 40-49',
    field_goals_made_50_plus_yards: 'FG 50+',
    extra_points_made: 'Extra Points'
  },
  defense: {
    defensive_sacks: 'Sacks',
    defensive_interceptions: 'Ints',
    defensive_forced_fumbles: 'Forced Fumbles',
    defensive_recovered_fumbles: 'Recovered Fumbles',
    defensive_three_and_outs: 'Three And Outs',
    defensive_fourth_down_stops: 'Fourth Down Stops',
    defensive_points_against: 'Points Against',
    defensive_points_against_threshold: 'Points Against Threshold',
    defensive_yards_against: 'Yards Against',
    defensive_yards_against_threshold: 'Yards Against Threshold',
    defensive_blocked_kicks: 'Blocked Kicks',
    defensive_safeties: 'Safeties',
    defensive_two_point_returns: 'Two PT Returns',
    defensive_touchdowns: 'Tds'
  }
}

export const starting_lineup_labels = {
  starter_slots_qb: 'QB',
  starter_slots_rb: 'RB',
  starter_slots_wr: 'WR',
  starter_slots_te: 'TE',
  starter_slots_k: 'K',
  starter_slots_dst: 'DST',
  starter_slots_rb_wr_flex: 'RB/WR',
  srbwrte: 'RB/WR/TE',
  sqbrbwrte: 'QB/RB/WR/TE',
  starter_slots_wr_te_flex: 'WR/TE'
}

export const roster_limit_labels = {
  max_roster_qb: 'QB',
  max_roster_rb: 'RB',
  max_roster_wr: 'WR',
  max_roster_te: 'TE',
  max_roster_k: 'K',
  max_roster_dst: 'DST',
  bench_slot_count: 'Bench',
  practice_squad_slot_count: 'PS',
  reserve_short_term_limit: 'Short Term Reserve Limit'
}
