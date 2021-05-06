const db = require('../db')
const sendVoiceNotifications = require('./send-voice-notifications')
const sendTextNotifications = require('./send-text-notifications')

const sendNotifications = async ({
  teamIds = [],
  leagueId, // required
  message, // required
  league,
  voice
}) => {
  const textMessages = []
  const voiceMessages = []
  const users = await db('users_teams')
    .join('teams', 'users_teams.tid', 'teams.uid')
    .join('users', 'users_teams.userid', 'users.id')
    .where('teams.lid', leagueId)

  if (league) {
    // send league text messages
    for (const [index, user] of users.entries()) {
      if (user.phone && user.text && user.leaguetext) {
        textMessages.push({
          number: user.phone,
          message
        })

        users.splice(index, 1)
      }
    }
  }

  if (teamIds.length) {
    // filter based on affected teams
    const userTeams = users.filter((u) => teamIds.includes(u.tid))

    for (const user of userTeams) {
      // send team text messages
      if (voice && user.phone && user.voice && user.teamvoice) {
        voiceMessages.push({
          id: `${leagueId}:${user.tid}:${user.userid}:${Date.now()}`,
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
