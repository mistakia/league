import ed25519 from '@trashman/ed25519-blake2b'

export default function ({
  num_teams = 0,
  sqb = 0,
  srb = 0,
  swr = 0,
  ste = 0,
  srbwr = 0,
  srbwrte = 0,
  sqbrbwrte = 0,
  swrte = 0,
  sdst = 0,
  sk = 0,
  bench = 0,
  pa = 0,
  pc = 0,
  py = 0,
  ints = 0,
  tdp = 0,
  ra = 0,
  ry = 0,
  tdr = 0,
  rec = 0,
  rbrec = 0,
  wrrec = 0,
  terec = 0,
  recy = 0,
  twoptc = 0,
  tdrec = 0,
  fuml = 0,
  prtd = 0,
  krtd = 0,
  cap = 0,
  min_bid = 0
}) {
  return ed25519
    .hash(
      `${num_teams}${sqb}${srb}${swr}${ste}${srbwr}${srbwrte}${sqbrbwrte}${swrte}${sdst}${sk}${bench}${pa}${pc}${py}${ints}${tdp}${ra}${ry}${tdr}${rec}${recy}${rbrec}${wrrec}${terec}${twoptc}${tdrec}${fuml}${prtd}${krtd}${cap}${min_bid}`
    )
    .toString('hex')
}
