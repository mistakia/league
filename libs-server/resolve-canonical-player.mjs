// @ts-check
import { format_player_name } from '#libs-shared'
import db from '#db'

// No debug namespace here on purpose. This function is called once per create
// candidate and its verdict is only meaningful alongside the caller's own
// disposition counters, so the CALLER logs the outcome -- see
// import-players-sleeper's skipped_members, which prints every refusal by name
// and pid through console.log.

// player.date_of_birth is a character varying whose "never learned" value is
// this string, never NULL. See guideline/nfl/league/league-player-resolution.md.
export const BIRTH_DATE_PLACEHOLDER = '0000-00-00'

export const UNKNOWN_REASONS = {
  NO_NAME: 'no_name',
  PAYLOAD_BIRTH_DATE_ABSENT: 'payload_birth_date_absent',
  MULTIPLE_BIRTH_DATE_MATCHES: 'multiple_birth_date_matches',
  STORED_BIRTH_DATE_UNKNOWN: 'stored_birth_date_unknown',
  BIRTH_DATES_DIFFER: 'birth_dates_differ'
}

export const EXISTS_REASONS = {
  EXTERNAL_ID_HELD: 'external_id_held',
  NAME_AND_BIRTH_DATE: 'name_and_birth_date'
}

/*
  Every column here carries a UNIQUE index on `player`, so a row already holding
  one of these values makes the insert IMPOSSIBLE -- Postgres rejects it with
  23505 regardless of what any resolver believes about identity.

  That is why this rung is NOT an identity heuristic and is not in tension with
  the "no external-id rungs" reasoning below. It is a pre-check of a constraint
  the insert enforces anyway; the only question it answers is whether the caller
  finds out before or after wasting an insert.

  Measured in production 2026-08-17, on the first repaired run: the resolver's
  name rungs returned `new` for two entries the database then refused --
  sleeper 1771 "M Harris" against MARC-HARR-022384 "marcus harris" (same
  1989-03-01 birth date, same Murray State) and sleeper 11304 "E.J. Jenkins"
  against EMAN-JENK-017347 "emanuel jenkins" (same Georgia Tech, stored birth
  date is the placeholder). format_player_name maps neither abbreviated name
  onto its full-name row, so no name rung can ever reach either one. Both are
  the same human under an abbreviated first name, and both recurred on every
  run, which made the job's own oracle report failure nightly and permanently.
*/
export const UNIQUE_EXTERNAL_ID_COLUMNS = [
  'sleeper_player_id',
  'gsis_player_id',
  'sportradar_player_id',
  'espn_player_id',
  'yahoo_player_id',
  'rotoworld_player_id',
  'rotowire_player_id',
  'fantasy_data_player_id'
]

/** @typedef {import('#db/schema-types.js').PlayerRow} PlayerRow */

/**
 * The resolver's verdict.
 *
 * `status` is a closed three-value set, and naming it as one is the point: the
 * caller branches on it to decide whether a player may be CREATED, and a
 * misspelled status falls through every branch to the safe-looking one. Read
 * off the actual returns rather than guessed -- an earlier draft of this
 * typedef omitted `player_row` and `reason` entirely and the checker named
 * both.
 *
 * `candidates` is the player rows the name rungs reached; an empty list with
 * status `new` means a create is possible.
 *
 * @typedef {object} PlayerResolution
 * @property {'exists' | 'new' | 'unknown'} status
 * @property {Array<Record<string, any>>} [candidates]
 * @property {Record<string, any>} [player_row]
 * @property {string} [reason]
 * @property {string | null} [matched_external_id_column]
 */

/**
 * @param {{ date_of_birth?: string | null }} row
 * @returns {boolean}
 */
const holds_real_birth_date = (row) =>
  Boolean(row.date_of_birth) && row.date_of_birth !== BIRTH_DATE_PLACEHOLDER

