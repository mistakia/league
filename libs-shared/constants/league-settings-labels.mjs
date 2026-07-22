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
 * misc) to match both the settings UI sections and the rules-doc scoring table.
 * It additionally labels scoring fields that carry no UI control today
 * (`targets`, `rushing_first_downs`, `receiving_first_downs`,
 * `punt_return_touchdowns`, `kickoff_return_touchdowns`,
 * `fumble_return_touchdowns`, `exclude_quarterback_kneels`) so no raw field
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
    exclude_quarterback_kneels: 'Exclude QB Kneels'
  }
}

export const starting_lineup_labels = {
  sqb: 'QB',
  srb: 'RB',
  swr: 'WR',
  ste: 'TE',
  sk: 'K',
  sdst: 'DST',
  srbwr: 'RB/WR',
  srbwrte: 'RB/WR/TE',
  sqbrbwrte: 'QB/RB/WR/TE',
  swrte: 'WR/TE'
}

export const roster_limit_labels = {
  mqb: 'QB',
  mrb: 'RB',
  mwr: 'WR',
  mte: 'TE',
  mk: 'K',
  mdst: 'DST',
  bench: 'Bench',
  ps: 'PS',
  reserve_short_term_limit: 'Short Term Reserve Limit'
}
