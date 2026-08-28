// @ts-check

/*
  `player.date_of_birth` is a character varying whose "never learned" value is
  the `0000-00-00` sentinel rather than NULL. It is therefore truthy, exactly as
  long as a real date, and orders as the earliest date in the table -- so every
  naive treatment of it is wrong in a different direction:

  - read as a value, it defeats birth-date matching at mint time, because a row
    carrying it can never equal an incoming real date
  - read as a date, it sits ~1900 years from any true birth date, so any gate
    measuring a gap against it refuses everything
  - read as a string, it wins a longest-string tie-break against a real date,
    so a field merge can WRITE it over real biography

  It is an absence wearing a value. This module is the single home for that
  judgement so the predicate cannot fork: 2,254 of 28,822 player rows carried
  the sentinel when this was written (7.8%), measured with
  `select count(*) filter (where date_of_birth = '0000-00-00'), count(*) from player`.
*/
export const BIRTH_DATE_PLACEHOLDER = '0000-00-00'

/**
 * Whether a birth date carries real information rather than the sentinel.
 *
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export const is_real_birth_date = (value) =>
  Boolean(value) && String(value) !== BIRTH_DATE_PLACEHOLDER

/**
 * Whether a `player` column held nothing, for the purpose of asking whether a
 * merge lost data.
 *
 * Deliberately NOT the same predicate as `is_absent` in merge-player.mjs, which
 * uses a bare falsy test and so also treats `0` and `false` as absent. Widening
 * this one to match would change which columns the audit checks; narrowing that
 * one to match would change what the merge itself writes. They agree on every
 * case that can arise from a field merge -- the merge always keeps a value this
 * predicate would call present -- so the difference is inert, and it is spelled
 * out here because the two look like copies and are not.
 *
 * @param {any} value
 * @returns {boolean}
 */
export const is_absent_player_value = (value) =>
  value === null ||
  value === undefined ||
  value === '' ||
  value === BIRTH_DATE_PLACEHOLDER
