/**
 * Determines the most recent practice status for a player based on the current date.
 *
 * Walks backward from the current day of the week to find the most recent practice status.
 * If no status is found in previous days, walks forward from the current day.
 *
 * @param {Object} params - The parameters object
 * @param {Object} params.practice - Practice object with day-of-week properties
 * @param {string|null} params.practice.m - Monday practice status (FULL, LIMITED, DNP, or null)
 * @param {string|null} params.practice.tu - Tuesday practice status
 * @param {string|null} params.practice.w - Wednesday practice status
 * @param {string|null} params.practice.th - Thursday practice status
 * @param {string|null} params.practice.f - Friday practice status
 * @param {string|null} params.practice.s - Saturday practice status
 * @param {string|null} params.practice.su - Sunday practice status
 * @param {Date} params.current_date - The current date to determine which practice day is most recent
 * @returns {string|null} The most recent practice status ('FULL', 'LIMITED', 'DNP') or null if no status exists
 */
export default function get_most_recent_practice_status({
  practice,
  current_date
}) {
  if (!practice) {
    return null
  }

  // Map day numbers (0=Sunday, 6=Saturday) to practice object properties
  const practice_day_map = {
    0: 'su', // Sunday
    1: 'm', // Monday
    2: 'tu', // Tuesday
    3: 'w', // Wednesday
    4: 'th', // Thursday
    5: 'f', // Friday
    6: 's' // Saturday
  }

  // Get current day of week (0=Sunday, 6=Saturday)
  const current_day_of_week = current_date.getDay()

  // Walk backward from current day to find first non-null value
  for (let days_back = 0; days_back <= 6; days_back++) {
    const day_to_check = (current_day_of_week - days_back + 7) % 7
    const practice_day_key = practice_day_map[day_to_check]
    const practice_status = practice[practice_day_key]

    if (practice_status !== null && practice_status !== undefined) {
      return practice_status
    }
  }

  // If no non-null value found, return null
  return null
}