/*
  Answers ONE question: does this person already have a player row, so that a
  caller must not create a second one?

  This is NOT find_player_row. That function answers "which row should I UPDATE",
  which wants narrow constraints so a name collision cannot hijack the wrong
  person's row. This one wants the widest reliable identity signal, because a
  false negative mints a duplicate person.

  ## Its only power is to refuse a create

  It never updates, never writes an identifier, and never picks a merge target.
  That is deliberate, and it is what lets a caller place it immediately before
  its create call rather than threading it through a lookup path: a function that
  performs no write needs no protection from the reused-name hijack and
  protected-id-collision guards an importer already carries. Adding an update
  power is a separate decision with a separate blast radius -- measured
  2026-08-17, giving it one inside import-players-sleeper's find_player_row
  fallback would have converted 781 non-fantasy iterations per run into identity
  writes on rows nobody had examined.

  ## Three outcomes, and why `unknown` cannot collapse into either neighbour

  A merge verdict is same-or-different. A creation verdict has a third state,
  and the asymmetry of the two errors is what forces it: a wrongly refused create
  costs one player one import cycle and is fixed by creating them later, while a
  wrong `exists` writes a vendor id onto a stranger and fuses two identities.
  Measured on the Sleeper create path, collapsing `unknown` toward `new`
  misclassified 9 existing people as new.

  ## The external-id rung is a constraint pre-check, not an identity ladder

  This function shipped 2026-08-17 with no id rung at all, on the measurement
  that of 573 unmatched Sleeper candidates only 2 resolved to a row the
  name+birth-date rule does not already reach -- and on the reasoning that
  vendor ids are mostly written BY the name-matching importer whose errors an
  existence check exists to catch, so they agree vacuously.

  The reasoning still holds for RANKING identity signals and the ladder is still
  not built. What the measurement got wrong is that those 2 were not harmless:
  both resolved as `new`, so the run attempted a create and Postgres rejected it
  on a UNIQUE index. See UNIQUE_EXTERNAL_ID_COLUMNS. The rung added afterwards
  asks a strictly narrower question than an identity ladder would -- "is this
  insert possible" rather than "who is this person" -- and its worst failure is a
  wrongly refused create, which is the cheap error by the asymmetry above.
*/
/**
 * @param {object} params
 * @param {string} params.name
 * @param {string} [params.date_of_birth]
 * @param {Record<string, string|number|null|undefined>} [params.external_ids]
 * @returns {Promise<PlayerResolution>}
 */
