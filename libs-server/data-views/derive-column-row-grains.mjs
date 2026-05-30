import derive_granularity from './derive-granularity.mjs'

// Row-grain compatibility for a column-def. Explicit `def.row_grains` wins
// (escape hatch for future cross-grain defs). Otherwise inferred from each
// granularity entry's prefix: `team*` -> team grain, `player*` -> player
// grain. Returns a deduped array; empty when neither signal is present
// (treated by callers as "no declaration", same convention as
// derive_granularity).

const ROW_GRAIN_BY_PREFIX = [
  { prefix: 'team', row_grain: 'team' },
  { prefix: 'player', row_grain: 'player' }
]

export default function derive_column_row_grains(def) {
  if (Array.isArray(def?.row_grains) && def.row_grains.length) {
    return [...new Set(def.row_grains)]
  }
  const granularity = derive_granularity(def)
  const row_grains = new Set()
  for (const g of granularity) {
    const match = ROW_GRAIN_BY_PREFIX.find(({ prefix }) => g.startsWith(prefix))
    if (match) row_grains.add(match.row_grain)
  }
  return [...row_grains]
}
