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
 * (`trg`, `rush_first_down`, `rec_first_down`, `prtd`, `krtd`, `fum_ret_td`,
 * `exclude_qb_kneels`) so no raw field key is ever surfaced.
 */

export const scoring_field_labels = {
  passing: {
    pa: 'Attempts',
    pc: 'Completions',
    py: 'Yards',
    ints: 'Ints',
    tdp: 'Tds'
  },
  rushing: {
    ra: 'Attempts',
    ry: 'Yards',
    fuml: 'Fumbles',
    tdr: 'Tds',
    rush_first_down: 'First Downs'
  },
  receiving: {
    rbrec: 'Rec. (RB)',
    wrrec: 'Rec. (WR)',
    terec: 'Rec. (TE)',
    rec: 'Rec. (Other)',
    recy: 'Yards',
    tdrec: 'Tds',
    trg: 'Targets',
    rec_first_down: 'First Downs'
  },
  misc: {
    twoptc: 'Two PT Conv.',
    prtd: 'Punt Return Tds',
    krtd: 'Kick Return Tds',
    fum_ret_td: 'Fumble Return Tds',
    exclude_qb_kneels: 'Exclude QB Kneels'
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
