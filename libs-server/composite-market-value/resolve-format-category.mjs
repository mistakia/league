import db from '#db'

const cache = new Map()

// Resolve league_format_id -> format_category (1..6) via the denormalized
// column on league_formats. Cache per-process.

export const resolve_format_category = async ({ league_format_id }) => {
  if (cache.has(league_format_id)) return cache.get(league_format_id)
  const row = await db('league_formats')
    .select('format_category')
    .where('id', league_format_id)
    .first()
  const fc = row?.format_category || null
  cache.set(league_format_id, fc)
  return fc
}

export default resolve_format_category
