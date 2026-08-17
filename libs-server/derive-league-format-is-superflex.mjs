import db from '#db'

// Market format class for a league, as the boolean the KeepTradeCut tables key
// on. KTC publishes two separate value sets and every read of
// `keeptradecut_valuations` / `keeptradecut_pick` must say which one it wants;
// consumers that hardcoded `is_superflex: true` produced superflex numbers for
// single-QB leagues with no error.
//
// The class is derived, never independently assigned -- `league_formats.sqb`
// and `starter_slots_superflex` are the league configuration's own slot counts, and this is
// the same expression the `cmv_derive_format_category` DB function applies
// (`sqb > 1 OR starter_slots_superflex > 0`). That function retires with the composite
// pipeline; this helper does not depend on it.
//
// A league's format can change between seasons, so the class is resolved over
// every format the league has ever used rather than its current one. All 116
// leagues resolve to a single class today and none is mixed. A league that ever
// crossed the axis has no single answer, and a caller reading point-in-time KTC
// values across that boundary needs a per-observation class rather than a
// per-run one -- so this throws rather than picking a side. Build the keyed
// form when a mixed league actually exists.

export const derive_league_format_is_superflex = async ({ lid }) => {
  if (lid == null) {
    throw new Error('derive_league_format_is_superflex requires a lid')
  }

  const rows = await db('seasons')
    .distinct(
      'league_formats.starter_slots_quarterback',
      'league_formats.starter_slots_superflex'
    )
    .join('league_formats', 'league_formats.id', 'seasons.league_format_id')
    .where('seasons.lid', lid)

  if (!rows.length) {
    throw new Error(
      `no league format found for lid=${lid}; cannot resolve market format class`
    )
  }

  const classes = new Set(
    rows.map(
      (row) =>
        row.starter_slots_quarterback > 1 || row.starter_slots_superflex > 0
    )
  )
  if (classes.size > 1) {
    throw new Error(
      `lid=${lid} spans both market format classes across its seasons; a single is_superflex value would be wrong for part of its history`
    )
  }

  return classes.values().next().value
}

export default derive_league_format_is_superflex
