import { Record } from 'immutable'

export const League = new Record({
  uid: null,
  name: null,
  nteams: null,
  sqb: null,
  srb: null,
  swr: null,
  ste: null,
  srbwr: null,
  srbwrte: null,
  ssflex: null,
  swrte: null,
  sdst: null,
  sk: null,
  bench: null,
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
  rec: null,
  recy: null,
  twoptc: null,
  tdrec: null,
  fuml: null
})

export function createLeague ({
  uid,
  name,
  nteams,
  sqb,
  srb,
  swr,
  ste,
  srbwr,
  srbwrte,
  ssflex,
  swrte,
  sdst,
  sk,
  bench,
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
  rec,
  recy,
  twoptc,
  tdrec,
  fuml
}) {
  return new League ({
    uid,
    name,
    nteams,
    sqb,
    srb,
    swr,
    ste,
    srbwr,
    srbwrte,
    ssflex,
    swrte,
    sdst,
    sk,
    bench,
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
    rec,
    recy,
    twoptc,
    tdrec,
    fuml
  })
}
