/**
 * THE SALARY IN FORCE for a rostered player, as one rule in one place.
 *
 * `rosters_players` carries no value column, so a rostered player's salary is
 * `transactions.player_salary` and the only question is WHICH transaction. The
 * answer is the newest one agreed at or before the roster's own `(season_year,
 * week)` snapshot:
 *
 *   - The AS-OF BOUND is what stops the lookup reaching forward in time. Without
 *     it a historical roster reports a salary that had not been agreed yet, so an
 *     extension signed in a later season is backdated onto every earlier roster
 *     the player appears on. Measured in production before the first fix: 23,655
 *     of 44,293 rostered-player rows resolved to a transaction dated AFTER the
 *     roster carrying them.
 *
 *   - The ORDERING is `occurred_at`, not `transaction_id`. Ids are insertion
 *     order, which normally agrees with chronology and is therefore a rule that
 *     LOOKS correct for years. It stops agreeing the moment rows are inserted
 *     out of order -- a backfill, an import, a league clone -- and then the
 *     lookup silently returns a stale salary.
 *
 * This module exists because that rule was implemented three times and fixed
 * once. `get-roster.mjs` was repaired and gated; `get-league-rosters-from-
 * database.mjs` and `scripts/calculate-franchise-tag.mjs` kept an even weaker
 * form -- a bare `max(transaction_id)` with no bound and no ordering -- so the
 * board rendered one budget while the auction settled against another. Every new
 * caller reads this rule from here rather than restating it.
 */

/**
 * The transaction id carrying the salary in force, as a correlated scalar
 * subselect for a join's ON clause.
 *
 * Each of `tid`, `pid`, `as_of_year` and `as_of_week` is either a NUMBER, which
 * is bound as a parameter, or a STRING naming a column to correlate against
 * (`'rosters.tid'`, `'rosters_players.pid'`). That is what lets one rule serve a
 * caller with a fixed team and snapshot and a caller resolving per roster row.
 *
 * Yields NULL for a player with no qualifying transaction, so an INNER join on
 * it drops that player rather than admitting them with a null salary and turning
 * the cap arithmetic into NaN. That is deliberate; see get-roster.mjs.
 *
 * @param {object} params
 * @param {object} params.db - knex instance
 * @param {number|string} params.tid - team id, or a column naming it
 * @param {number|string} params.pid - player id, or a column naming it
 * @param {number|string} params.as_of_year - snapshot season year, or a column
 * @param {number|string} params.as_of_week - snapshot week, or a column
 * @returns {object} a knex raw scalar subselect
 */
export const build_salary_in_force_transaction_id = ({
  db,
  tid,
  pid,
  as_of_year,
  as_of_week
}) => {
  const bindings = []
  // A number is a value and gets a placeholder; a string is a column reference
  // and is interpolated. Nothing else is accepted, so a caller cannot smuggle an
  // expression in through the numeric path.
  const term = (value) => {
    if (typeof value === 'number') {
      bindings.push(value)
      return '?'
    }
    if (typeof value === 'string') return value
    throw new Error(
      `salary-in-force term must be a number or a column name, got ${typeof value}`
    )
  }

  const tid_term = term(tid)
  const pid_term = term(pid)
  const year_term = term(as_of_year)
  const week_term = term(as_of_week)

  return db.raw(
    `(select salary_transaction.transaction_id
        from transactions salary_transaction
       where salary_transaction.tid = ${tid_term}
         and salary_transaction.pid = ${pid_term}
         and (salary_transaction.season_year, salary_transaction.week) <= (${year_term}, ${week_term})
       order by salary_transaction.occurred_at desc, salary_transaction.transaction_id desc
       limit 1)`,
    bindings
  )
}
