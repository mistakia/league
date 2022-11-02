import fetch from 'node-fetch'

export default async function ({ webhookUrl, message }) {
  // prevent notifications in development environment
  if (process.env.NODE_ENV !== 'production' || !webhookUrl || !message) {
    return
  }

  const body = {
    content: message
  }
  await fetch(webhookUrl, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
}
