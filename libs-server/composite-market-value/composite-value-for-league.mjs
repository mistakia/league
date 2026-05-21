import db from '#db'

import resolve_format_category from '#libs-server/composite-market-value/resolve-format-category.mjs'

// Read-time helper: returns the composite market value for an asset on a date
// in the format category the given league belongs to.
//
// v1 is a pass-through: resolves format_category from league_format_hash and
// reads the base row. Per-league scoring modifiers (TEP, exotic-format) are
// deferred until the first such league imports; the helper exists as the
// stable abstraction boundary so consumers do not need rewriting later.

export const composite_value_for_league = async ({
  league_format_hash,
  asset_type,
  player_id,
  pick_year,
  pick_round,
  pick_original_owner_tid,
  date
}) => {
  const format_category = await resolve_format_category({ league_format_hash })
  if (!format_category) return null

  const q = db('composite_market_value_daily')
    .where('format_category', format_category)
    .where('asset_type', asset_type)
    .where('date', date)

  if (asset_type === 1) q.where('player_id', player_id)
  else if (asset_type === 2)
    q.where('pick_year', pick_year)
     .where('pick_round', pick_round)
     .where('pick_original_owner_tid', pick_original_owner_tid)
  else return null

  return q.first()
}

export default composite_value_for_league