const resolve_canonical_player = async ({
  name,
  date_of_birth,
  external_ids = {}
}) => {
  /*
    Rung 0, ahead of the name rungs because it is a hard constraint rather than a
    signal: if any row already holds one of these unique ids, no create is
    possible at all. Ordering it first also means a caller never pays for the
    name query on a candidate the database was going to refuse.
  */
  const held_ids = UNIQUE_EXTERNAL_ID_COLUMNS.map((column) => ({
    column,
    value: external_ids[column]
  })).filter(
    ({ value }) => value !== null && value !== undefined && value !== ''
  )

  if (held_ids.length) {
    const id_matches = await db('player').where(function () {
      for (const { column, value } of held_ids) {
        this.orWhere(column, value)
      }
    })

    if (id_matches.length) {
      const player_row = id_matches[0]
      const matched = held_ids.find(
        ({ column, value }) => String(player_row[column]) === String(value)
      )
      return {
        status: 'exists',
        player_row,
        reason: EXISTS_REASONS.EXTERNAL_ID_HELD,
        matched_external_id_column: matched ? matched.column : null,
        candidates: id_matches
      }
    }
  }

  const formatted_name = format_player_name(name || '')
  if (!formatted_name) {
    return {
      status: 'unknown',
      reason: UNKNOWN_REASONS.NO_NAME,
      candidates: []
    }
  }

  // Deliberately a subquery rather than find_player_row's leftJoin: that join is
  // not deduplicated by pid, so a player holding two player_aliases rows comes
  // back twice and trips MatchedMultiplePlayers. CLEV-HARR-002939 holds exactly
  // two. player has no primary key, so GROUP BY player.pid is not available
  // either.
  // Hoisted rather than written inline in the orWhereIn. Identical SQL, but
  // check-knex-column-resolution binds a nested builder's columns to the
  // ENCLOSING statement's table, so inline it resolved formatted_alias against
  // `player` and failed the gate on a column that is correct on
  // `player_aliases`. Naming the statement is what lets the gate see the table.
  const alias_pids = db('player_aliases')
    .select('pid')
    .where({ formatted_alias: formatted_name })

  const candidates = await db('player').where(function () {
    this.where({ formatted_name }).orWhereIn('pid', alias_pids)
  })

  if (!candidates.length) {
    return {
      status: 'new',
      candidates: /** @type {Array<Record<string, any>>} */ ([])
    }
  }

  if (!date_of_birth || date_of_birth === BIRTH_DATE_PLACEHOLDER) {
    return {
      status: 'unknown',
      reason: UNKNOWN_REASONS.PAYLOAD_BIRTH_DATE_ABSENT,
      candidates
    }
  }

  const birth_date_matches = candidates.filter(
    (row) => holds_real_birth_date(row) && row.date_of_birth === date_of_birth
  )

  if (birth_date_matches.length === 1) {
    return {
      status: 'exists',
      player_row: birth_date_matches[0],
      reason: EXISTS_REASONS.NAME_AND_BIRTH_DATE,
      candidates
    }
  }

  // Load-bearing rather than defensive: 6 groups share a formatted_name and a
  // real birth date, and some of them are two humans -- a father and a son where
  // the son's row inherited the father's date.
  if (birth_date_matches.length > 1) {
    return {
      status: 'unknown',
      reason: UNKNOWN_REASONS.MULTIPLE_BIRTH_DATE_MATCHES,
      candidates: birth_date_matches
    }
  }

  if (candidates.some((row) => !holds_real_birth_date(row))) {
    return {
      status: 'unknown',
      reason: UNKNOWN_REASONS.STORED_BIRTH_DATE_UNKNOWN,
      candidates
    }
  }

  /*
    Every name match carries a real birth date and all of them differ. This is
    NOT a create.

    Measured 2026-08-17 and then adjudicated against nflverse players.csv and
    Pro Football Reference: of the 16 Sleeper candidates in this state, 10 were
    ONE person with a noisy birth date and only 6 were genuinely different
    people. Among 8,426 confirmed-same pairs (a player row and a Sleeper entry
    linked by sleeper_player_id, a linkage made on name/position/team that never
    consulted a birth date), the two dates disagree in 4.00% -- 126 of them by a
    single day. Three of the 16 were our own row holding an ELDER NAMESAKE's
    birth date.

    So a real-vs-real disagreement does not deny identity, and a rule that
    creates on one mints a duplicate roughly half the time it fires.
  */
  return {
    status: 'unknown',
    reason: UNKNOWN_REASONS.BIRTH_DATES_DIFFER,
    candidates
  }
}

export default resolve_canonical_player

/**
 * @param {{ name: string, date_of_birth?: string, resolution: PlayerResolution }} params
 * @returns {string}
 */
export const describe_resolution = ({ name, date_of_birth, resolution }) => {
  const pids = (resolution.candidates || [])
    .map((/** @type {{ pid: string }} */ row) => row.pid)
    .join(', ')
  const matched_column = resolution.matched_external_id_column
    ? ` on=${resolution.matched_external_id_column}`
    : ''
  return `${resolution.status}${
    resolution.reason ? ` (${resolution.reason})` : ''
  }: "${name}" dob=${date_of_birth || 'absent'}${matched_column} candidates=[${pids}]`
}

export { holds_real_birth_date }
