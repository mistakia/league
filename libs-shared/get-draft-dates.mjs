import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { DRAFT_TIMEZONE } from './draft-daily-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

const WAIVER_HOURS_AFTER_COMPLETION = 24

/**
 * Reads when the draft closes and when the post-draft waiver period on
 * undrafted rookies ends.
 *
 * `draftEnd` is a hard cutoff: the draft route refuses selections past it, so
 * any pick still unmade is forfeited and its rookies fall to practice-squad
 * waivers.
 *
 * It is READ from `seasons.rookie_draft_end_at` rather than projected from the
 * cadence, and that is forced by the published-slate rule rather than merely
 * tidier. The old projection was the end of the day `window(total_picks + 1)`
 * fell on, and under the slate that expression is a function of the CURRENT
 * publication — so a derived end would move every midnight, which is not
 * something a hard cutoff may do.
 *
 * @param {object} args
 * @param {Date|string} [args.rookie_draft_end_at] - The hard cutoff, timestamptz.
 *   Null only for a league with no draft configured, whose callers all guard on
 *   `draft_start` first; a season that HAS a `draft_start` is guaranteed to
 *   carry one by `seasons_rookie_draft_end_at_set_with_start`.
 * @param {Date|string} [args.rookie_draft_completed_at] - Explicit completion
 *   timestamp, if recorded. Authoritative when present: it records that the
 *   draft actually ended, rather than when it was scheduled to.
 *
 * Both are timestamptz as of the 2026-08-07 conformance pass and both are
 * always DB-sourced, so they are taken as instants here rather than converted
 * at each caller.
 *
 * @returns {{ draftEnd: import('dayjs').Dayjs|null, waiverEnd: import('dayjs').Dayjs|null }}
 */
export default function getDraftDates({
  rookie_draft_end_at,
  rookie_draft_completed_at
}) {
  if (rookie_draft_completed_at) {
    const draftEnd = dayjs(rookie_draft_completed_at).tz(DRAFT_TIMEZONE)
    const waiverEnd = draftEnd
      .add(WAIVER_HOURS_AFTER_COMPLETION, 'hours')
      .endOf('day')

    return { draftEnd, waiverEnd }
  }

  if (!rookie_draft_end_at) {
    return { draftEnd: null, waiverEnd: null }
  }

  const draftEnd = dayjs(rookie_draft_end_at).tz(DRAFT_TIMEZONE)
  const waiverEnd = draftEnd.add(1, 'day')

  return { draftEnd, waiverEnd }
}
