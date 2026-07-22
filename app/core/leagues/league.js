import { Record, List } from 'immutable'

import { current_season } from '@constants'

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

  passing_attempts: null,
  passing_completions: null,
  passing_yards: null,
  passing_interceptions: null,
  passing_touchdowns: null,
  rushing_attempts: null,
  rushing_yards: null,
  rushing_touchdowns: null,
  running_back_reception: null,
  wide_receiver_reception: null,
  tight_end_reception: null,
  receptions: null,
  receiving_yards: null,
  two_point_conversions: null,
  receiving_touchdowns: null,
  fumbles_lost: null,
  punt_return_touchdowns: null,
  kickoff_return_touchdowns: null,

  targets: null,
  rushing_first_downs: null,
  receiving_first_downs: null,
  exclude_quarterback_kneels: null,

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
  draft_hour_min: null,
  draft_hour_max: null,
  rookie_draft_completed_at: null,

  min_bid: 0,
  hosted: 0,

  fqb: null,
  frb: null,
  fwr: null,
  fte: null,

  tran_start: null,
  tran_end: null,
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

  restricted_free_agency_announcement_hour: null,
  restricted_free_agency_processing_hour: null,

  isLoading: false,
  isLoaded: false
})

export function createLeague({
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

  passing_attempts,
  passing_completions,
  passing_yards,
  passing_interceptions,
  passing_touchdowns,
  rushing_attempts,
  rushing_yards,
  rushing_touchdowns,
  running_back_reception,
  wide_receiver_reception,
  tight_end_reception,
  receptions,
  receiving_yards,
  two_point_conversions,
  receiving_touchdowns,
  fumbles_lost,
  punt_return_touchdowns,
  kickoff_return_touchdowns,

  targets,
  rushing_first_downs,
  receiving_first_downs,
  exclude_quarterback_kneels,

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
  draft_hour_min,
  draft_hour_max,
  rookie_draft_completed_at,

  min_bid,
  hosted,

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

  tran_start,
  tran_end,
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

  restricted_free_agency_announcement_hour,
  restricted_free_agency_processing_hour,

  isLoaded,
  isLoading
}) {
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

    passing_attempts,
    passing_completions,
    passing_yards,
    passing_interceptions,
    passing_touchdowns,
    rushing_attempts,
    rushing_yards,
    rushing_touchdowns,
    running_back_reception,
    wide_receiver_reception,
    tight_end_reception,
    receptions,
    receiving_yards,
    two_point_conversions,
    receiving_touchdowns,
    fumbles_lost,
    punt_return_touchdowns,
    kickoff_return_touchdowns,

    targets,
    rushing_first_downs,
    receiving_first_downs,
    exclude_quarterback_kneels,

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
    draft_hour_min,
    draft_hour_max,
    rookie_draft_completed_at,

    min_bid,
    hosted,

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

    tran_start,
    tran_end,
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

    restricted_free_agency_announcement_hour,
    restricted_free_agency_processing_hour,

    isLoading,
    isLoaded
  })
}
