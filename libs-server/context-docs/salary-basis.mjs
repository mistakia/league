import is_before_extension_deadline from '#libs-shared/is-before-extension-deadline.mjs'

import { format_date_et } from './markdown.mjs'

/**
 * Resolve which salary basis a doc is reporting, so the number a reader sees is
 * never ambiguous about the extension deadline. `Roster` prices every row on the
 * post-extension basis while the extension window is open and on the
 * as-recorded basis once it closes; this mirrors that single decision into a
 * column label, a prose note, and a machine-readable value. Every doc that
 * prints a salary renders from this, so the four surfaces cannot drift.
 */
export function resolve_salary_basis({ league, year }) {
  const before_deadline = is_before_extension_deadline({ league })
  const deadline = league.ext_date
    ? format_date_et(league.ext_date)
    : 'not configured'

  return {
    before_deadline,
    frontmatter_value: before_deadline ? 'post_extension' : 'as_recorded',
    column_label: before_deadline
      ? `${year} Salary (post-extension)`
      : `${year} Salary`,
    note: before_deadline
      ? `Salary basis: **post-extension ${year}**. The extension deadline (${deadline}) has not passed, so every salary below is what the contract will carry in ${year} once extensions and tags are applied — each extension adds $5 over the prior season, a franchise tag is repriced to the position's franchise amount, and a restricted-free-agency tag is priced at its winning bid. Practice-squad contracts are not extended and show their recorded salary. These figures differ from the pre-extension salary currently recorded on the contract, and cap space is computed on the same post-extension basis.`
      : `Salary basis: **${year} as recorded**. The extension deadline (${deadline}) has passed, so every salary below is the contract's current ${year} salary with extensions and tags already applied. Cap space is computed on the same basis.`
  }
}
