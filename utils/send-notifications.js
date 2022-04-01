const db = require('../db')
const sendVoiceNotifications = require('./send-voice-notifications')
const sendTextNotifications = require('./send-text-notifications')
const sendGroupmeMessage = require('./send-groupme-message')
const sendDiscordMessage = require('./send-discord-message')

const sendNotifications = async ({
  teamIds = [],
  league, // required
  message, // required
  notifyLeague,
  voice
}) => {
  // prevent notifications in development environment
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const textMessages = []
  const voiceMessages = []
  const users = await db('users_teams')
    .join('teams', 'users_teams.tid', 'teams.uid')
    .join('users', 'users_teams.userid', 'users.id')
    .where('teams.lid', league.uid)

  if (notifyLeague) {
    // send league text messages

    // disable league text notifications
    /* for (const [index, user] of users.entries()) {
     *   if (user.phone && user.text && user.leaguetext) {
     *     textMessages.push({
     *       number: user.phone,
     *       message
     *     })

     *     users.splice(index, 1)
     *   }
     * }
     */
    // send league groupme messages
    if (league.groupme_token && league.groupme_id) {
      await sendGroupmeMessage({
        token: league.groupme_token,
        id: league.groupme_id,
        message
      })
    }

    // send league discord messages
    if (league.discord_webhook_url) {
      await sendDiscordMessage({
        webhookUrl: league.discord_webhook_url,
        message
      })
    }
  }

  if (teamIds.length) {
    // filter based on affected teams
    const userTeams = users.filter((u) => teamIds.includes(u.tid))

    for (const user of userTeams) {
      // send team text messages
      if (voice && user.phone && user.voice && user.teamvoice) {
        voiceMessages.push({
          id: `${league.uid}:${user.tid}:${user.userid}:${Date.now()}`,
          number: user.phone,
          message
        })
      }

      // send team voice messages
      if (user.phone && user.text && user.teamtext) {
        textMessages.push({
          number: user.phone,
          message
        })
      }
    }
  }

  if (textMessages.length) await sendTextNotifications(textMessages)
  if (voiceMessages.length) await sendVoiceNotifications(voiceMessages)
}

module.exports = sendNotifications
