import fetch from 'node-fetch'
import config from '#config'

export default async function (items) {
  if (!config.clickSend.auth) {
    return
  }

  const messages = []
  for (const item of items) {
    // TODO use league name
    const prefix = 'Official League Operations Notification.'
    messages.push({
      voice: 'female',
      to: item.number,
      body: `${prefix} ${item.message}`,
      country: 'USA',
      custom_string: item.id,
      require_input: 0,
      machine_detection: 1
    })
  }

  const body = { messages }

  const res = await fetch('https://rest.clicksend.com/v3/voice/send', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Basic ${config.clickSend.auth}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    // TODO error logging
    console.log(res.statusText)
  }
}
