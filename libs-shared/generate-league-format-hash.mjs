import { get_blake2b_hash } from '#libs-shared'

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
  ps = 0,
  ir = 0,
  cap = 0,
  min_bid = 0,
  scoring_format_hash
}) {
  if (!scoring_format_hash) {
    throw new Error('scoring_format_hash is required')
  }

  const key = `${num_teams}${sqb}${srb}${swr}${ste}${srbwr}${srbwrte}${sqbrbwrte}${swrte}${sdst}${sk}${bench}${ps}${ir}${cap}${min_bid}${scoring_format_hash}`

  const league_format_hash = get_blake2b_hash(key, 32)

  return {
    league_format_hash,
    scoring_format_hash,

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

    cap,
    min_bid
  }
}
