import fetch from 'node-fetch'

export default async function ({ discord_webhook_url, message }) {
  // prevent notifications in development environment
  if (
    process.env.NODE_ENV !== 'production' ||
    !discord_webhook_url ||
    !message
  ) {
    return
  }

  const body = {
    content: message
  }
  await fetch(discord_webhook_url, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
}
