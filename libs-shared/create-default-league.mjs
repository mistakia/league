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
    sqb: 1,
    srb: 2,
    swr: 2,
    ste: 1,
    srbwr: 0,
    srbwrte: 1,
    sqbrbwrte: 1,
    swrte: 0,
    sdst: 1,
    sk: 1,
    bench: 7,
    ps: 4,
    reserve_short_term_limit: 3,
    mqb: 0,
    mrb: 0,
    mwr: 0,
    mte: 0,
    mdst: 3,
    mk: 3,
    faab: 200,
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
    exclude_quarterback_kneels: false,
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
