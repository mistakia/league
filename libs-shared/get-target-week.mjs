import dayjs from 'dayjs'
import { current_season } from '#constants'

/**
 * Determines the target week based on current day of week
 *
 * Logic:
 * - On Tuesday (2) or Wednesday (3): process previous week
 * - Otherwise: process current week
 * - Minimum week is 1
 *
 * This is used by scripts that need to determine which week to process
 * when no explicit week is provided. The logic accounts for the fact that
 * games typically finish by Monday, so Tuesday/Wednesday are good times
 * to process the previous week's results.
 *
 * @returns {number} The target week number (minimum 1)
 */
export default function get_target_week() {
  const day = dayjs().day()
  return Math.max(
    [2, 3].includes(day) ? current_season.week - 1 : current_season.week,
    1
  )
}
