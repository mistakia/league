/**
 * Could this player have recorded a stat in this season?
 *
 * Two pieces of evidence can falsify an attribution, and they are not equal.
 * `player.date_of_birth` is a fact about a human being. `player.nfl_draft_year`
 * is bookkeeping about a career. When a `player` row is a merge of two people
 * -- which is the defect this predicate is most often pointed at -- the birth
 * date stays with one of them and the draft year can come from the other, so
 * the draft year is the field that lies. **The birth date therefore decides
 * whenever it is present**, and the draft year is consulted only in its
 * absence.
 *
 * That ordering is the whole design, and getting it backwards is expensive.
 * This module shipped 2026-08-04 with the draft year as the only falsifier, and
 * a repair run against it deleted 1,560 `player_gamelogs` rows; re-measured
 * with birth dates, 450 of those rows across 15 players named players of
 * ordinary NFL age whose gamelogs were real. They were father/son conflations
 * -- `benny sapp` born 1981 carrying `nfl_draft_year: 2023`, `tyrone wheatley`
 * born 1972 carrying 2021, `kwamie lassiter` born 1969 carrying 2022, `devin
 * taylor` born 1989 carrying 2022. In every case the draft year belonged to the
 * son and condemned the father's real career.
 *
 * The contract this restores: **reject only the provably impossible.** Two
 * falsifiers disagreeing is not proof, it is a contradiction, and a predicate
 * whose only job is to reject must pass a contradiction. Rejecting a real
 * player is strictly the worse error here, because the caller's response to a
 * rejection is to drop or delete a row.
 *
 * ## The birth-date test
 *
 * The floor is 20 seasons because the youngest player in modern NFL history
 * (`amobi okoye`, born 1987-06-03, rookie season 2007) sits exactly at 20 by
 * this subtraction, and this predicate must never reject him. The observed
 * distribution has a cliff in the same place and nowhere else: measured
 * 2026-08-04 across `player_gamelogs`, 59 rows at age 20 and 8,544 at age 21,
 * against 138 spread thinly below -- one of them a player aged 1.
 *
 * `date_of_birth` is a varchar carrying a `0000-00-00` sentinel for unknown, so
 * a leading four-digit year is the only thing worth reading off it.
 *
 * ## The draft-year fallback
 *
 * `nfl_draft_year` is a DEBUT year only for a player who was actually drafted.
 * For an undrafted one it records the year the player entered the league by
 * whatever route the source knew about, and that routinely postdates the real
 * first appearance -- `cory procter` carries 2007 against gamelogs from 2005,
 * `rudy carpenter` 2011 against 2009. Applying the raw comparison without that
 * caveat makes the defect look five times larger than it is: the bare
 * `nfl_draft_year > season_year` test flags 2,955 rows across 320 players, of
 * which 1,079 rows across 314 players are undrafted players within two years of
 * their recorded entry year.
 *
 * The grace window is two years because that is where the undrafted
 * distribution elbows: 904 rows at a one-year gap, 175 at two, 52 at three, 20
 * at four.
 *
 * This branch reaches the corrupt column the rest of the module exists to work
 * around, and it is KEPT anyway. Reviewed 2026-08-04: 2,353 `player` rows carry
 * no usable birth date, and the branch rejects **zero** `player_gamelogs` rows
 * across zero players today, so weakening it buys nothing measurable — while
 * removing it would readmit exactly the era-impossible candidates 8f4292e08
 * filtered out of `resolve_play_stat_player`, since for a row with no birth
 * date this is the only falsifier there is.
 *
 * The exposure it leaves is real but it is not located here. A false rejection
 * only costs data when a caller responds to one by DELETING, so the fix belongs
 * at that caller: `prune_unreferenced_gamelogs` now refuses to delete a row
 * whose player this predicate rejects. That bound holds for a bad birth date
 * too, which no amount of reordering inside this module can cover.
 *
 * ## Not used as evidence
 *
 * `player_gamelogs`, `player_seasonlogs`, and any other table derived from
 * play-stat attribution: those are downstream of the identifiers this predicate
 * falsifies, so consulting them would be checking a value against itself.
 * `nfl_snaps` would be genuinely independent but only covers 2016 onward, while
 * the attribution defects concentrate in 2001-2015.
 */

