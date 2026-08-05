import { Record, List } from 'immutable'

import { current_season } from '@constants'
import { scoring_column_names } from '@libs-shared/scoring-columns.mjs'

// An Immutable Record silently DROPS any key its declaration does not carry,
// and createLeague independently drops any key it does not name -- so a scoring
// column has to be declared in three places or it reaches the SPA as
// `undefined` with no lint error, no PropTypes warning and no build failure.
// Deriving all three from the registry is what makes adding a scoring column a
// one-file change: listing the 21 kicking and DST columns by hand here would
// have been a fourth enumeration to keep in agreement, and omitting them was
// the failure this replaces.
const scoring_column_declarations = Object.fromEntries(
  scoring_column_names.map((column) => [column, null])
)

const pick_scoring_columns = (source) =>
  Object.fromEntries(
    scoring_column_names.map((column) => [column, source[column]])
  )

export const League = new Record({
  uid: null,
  commishid: null,
  name: null,
  num_teams: null,

  sqb: null,
  srb: null,
  swr: null,
  ste: null,
  srbwr: null,
  srbwrte: null,
  sqbrbwrte: null,
  swrte: null,
  sdst: null,
  sk: null,

  bench: null,
  ps: null,
  reserve_short_term_limit: null,

  mqb: null,
  mrb: null,
  mwr: null,
  mte: null,
  mdst: null,
  mk: null,

  faab: null,
  cap: null,

  // Playoff format, from the seasons row. These MUST be declared here or
  // Immutable's Record silently drops them from the constructor payload and
  // get_playoff_seeding throws on undefined in the standings selector.
  playoff_team_count: null,
  bye_count: null,
  bye_candidate_pool: null,
  bye_selection_method: null,
  at_large_selection_method: null,
  has_division_winner_berths: null,

  ...scoring_column_declarations,

  tag2: null,
  tag3: null,
  tag4: null,

  ext1: null,
  ext2: null,
  ext3: null,
  ext4: null,

  free_agency_period_start: null,
  free_agency_period_end: null,
  free_agency_live_auction_start: null,
  free_agency_live_auction_end: null,
  tddate: null,

  draft_start: null,
  draft_type: null,
  draft_pick_interval: null,
  draft_hour_min: null,
  draft_hour_max: null,
  rookie_draft_completed_at: null,

  min_bid: 0,
  is_hosted: 0,

  fqb: null,
  frb: null,
  fwr: null,
  fte: null,

  restricted_free_agency_period_start: null,
  restricted_free_agency_period_end: null,
  restricted_free_agency_first_window_at: null,
  ext_date: null,

  b_QB: null,
  b_RB: null,
  b_WR: null,
  b_TE: null,
  b_K: null,
  b_DST: null,

  processed_at: null,

  teams: new List(),
  years: new List(),

  espn_id: null,
  sleeper_id: null,
  mfl_id: null,
  fleaflicker_id: null,

  season_due_amount: null,

  division_1_name: null,
  division_2_name: null,
  division_3_name: null,
  division_4_name: null,

  wildcard_round: null,
  championship_round: new List(),

  restricted_free_agency_window_hours: null,
  restricted_free_agency_processing_lead_hours: null,

  trade_veto_window_hours: null,

  isLoading: false,
  isLoaded: false
})

// Takes the whole payload rather than destructuring in the signature, so the
// scoring columns can be picked from it by the registry below.
export function createLeague(league_data = {}) {
  const {
    uid,
    commishid,
    name,
    num_teams,

    sqb,
    srb,
    swr,
    ste,
    srbwr,
    srbwrte,
    sqbrbwrte,
    swrte,
    sdst,
    sk,

    bench,
    ps,
    reserve_short_term_limit,

    mqb,
    mrb,
    mwr,
    mte,
    mdst,
    mk,

    faab,
    cap,

    playoff_team_count,
    bye_count,
    bye_candidate_pool,
    bye_selection_method,
    at_large_selection_method,
    has_division_winner_berths,

    tag2,
    tag3,
    tag4,

    ext1,
    ext2,
    ext3,
    ext4,

    free_agency_period_start,
    free_agency_period_end,
    free_agency_live_auction_start,
    free_agency_live_auction_end,
    tddate,

    draft_start,
    draft_type,
    draft_pick_interval,
    draft_hour_min,
    draft_hour_max,
    rookie_draft_completed_at,

    min_bid,
    is_hosted,

    b_QB,
    b_RB,
    b_WR,
    b_TE,
    b_K,
    b_DST,

    fqb,
    frb,
    fwr,
    fte,

    restricted_free_agency_period_start,
    restricted_free_agency_period_end,
    restricted_free_agency_first_window_at,
    ext_date,

    processed_at,

    teams,
    years,

    espn_id,
    sleeper_id,
    mfl_id,
    fleaflicker_id,

    season_due_amount,

    division_1_name,
    division_2_name,
    division_3_name,
    division_4_name,

    wildcard_round,
    championship_round,

    restricted_free_agency_window_hours,
    restricted_free_agency_processing_lead_hours,

    trade_veto_window_hours,

    isLoaded,
    isLoading
  } = league_data

  return new League({
    uid,
    commishid,
    name,
    num_teams,

    sqb,
    srb,
    swr,
    ste,
    srbwr,
    srbwrte,
    sqbrbwrte,
    swrte,
    sdst,
    sk,

    bench,
    ps,
    reserve_short_term_limit,

    mqb,
    mrb,
    mwr,
    mte,
    mdst,
    mk,

    faab,
    cap,

    playoff_team_count,
    bye_count,
    bye_candidate_pool,
    bye_selection_method,
    at_large_selection_method,
    has_division_winner_berths,

    ...pick_scoring_columns(league_data),

    tag2,
    tag3,
    tag4,

    ext1,
    ext2,
    ext3,
    ext4,

    free_agency_period_start,
    free_agency_period_end,
    free_agency_live_auction_start,
    free_agency_live_auction_end,
    tddate,

    draft_start,
    draft_type,
    draft_pick_interval,
    draft_hour_min,
    draft_hour_max,
    rookie_draft_completed_at,

    min_bid,
    is_hosted,

    b_QB,
    b_RB,
    b_WR,
    b_TE,
    b_K,
    b_DST,

    fqb,
    frb,
    fwr,
    fte,

    restricted_free_agency_period_start,
    restricted_free_agency_period_end,
    restricted_free_agency_first_window_at,
    ext_date,

    processed_at,

    teams: new List(teams),
    years: years ? new List(years) : new List([current_season.year]),

    espn_id,
    sleeper_id,
    mfl_id,
    fleaflicker_id,

    season_due_amount,

    division_1_name,
    division_2_name,
    division_3_name,
    division_4_name,

    wildcard_round,
    championship_round: new List(championship_round),

    restricted_free_agency_window_hours,
    restricted_free_agency_processing_lead_hours,

    trade_veto_window_hours,

    isLoading,
    isLoaded
  })
}
