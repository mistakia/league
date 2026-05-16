// Source-attach registry keyed `"<cell_identity>|<source_grain>|<mode>"`.
// Distinct semantic space from identity-bridge-registry: identity bridges
// compose row shapes; source-attach rules describe how a column's underlying
// fact-table row joins to the cell row given a (cell_identity, source_grain,
// mode) triple. Each rule may declare required identity bridges to apply
// before its predicate is emitted.

const rules = new Map()
const reachable = new Map()

const key_of = (cell_identity, source_grain, mode) =>
  `${cell_identity}|${source_grain}|${mode}`

export const register = (rule) => {
  const mode = rule.mode || 'default'
  const k = key_of(rule.cell_identity, rule.source_grain, mode)
  rules.set(k, rule)
  const reach_key = `${rule.cell_identity}|${rule.source_grain}`
  if (!reachable.has(reach_key)) reachable.set(reach_key, new Set())
  reachable.get(reach_key).add(mode)
}

export const resolve = (cell_identity, source_grain, mode = 'default') =>
  rules.get(key_of(cell_identity, source_grain, mode)) || null

export const has_rule = (cell_identity, source_grain, mode = 'default') =>
  rules.has(key_of(cell_identity, source_grain, mode))

export const is_reachable = ({ cell_identity, source_grain }) =>
  reachable.has(`${cell_identity}|${source_grain}`)

export { rules }
