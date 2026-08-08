import send_discord_message from './send-discord-message.mjs'

export default async function ({
  league, // required
  message, // required
  notifyLeague
}) {
  // prevent notifications in development environment
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  if (notifyLeague) {
    // send league discord messages
    if (league.discord_webhook_url) {
      await send_discord_message({
        discord_webhook_url: league.discord_webhook_url,
        message
      })
    }
  }
}
