// import db from '#db'

import sendVoiceNotifications from './send-voice-notifications.mjs'
import sendTextNotifications from './send-text-notifications.mjs'
import sendGroupmeMessage from './send-groupme-message.mjs'
import send_discord_message from './send-discord-message.mjs'

export default async function ({
  teamIds = [],
  league, // required
  message, // required
  notifyLeague,
  voice
}) {
  // prevent notifications in development environment
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const textMessages = []
  const voiceMessages = []
  /* const users = await db('users_teams')
   *   .join('teams', function() {
   *     this.on('users_teams.tid', '=', 'teams.uid')
   *         .andOn('users_teams.year', '=', 'teams.year')
   *   })
   *   .join('users', 'users_teams.userid', 'users.id')
   *   .where('teams.lid', league.uid)
   *   .where('teams.year', constants.season.year)
   */
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
      await send_discord_message({
        discord_webhook_url: league.discord_webhook_url,
        message
      })
    }
  }

  /* if (teamIds.length) {
   *   // filter based on affected teams
   *   const userTeams = users.filter((u) => teamIds.includes(u.tid))

   *   for (const user of userTeams) {
   *     // send team voice messages
   *     if (voice && user.phone && user.voice && user.teamvoice) {
   *       voiceMessages.push({
   *         id: `${league.uid}:${user.tid}:${user.userid}:${Date.now()}`,
   *         number: user.phone,
   *         message
   *       })
   *     }

   *     // send team text messages
   *     if (user.phone && user.text && user.teamtext) {
   *       textMessages.push({
   *         number: user.phone,
   *         message
   *       })
   *     }
   *   }
   * }
   */
  if (textMessages.length) await sendTextNotifications(textMessages)
  if (voiceMessages.length) await sendVoiceNotifications(voiceMessages)
}
