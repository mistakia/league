/**
 * The one declaration of the negative-control block a gate prints and the
 * cluster runner reads.
 *
 * WHY THIS FILE EXISTS. `scripts/check-cluster-gates.mjs` verdicts a gate that
 * DECLARES a control and prints no block as BLIND, and it decided that by
 * looking for the literal `NEGATIVE CONTROL` in the gate's stdout -- a token no
 * gate was ever told to print. Twelve gates printed it by convention; one did
 * not. `check-ts-check-ratchet.mjs` printed four healthy controls as
 * `CONTROL WENT RED: <name>` and was reported BLIND on 2026-08-24, which is the
 * expensive direction: the response a BLIND verdict invites is weakening a gate
 * whose controls are all firing.
 *
 * This is the same class the gates guide already records for the per-line
 * phrasings (`RED as expected` vs `WENT RED`), moved into the runner's own
 * detection. The repair is not a wider pattern -- accepting a third spelling
 * only makes the fourth cheaper to introduce -- it is a marker that is DECLARED
 * in one place, imported by the runner that reads it and by the gates that
 * print it.
 *
 * A gate is free to format its own control lines (most here predate this file
 * and still do). What it must not do is invent its own header: print
 * NEGATIVE_CONTROL_MARKER, and use CONTROL_STAYED_GREEN_MARKER for a control
 * that did not go red, which the runner reads as a gate that cannot report.
 */

export const NEGATIVE_CONTROL_MARKER = 'NEGATIVE CONTROL'

export const CONTROL_STAYED_GREEN_MARKER = 'STAYED GREEN'

/**
 * The canonical block: the header the runner anchors on, then one line per
 * control naming what it proved.
 *
 * @param {object} params
 * @param {Array<{ name: string, went_red: boolean }>} params.controls
 * @returns {string}
 */
export const format_negative_controls = ({ controls }) =>
  [
    NEGATIVE_CONTROL_MARKER,
    ...controls.map(
      ({ name, went_red }) =>
        `  ${went_red ? 'RED as expected' : CONTROL_STAYED_GREEN_MARKER}  ${name}`
    )
  ].join('\n')
