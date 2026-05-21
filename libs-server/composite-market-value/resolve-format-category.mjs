import db from '#db'

const cache = new Map()

// Resolve league_format_hash -> format_category (1..6) via the denormalized
// column on league_formats. Cache per-process.

export const resolve_format_category = async ({ league_format_hash }) => {
  if (cache.has(league_format_hash)) return cache.get(league_format_hash)
  const row = await db('league_formats')
    .select('format_category')
    .where('league_format_hash', league_format_hash)
    .first()
  const fc = row?.format_category || null
  cache.set(league_format_hash, fc)
  return fc
}

export default resolve_format_category
