export default async function ({ token, id, message }) {
  const url = `https://api.groupme.com/v3/bots/post?access_token=${encodeURIComponent(token)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: id, text: message })
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `GroupMe API error: ${response.status} ${response.statusText} - ${body}`
    )
  }
}
