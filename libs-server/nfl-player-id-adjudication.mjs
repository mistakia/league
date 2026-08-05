/**
 * Does an nfl.com player name and a `player.formatted_name` describe the same
 * person?
 *
 * Shared by the ingest (`scripts/import-nfl-player-ids.mjs`) and the external
 * oracle (`scripts/audit-nfl-player-id-attribution.mjs`) so the rule has one
 * home. The ingest imports it to decide whether a run should raise a signal;
 * the audit imports it to decide what to release. Putting it in either script
 * would make the two import each other.
 *
 * ## Compare LAST NAMES, not full strings
 *
 * nfl.com serves DISPLAY names and we store legal ones, so a full-string
 * comparison reports the same person as a defect. Measured 2026-08-05 against
 * the live listing, 11 of 34 raw disagreements were this: kenny/kenneth
 * gainwell, jj/jonathan mccarthy, theo/theodore johnson, will/william shipley,
 * bucky/markeise irving, ray/remahn davis, tank/nathaniel dell, chris/
 * christopher brooks, ladd/andrew mcconkey, xavier/anthony legette, michael/mike
 * burton. A first-initial test fails most of those too, so the surname alone is
 * the comparison and the residue is small enough to read by hand.
 */

const GENERATIONAL_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

const normalize = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()

export const last_name_of = (name) => {
  const parts = normalize(name).split(/\s+/).filter(Boolean)
  if (!parts.length) return ''

  // Drop a generational suffix so `Ricky White III` compares as `white`.
  const trimmed = parts.filter((part) => !GENERATIONAL_SUFFIXES.has(part))
  const usable = trimmed.length ? trimmed : parts

  return usable[usable.length - 1]
}

/**
 * A LEGAL NAME CHANGE is the one disagreement the surname test cannot absorb —
 * the two surnames are genuinely unrelated, so the oracle reads a CORRECT value
 * as a defect and would propose destroying it.
 *
 * Each entry is pinned to both the pid and the value it was granted for, so a
 * row acquiring a different id re-reports rather than inheriting the pass. Keep
 * this list short and evidenced; it is not a place to silence a finding you
 * have not explained.
 */
export const ACCEPTED_NAME_DIFFERENCES = [
  {
    pid: 'ROBB-ANDE-017101',
    nfl_player_id: 2556462,
    card_name: 'Robbie Chosen',
    reason:
      'legal name change from Robbie Anderson in 2022; nfl.com serves the new name, our row carries the old one'
  }
]

export const is_accepted_name_difference = ({
  pid,
  nfl_player_id,
  card_name
}) =>
  ACCEPTED_NAME_DIFFERENCES.some(
    (accepted) =>
      accepted.pid === pid &&
      accepted.nfl_player_id === Number(nfl_player_id) &&
      last_name_of(accepted.card_name) === last_name_of(card_name)
  )

/**
 * @returns {boolean} true when the two names can be the same person, either by
 *   surname or by a recorded legal name change.
 */
export const names_can_be_same_person = ({
  pid,
  nfl_player_id,
  our_name,
  card_name
}) =>
  last_name_of(our_name) === last_name_of(card_name) ||
  is_accepted_name_difference({ pid, nfl_player_id, card_name })
