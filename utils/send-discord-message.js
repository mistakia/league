const fetch = require('node-fetch')

const sendDiscordMessage = async ({ webhookUrl, message }) => {
  const body = {
    content: message
  }
  await fetch(webhookUrl, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
}

module.exports = sendDiscordMessage
