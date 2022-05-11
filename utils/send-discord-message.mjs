import fetch from 'node-fetch'

export default async function ({ webhookUrl, message }) {
  const body = {
    content: message
  }
  await fetch(webhookUrl, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
}