// The youngest a real NFL player has been in a season, by year subtraction.
// See the birth-date section above -- amobi okoye sits exactly on this floor.
// Exported because it is the same floor the conflated-identity audit needs to
// decide whether an early gsis_it_player_id can be the player's OWN first
// contact; two copies of this number would be two answers to one question.
export const MINIMUM_PLAUSIBLE_AGE_IN_SEASON = 20

/*
  The band `nfl_draft_year` and `date_of_birth` have to agree within for the
  PAIR to be readable as one person's career. Entering the league outside it is
  not impossible, which is why the conflated-row audit only treats a breach as
  worth a human reading -- 47 of 25,514 rows with a usable birth date sit
  outside it, measured against production 2026-08-19, and all but a handful are
  visibly corrupt rather than late entries.

  Exported so the audit and the mint-time guard read one band. Two copies would
  be two answers to one question, and they would drift in the direction that
  matters: the guard silently admitting what the audit then reports.
*/
export const MINIMUM_PLAUSIBLE_ENTRY_AGE = 20
export const MAXIMUM_PLAUSIBLE_ENTRY_AGE = 30

// A player row whose `draft_round` is 0 or null went undrafted, so its
// `nfl_draft_year` is an entry year rather than a debut year. See above.
const UNDRAFTED_ENTRY_YEAR_GRACE_SEASONS = 2

const was_drafted = (player) => Number(player.draft_round) > 0

const birth_year_of = (player) => {
  const match = /^(\d{4})-/.exec(String(player.date_of_birth ?? ''))
  if (!match) return null

  const year = Number(match[1])
  return year > 1900 ? year : null
}

/**
 * @param {object} player - a `player` row carrying `date_of_birth`, or failing
 *   that `nfl_draft_year` and `draft_round`. A row carrying neither is not
 *   falsifiable and passes.
 * @param {number} season_year - the season of the game the stat belongs to.
 * @returns {boolean} false only when the player provably had not entered the
 *   league yet. Absent, unusable, or self-contradicting evidence returns true
 *   -- this predicate exists to REJECT an impossible attribution, never to
 *   confirm a possible one, so every uncertain case has to pass.
 */
export const player_could_have_played = ({ player, season_year }) => {
  if (!player || !season_year) return true

  // Decides on its own when present. A birth date that clears the floor makes
  // the row possible no matter what the draft year says, because a draft year
  // contradicting a birth date is evidence the row merges two players -- not
  // evidence about this season. See the module docstring.
  const birth_year = birth_year_of(player)
  if (birth_year)
    return season_year - birth_year >= MINIMUM_PLAUSIBLE_AGE_IN_SEASON

  const nfl_draft_year = Number(player.nfl_draft_year)
  if (!nfl_draft_year) return true

  if (was_drafted(player)) return nfl_draft_year <= season_year

  return nfl_draft_year - season_year <= UNDRAFTED_ENTRY_YEAR_GRACE_SEASONS
}

/**
 * Do a payload's OWN `date_of_birth` and `nfl_draft_year` contradict each other?
 *
 * Every other falsifier in this module reads a candidate row against an EXISTING
 * one, so a source record that is self-contradictory on a single line passes
 * them all and mints a fresh pid carrying the contradiction. Sleeper's
 * `/players/nfl/2933` is the recorded case: `birth_date` 1989-10-13 alongside
 * `metadata.rookie_year` 2025, minted as CORE-KNOX-044391 and only surfaced days
 * later by the standing audit.
 *
 * @param {object} player - carries `date_of_birth` and `nfl_draft_year`. Either
 *   one absent or unusable means there is no contradiction to see, so it passes.
 * @returns {boolean} true only when both fields are present and their implied
 *   entry age falls outside the plausible band.
 */
export const is_implausible_entry_age = (player) => {
  const birth_year = birth_year_of(player)
  const nfl_draft_year = Number(player?.nfl_draft_year)
  if (!birth_year || !nfl_draft_year) return false

  const entry_age = nfl_draft_year - birth_year
  return (
    entry_age < MINIMUM_PLAUSIBLE_ENTRY_AGE ||
    entry_age > MAXIMUM_PLAUSIBLE_ENTRY_AGE
  )
}

export default player_could_have_played
