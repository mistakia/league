import { blake2b } from 'blakejs'

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
  const key = `${pa}${pc}${py}${ints}${tdp}${ra}${ry}${tdr}${rec}${rbrec}${wrrec}${terec}${recy}${twoptc}${tdrec}${fuml}${prtd}${krtd}`

  const scoring_format_hash = Array.from(blake2b(key, null, 32))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

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
