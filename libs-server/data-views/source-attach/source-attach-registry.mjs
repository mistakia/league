import debug from 'debug'

import { identities } from '#libs-server/data-views/identities.mjs'

// Source-attach registry keyed `"<cell_identity>|<source_grain>|<mode>"`.
// Distinct semantic space from identity-bridge-registry: identity bridges
// compose row shapes; source-attach rules describe how a column's underlying
// fact-table row joins to the cell row given a (cell_identity, source_grain,
// mode) triple. Each rule may declare required identity bridges to apply
// before its predicate is emitted.

const log = debug('data-views:source-attach')

const rules = new Map()

const key_of = (cell_identity, source_grain, mode) =>
  `${cell_identity}|${source_grain}|${mode}`

export const register = (rule) => {
  const mode = rule.mode || 'default'
  const k = key_of(rule.cell_identity, rule.source_grain, mode)
  if (rules.has(k)) {
    log(`source-attach rule overwrite for ${k}`)
  }
  rules.set(k, rule)
}

// The cell identities a lookup may fall back through, most specific first.
//
// An identity that declares `refines` is the identity it refines PLUS an extra
// dimension, with byte-identical reference columns for every dimension they
// share -- player_year_week_line is player_year_week plus a rung. A source that
// has no column for the extra dimension therefore cannot be correlated on it,
// and correlating on the shared columns alone is not a degraded answer but the
// only one: the source's value repeats down the ladder because it does not vary
// along it.
//
// So the fallback is total for the sources it serves, which is what makes it
// safe to walk silently rather than to enumerate. A source that DOES carry the
// extra dimension declares that grain, matches exactly, and never reaches here.
const cell_identity_chain = (cell_identity) => {
  const chain = []
  let current = cell_identity
  while (current && !chain.includes(current)) {
    chain.push(current)
    current = identities[current]?.refines
  }
  return chain
}

export const resolve = (cell_identity, source_grain, mode = 'default') => {
  for (const candidate of cell_identity_chain(cell_identity)) {
    const rule = rules.get(key_of(candidate, source_grain, mode))
    if (!rule) continue
    if (candidate !== cell_identity) {
      log(
        `source-attach rule for ${cell_identity}|${source_grain}|${mode} resolved via refined identity ${candidate}`
      )
    }
    return rule
  }
  return null
}

export { rules }
