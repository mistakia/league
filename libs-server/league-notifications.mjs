import debug from 'debug'
import db from '#db'

const log = debug('league-notifications')

// league_notifications.event_timestamp and .sent_timestamp are timestamptz.
// Every caller derives its event instant from an epoch-seconds source --
// dayjs().unix(), getDraftWindow().unix(), or the bigint seasons.extension_deadline_at --
// so this module keeps epoch seconds as its JS contract and converts once here
// at the database boundary rather than threading Dates through four scripts.
// Same shape as the nfl_games kickoff_at retype (b09fdbce).
const to_timestamptz = (epoch_seconds) => new Date(epoch_seconds * 1000)

/**
 * Check if a league notification has already been sent
 * @param {Object} params - Parameters
 * @param {number} params.lid - League ID
 * @param {number} params.season_year - Season year
 * @param {string} params.notification_type - Type of notification
 * @param {number} params.event_timestamp - Unix timestamp (seconds) of the event being notified about
 * @returns {Promise<boolean>} True if notification was already sent
 */
export async function has_league_notification_been_sent({
  lid,
  season_year,
  notification_type,
  event_timestamp
}) {
  const existing_notification = await db('league_notifications')
    .where({
      lid,
      season_year,
      notification_type,
      event_timestamp: to_timestamptz(event_timestamp)
    })
    .first()

  return !!existing_notification
}

/**
 * Atomically claim the right to send a league notification.
 *
 * The read-then-write pair of `has_league_notification_been_sent` followed by
 * `record_league_notification_sent` cannot prevent a duplicate send: two
 * processes can both read absent, and the loser's unique violation is swallowed
 * by the recorder, so both go on to send. That window is harmless for a
 * notification whose duplicate is merely noise, but not for one where a repeat
 * post to the league channel is the failure being designed against.
 *
 * This inserts the marker first and reports whether THIS caller created it, so
 * exactly one process proceeds to send. Callers that claim must treat a send
 * failure as loud -- the marker is already written, so nothing will retry.
 *
 * @param {Object} params - Parameters
 * @param {number} params.lid - League ID
 * @param {number} params.season_year - Season year
 * @param {string} params.notification_type - Type of notification
 * @param {number} params.event_timestamp - Unix timestamp (seconds) of the event being notified about
 * @param {string} params.message - The notification message being sent
 * @param {Object} params.metadata - Optional metadata to store with the notification
 * @returns {Promise<boolean>} True when this caller won the claim and should send
 */
export async function claim_league_notification({
  lid,
  season_year,
  notification_type,
  event_timestamp,
  message,
  metadata = null
}) {
  const inserted = await db('league_notifications')
    .insert({
      lid,
      season_year,
      notification_type,
      event_timestamp: to_timestamptz(event_timestamp),
      sent_timestamp: new Date(),
      message,
      metadata: metadata || null
    })
    .onConflict(['lid', 'season_year', 'notification_type', 'event_timestamp'])
    .ignore()
    .returning('uid')

  const claimed = inserted.length > 0
  log(
    `${claimed ? 'Claimed' : 'Declined'} ${notification_type} notification for league ${lid}, season_year ${season_year}, event_timestamp ${event_timestamp}`
  )

  return claimed
}

/**
 * Record that a league notification has been sent in the database
 * @param {Object} params - Parameters
 * @param {number} params.lid - League ID
 * @param {number} params.season_year - Season year
 * @param {string} params.notification_type - Type of notification
 * @param {number} params.event_timestamp - Unix timestamp (seconds) of the event being notified about
 * @param {string} params.message - The notification message that was sent
 * @param {Object} params.metadata - Optional metadata to store with the notification
 * @returns {Promise<void>}
 */
export async function record_league_notification_sent({
  lid,
  season_year,
  notification_type,
  event_timestamp,
  message,
  metadata = null
}) {
  try {
    await db('league_notifications').insert({
      lid,
      season_year,
      notification_type,
      event_timestamp: to_timestamptz(event_timestamp),
      sent_timestamp: new Date(),
      message,
      metadata: metadata || null
    })
    log(
      `Recorded ${notification_type} notification sent for league ${lid}, season_year ${season_year}, event_timestamp ${event_timestamp}`
    )
  } catch (error) {
    // If it's a unique constraint violation, that's okay - it means another process
    // already sent the notification. Log it but don't throw.
    if (error.code === '23505') {
      // PostgreSQL unique violation error code
      log(
        `${notification_type} notification already recorded for league ${lid}, season_year ${season_year}, event_timestamp ${event_timestamp} (likely sent by another process)`
      )
    } else {
      // For other errors, log and rethrow
      log(`Error recording league notification: ${error.message}`)
      throw error
    }
  }
}
