import derive_granularity from './derive-granularity.mjs'

// Subject compatibility for a column-def. Explicit `def.subjects` wins
// (escape hatch for future cross-grain defs). Otherwise inferred from each
// granularity entry's prefix: `team*` -> team subject, `player*` -> player
// subject. Returns a deduped array; empty when neither signal is present
// (treated by callers as "no declaration", same convention as
// derive_granularity).

const SUBJECT_BY_PREFIX = [
  { prefix: 'team', subject: 'team' },
  { prefix: 'player', subject: 'player' }
]

export default function derive_column_subjects(def) {
  if (Array.isArray(def?.subjects) && def.subjects.length) {
    return [...new Set(def.subjects)]
  }
  const granularity = derive_granularity(def)
  const subjects = new Set()
  for (const g of granularity) {
    const match = SUBJECT_BY_PREFIX.find(({ prefix }) => g.startsWith(prefix))
    if (match) subjects.add(match.subject)
  }
  return [...subjects]
}
