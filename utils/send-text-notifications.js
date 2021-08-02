const fetch = require('node-fetch')
const debug = require('debug')
const config = require('../config')

const logger = debug('notifications:text')

const sendTextNotification = async (items) => {
  if (!config.clickSend.auth) {
    return
  }

  const messages = []
  for (const item of items) {
    messages.push({
      to: item.number,
      body: item.message,
      from: config.clickSend.number
    })
  }

  const body = { messages }

  logger(`Sending out ${messages.length} text notifications.`)

  const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
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

module.exports = sendTextNotification

/* eslint-disable no-extra-semi */
if (!module.parent) {
  ;(async function () {
    await sendTextNotification({
      number: '+61411111111',
      message: 'Test message from script'
    })
  })()
}
/* eslint-enable no-extra-semi */
