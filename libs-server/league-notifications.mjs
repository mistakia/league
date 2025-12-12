import debug from 'debug'
import db from '#db'

const log = debug('league-notifications')

/**
 * Check if a league notification has already been sent
 * @param {Object} params - Parameters
 * @param {number} params.lid - League ID
 * @param {number} params.year - Season year
 * @param {string} params.notification_type - Type of notification
 * @param {number} params.event_timestamp - Unix timestamp of the event being notified about
 * @returns {Promise<boolean>} True if notification was already sent
 */
export async function has_league_notification_been_sent({
  lid,
  year,
  notification_type,
  event_timestamp
}) {
  const existing_notification = await db('league_notifications')
    .where({
      lid,
      year,
      notification_type,
      event_timestamp
    })
    .first()

  return !!existing_notification
}

/**
 * Record that a league notification has been sent in the database
 * @param {Object} params - Parameters
 * @param {number} params.lid - League ID
 * @param {number} params.year - Season year
 * @param {string} params.notification_type - Type of notification
 * @param {number} params.event_timestamp - Unix timestamp of the event being notified about
 * @param {string} params.message - The notification message that was sent
 * @param {Object} params.metadata - Optional metadata to store with the notification
 * @returns {Promise<void>}
 */
export async function record_league_notification_sent({
  lid,
  year,
  notification_type,
  event_timestamp,
  message,
  metadata = null
}) {
  const sent_timestamp = Math.round(Date.now() / 1000)

  try {
    await db('league_notifications').insert({
      lid,
      year,
      notification_type,
      event_timestamp,
      sent_timestamp,
      message,
      metadata: metadata || null
    })
    log(
      `Recorded ${notification_type} notification sent for league ${lid}, year ${year}, event_timestamp ${event_timestamp}`
    )
  } catch (error) {
    // If it's a unique constraint violation, that's okay - it means another process
    // already sent the notification. Log it but don't throw.
    if (error.code === '23505') {
      // PostgreSQL unique violation error code
      log(
        `${notification_type} notification already recorded for league ${lid}, year ${year}, event_timestamp ${event_timestamp} (likely sent by another process)`
      )
    } else {
      // For other errors, log and rethrow
      log(`Error recording league notification: ${error.message}`)
      throw error
    }
  }
}
