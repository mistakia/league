import ed25519 from '@trashman/ed25519-blake2b'

export default function ({
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
  krtd = 0
}) {
  const scoring_format_hash = ed25519
    .hash(
      `${pa}${pc}${py}${ints}${tdp}${ra}${ry}${tdr}${rec}${rbrec}${wrrec}${terec}${recy}${twoptc}${tdrec}${fuml}${prtd}${krtd}`
    )
    .toString('hex')

  return {
    scoring_format_hash,

    pa,
    pc,
    py,
    ints,
    tdp,
    ra,
    ry,
    tdr,
    rec,
    rbrec,
    wrrec,
    terec,
    recy,
    twoptc,
    tdrec,
    fuml,
    prtd,
    krtd
  }
}
