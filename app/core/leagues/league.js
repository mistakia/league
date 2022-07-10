import { Record, List } from 'immutable'

export const League = new Record({
  uid: null,
  commishid: null,
  name: null,
  nteams: null,

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

  minBid: 0,
  hosted: 0,
  host: null,

  fqb: null,
  frb: null,
  fwr: null,
  fte: null,

  tran_start: null,
  tran_end: null,
  ext_date: null,

  b_qb: null,
  b_rb: null,
  b_wr: null,
  b_te: null,
  b_k: null,
  b_dst: null,

  teams: new List()
})

export function createLeague({
  uid,
  commishid,
  name,
  nteams,

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

  minBid,
  hosted,
  host,

  b_qb,
  b_rb,
  b_wr,
  b_te,
  b_k,
  b_dst,

  fqb,
  frb,
  fwr,
  fte,

  tran_start,
  tran_end,
  ext_date
}) {
  return new League({
    uid,
    commishid,
    name,
    nteams,

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

    minBid,
    hosted,
    host,

    b_qb,
    b_rb,
    b_wr,
    b_te,
    b_k,
    b_dst,

    fqb,
    frb,
    fwr,
    fte,

    tran_start,
    tran_end,
    ext_date
  })
}
