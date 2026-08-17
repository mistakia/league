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

  ## There are deliberately no external-id rungs

  Measured on 573 unmatched Sleeper create candidates: 1 carried a gsis id and it
  resolved to zero rows, and of 543 carrying a sportradar id only 2 resolved to a
  row this name+birth-date rule does not already reach. The vendor ids a feed
  supplies are mostly written BY the name-matching importer whose errors an
  existence check exists to catch, so they cannot detect those errors -- they
  agree perfectly and vacuously. gsis_player_id is the one id that dissents, and
  a feed does not carry it for exactly the unmatched players this is about.
*/
const resolve_canonical_player = async ({ name, date_of_birth }) => {
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
    return { status: 'new', candidates: [] }
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
    return { status: 'exists', player_row: birth_date_matches[0], candidates }
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

export const describe_resolution = ({ name, date_of_birth, resolution }) => {
  const pids = (resolution.candidates || []).map((row) => row.pid).join(', ')
  return `${resolution.status}${
    resolution.reason ? ` (${resolution.reason})` : ''
  }: "${name}" dob=${date_of_birth || 'absent'} candidates=[${pids}]`
}

export { holds_real_birth_date }
