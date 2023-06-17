import { Record, List } from 'immutable'

import { constants } from '@libs-shared'

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
  ir: null,

  mqb: null,
  mrb: null,
  mwr: null,
  mte: null,
  mdst: null,
  mk: null,

  faab: null,
  cap: null,

  pa: null,
  pc: null,
  py: null,
  ints: null,
  tdp: null,
  ra: null,
  ry: null,
  tdr: null,
  rbrec: null,
  wrrec: null,
  terec: null,
  rec: null,
  recy: null,
  twoptc: null,
  tdrec: null,
  fuml: null,
  prtd: null,
  krtd: null,

  tag2: null,
  tag3: null,
  tag4: null,

  ext1: null,
  ext2: null,
  ext3: null,
  ext4: null,

  adate: null,
  tddate: null,

  draft_start: null,
  draft_type: null,
  draft_hour_min: null,
  draft_hour_max: null,

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
  ir,

  mqb,
  mrb,
  mwr,
  mte,
  mdst,
  mk,

  faab,
  cap,

  pa,
  pc,
  py,
  ints,
  tdp,
  ra,
  ry,
  tdr,
  rbrec,
  wrrec,
  terec,
  rec,
  recy,
  twoptc,
  tdrec,
  fuml,
  prtd,
  krtd,

  tag2,
  tag3,
  tag4,

  ext1,
  ext2,
  ext3,
  ext4,

  adate,
  tddate,

  draft_start,
  draft_type,
  draft_hour_min,
  draft_hour_max,

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
    ir,

    mqb,
    mrb,
    mwr,
    mte,
    mdst,
    mk,

    faab,
    cap,

    pa,
    pc,
    py,
    ints,
    tdp,
    ra,
    ry,
    tdr,
    rbrec,
    wrrec,
    terec,
    rec,
    recy,
    twoptc,
    tdrec,
    fuml,
    prtd,
    krtd,

    tag2,
    tag3,
    tag4,

    ext1,
    ext2,
    ext3,
    ext4,

    adate,
    tddate,

    draft_start,
    draft_type,
    draft_hour_min,
    draft_hour_max,

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
    years: years ? new List(years) : new List([constants.year]),

    espn_id,
    sleeper_id,
    mfl_id,
    fleaflicker_id,

    season_due_amount,

    isLoading,
    isLoaded
  })
}
