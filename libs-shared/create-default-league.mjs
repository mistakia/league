import {
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from './default-format-ids.mjs'

// Default league params for the synthetic lid=0 league and as the seed
// payload for new-league creation. Format identities default to the named
// catalog's canonical default IDs; create_league() overrides them via
// find-or-create against the actual config tuple.
const create_default_league = ({ commishid = 0 } = {}) => {
  const league_params = {
    commishid,
    name: 'SUPERFLEX DYNASTY LEAGUE',
    num_teams: 12,
    playoff_team_count: 6,
    bye_count: 2,
    bye_candidate_pool: 'league',
    bye_selection_method: 'head_to_head',
    at_large_selection_method: 'head_to_head',
    has_division_winner_berths: false,
    head_to_head_berth_count: 0,
    starter_slots_qb: 1,
    starter_slots_rb: 2,
    starter_slots_wr: 2,
    starter_slots_te: 1,
    starter_slots_rb_wr_flex: 0,
    srbwrte: 1,
    sqbrbwrte: 1,
    starter_slots_wr_te_flex: 0,
    starter_slots_dst: 1,
    starter_slots_k: 1,
    bench_slot_count: 7,
    practice_squad_slot_count: 4,
    reserve_short_term_limit: 3,
    max_roster_qb: 0,
    max_roster_rb: 0,
    max_roster_wr: 0,
    max_roster_te: 0,
    max_roster_dst: 3,
    max_roster_k: 3,
    starting_faab_budget: 200,
    cap: 200,
    passing_attempts: 0.0,
    passing_completions: 0.0,
    passing_yards: 0.05,
    passing_interceptions: -1,
    passing_touchdowns: 4,
    rushing_attempts: 0.0,
    rushing_yards: 0.1,
    rushing_touchdowns: 6,
    receptions: 0.5,
    running_back_reception: 0.5,
    wide_receiver_reception: 0.5,
    tight_end_reception: 0.5,
    receiving_yards: 0.1,
    two_point_conversions: 2,
    receiving_touchdowns: 6,
    fumbles_lost: -1,
    kickoff_return_touchdowns: 6,
    punt_return_touchdowns: 6,
    fumble_return_touchdowns: 6,
    targets: 0.0,
    rushing_first_downs: 0.0,
    receiving_first_downs: 0.0,
    is_excluding_quarterback_kneels: false,
    draft_start: null,
    free_agency_live_auction_start: null,
    min_bid: 1,
    tddate: 1606626000,
    b_QB: 13.3,
    b_RB: 8.9,
    b_WR: 10.09,
    b_TE: 7.8,
    b_K: 9.7,
    b_DST: 7.2,
    processed_at: null,
    scoring_format_id: DEFAULT_SCORING_FORMAT_ID,
    league_format_id: DEFAULT_LEAGUE_FORMAT_ID
  }

  return league_params
}

export default create_default_league
