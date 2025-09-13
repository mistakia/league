import { get_blake2b_hash } from '#libs-shared'

export default function ({
  pa = 0,
  pc = 0,
  py = 0,
  ints = 0,
  tdp = 0,
  ra = 0,
  ry = 0,
  tdr = 0,
  rush_first_down = 0,
  rec = 0,
  rbrec = 0,
  wrrec = 0,
  terec = 0,
  recy = 0,
  rec_first_down = 0,
  twoptc = 0,
  tdrec = 0,
  fuml = 0,
  prtd = 0,
  krtd = 0,
  trg = 0,
  exclude_qb_kneels = false
}) {
  // Core parameters from original hash function - maintains exact backward compatibility
  const core_key = `${pa}${pc}${py}${ints}${tdp}${ra}${ry}${tdr}${rec}${rbrec}${wrrec}${terec}${recy}${twoptc}${tdrec}${fuml}${prtd}${krtd}`

  // Extended parameters - only include if non-default values
  // This ensures existing scoring formats generate identical hashes
  let extended_key = ''

  if (trg !== 0) {
    extended_key += `_trg${trg}`
  }

  if (rush_first_down !== 0) {
    extended_key += `_rush_first_down${rush_first_down}`
  }

  if (rec_first_down !== 0) {
    extended_key += `_rec_first_down${rec_first_down}`
  }

  if (exclude_qb_kneels === true) {
    extended_key += `_exclude_qb_kneels${exclude_qb_kneels}`
  }

  const key = core_key + extended_key

  const scoring_format_hash = get_blake2b_hash(key, 32)

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
    rush_first_down,
    rec,
    rbrec,
    wrrec,
    terec,
    recy,
    rec_first_down,
    twoptc,
    tdrec,
    fuml,
    prtd,
    krtd,
    trg,
    exclude_qb_kneels
  }
}
