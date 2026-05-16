import debug from 'debug'

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

export const resolve = (cell_identity, source_grain, mode = 'default') =>
  rules.get(key_of(cell_identity, source_grain, mode)) || null

export { rules }
