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

  starter_slots_qb: null,
  starter_slots_rb: null,
  starter_slots_wr: null,
  starter_slots_te: null,
  starter_slots_rb_wr_flex: null,
  srbwrte: null,
  sqbrbwrte: null,
  starter_slots_wr_te_flex: null,
  starter_slots_dst: null,
  starter_slots_k: null,

  bench_slot_count: null,
  practice_squad_slot_count: null,
  reserve_short_term_limit: null,

  max_roster_qb: null,
  max_roster_rb: null,
  max_roster_wr: null,
  max_roster_te: null,
  max_roster_dst: null,
  max_roster_k: null,

  starting_faab_budget: null,
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
  head_to_head_berth_count: null,

  ...scoring_column_declarations,

  franchise_tag_limit: null,
  rookie_tag_limit: null,
  restricted_free_agency_tag_limit: null,

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

  // League pause. `paused_at` drives the banner and every frozen clock;
  // `draft_pause_periods` is the interval list the rookie draft window credits
  // back. A Record DROPS any key it does not declare, so both must appear here,
  // in the destructure below, and in the constructor call -- a miss shows up as
  // a banner that never renders and a draft clock that credits nothing, with no
  // error anywhere. `pause_reason` is deliberately absent: it is not on the
  // wire, because the unauthenticated league GET would publish it.
  paused_at: null,
  draft_pause_periods: new List(),

  min_bid: 0,
  is_hosted: 0,

  franchise_tag_salary_qb: null,
  franchise_tag_salary_rb: null,
  franchise_tag_salary_wr: null,
  franchise_tag_salary_te: null,

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

  espn_league_id: null,
  sleeper_league_id: null,
  mfl_league_id: null,
  fleaflicker_league_id: null,

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

    starter_slots_qb,
    starter_slots_rb,
    starter_slots_wr,
    starter_slots_te,
    starter_slots_rb_wr_flex,
    srbwrte,
    sqbrbwrte,
    starter_slots_wr_te_flex,
    starter_slots_dst,
    starter_slots_k,

    bench_slot_count,
    practice_squad_slot_count,
    reserve_short_term_limit,

    max_roster_qb,
    max_roster_rb,
    max_roster_wr,
    max_roster_te,
    max_roster_dst,
    max_roster_k,

    starting_faab_budget,
    cap,

    playoff_team_count,
    bye_count,
    bye_candidate_pool,
    bye_selection_method,
    at_large_selection_method,
    has_division_winner_berths,
    head_to_head_berth_count,

    franchise_tag_limit,
    rookie_tag_limit,
    restricted_free_agency_tag_limit,

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
    paused_at,
    draft_pause_periods,

    min_bid,
    is_hosted,

    b_QB,
    b_RB,
    b_WR,
    b_TE,
    b_K,
    b_DST,

    franchise_tag_salary_qb,
    franchise_tag_salary_rb,
    franchise_tag_salary_wr,
    franchise_tag_salary_te,

    restricted_free_agency_period_start,
    restricted_free_agency_period_end,
    restricted_free_agency_first_window_at,
    ext_date,

    processed_at,

    teams,
    years,

    espn_league_id,
    sleeper_league_id,
    mfl_league_id,
    fleaflicker_league_id,

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

    starter_slots_qb,
    starter_slots_rb,
    starter_slots_wr,
    starter_slots_te,
    starter_slots_rb_wr_flex,
    srbwrte,
    sqbrbwrte,
    starter_slots_wr_te_flex,
    starter_slots_dst,
    starter_slots_k,

    bench_slot_count,
    practice_squad_slot_count,
    reserve_short_term_limit,

    max_roster_qb,
    max_roster_rb,
    max_roster_wr,
    max_roster_te,
    max_roster_dst,
    max_roster_k,

    starting_faab_budget,
    cap,

    playoff_team_count,
    bye_count,
    bye_candidate_pool,
    bye_selection_method,
    at_large_selection_method,
    has_division_winner_berths,
    head_to_head_berth_count,

    ...pick_scoring_columns(league_data),

    franchise_tag_limit,
    rookie_tag_limit,
    restricted_free_agency_tag_limit,

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
    paused_at,
    // Kept as a List so the field has one type everywhere: the wire delivers a
    // plain array, the Record default is a List, and a consumer that has to ask
    // which one it got is a consumer that will eventually guess wrong.
    draft_pause_periods: new List(draft_pause_periods || []),

    min_bid,
    is_hosted,

    b_QB,
    b_RB,
    b_WR,
    b_TE,
    b_K,
    b_DST,

    franchise_tag_salary_qb,
    franchise_tag_salary_rb,
    franchise_tag_salary_wr,
    franchise_tag_salary_te,

    restricted_free_agency_period_start,
    restricted_free_agency_period_end,
    restricted_free_agency_first_window_at,
    ext_date,

    processed_at,

    teams: new List(teams),
    years: years ? new List(years) : new List([current_season.year]),

    espn_league_id,
    sleeper_league_id,
    mfl_league_id,
    fleaflicker_league_id,

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
