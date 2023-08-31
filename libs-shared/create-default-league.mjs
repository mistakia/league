import generate_league_format_hash from './generate-league-format-hash.mjs'
import generate_scoring_format_hash from './generate-scoring-format-hash.mjs'

const createDefaultLeague = ({ commishid = 0 } = {}) => {
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
    ir: 3,
    mqb: 0,
    mrb: 0,
    mwr: 0,
    mte: 0,
    mdst: 3,
    mk: 3,
    faab: 200,
    cap: 200,
    pa: 0.0,
    pc: 0.0,
    py: 0.05,
    ints: -1,
    tdp: 4,
    ra: 0.0,
    ry: 0.1,
    tdr: 6,
    rec: 0.5,
    rbrec: 0.5,
    wrrec: 0.5,
    terec: 0.5,
    recy: 0.1,
    twoptc: 2,
    tdrec: 6,
    fuml: -1,
    krtd: 6,
    prtd: 6,
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
    processed_at: null
  }

  const scoring_format = generate_scoring_format_hash(league_params)
  league_params.scoring_format_hash = scoring_format.scoring_format_hash

  const league_format = generate_league_format_hash(league_params)
  league_params.league_format_hash = league_format.league_format_hash

  return league_params
}

export default createDefaultLeague
