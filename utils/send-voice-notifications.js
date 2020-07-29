const fetch = require('node-fetch')
const config = require('../config')

const sendVoiceNotification = async (items) => {
  if (!config.clickSend.auth) {
    return
  }

  const messages = []
  for (const item of items) {
    const prefix = 'Official Teflon League Operations Notification.'
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

module.exports = sendVoiceNotification

if (!module.parent) {
  (async function () {
    await sendVoiceNotification([{
      number: '+61411111111',
      message: 'Hi Erin, please do not forget about the coffee. Thanks'
    }])
  })()
}
