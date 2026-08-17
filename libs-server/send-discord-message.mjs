// League chat content only (transaction notifications to the league
// Discord channel). Operational alerts must go through `base signal emit`.
//
// Returns `{ is_sent }` rather than nothing, because `fetch` RESOLVES a refusal:
// a 404 from a webhook whose channel was deleted, a 401 from a rotated URL and a
// 429 all come back as an ordinary response, so a caller that only awaits this
// cannot tell a delivered message from one Discord threw away. That matters
// wherever the send is the whole point of the work and nothing will retry it —
// `scripts/announce-draft-slate.mjs` writes its once-only claim BEFORE posting,
// so an unreported refusal there is a permanently lost announcement recorded as
// delivered. Same class as the Resend `{ data, error }` shape in
// `libs-server/send-email.mjs`.
//
// Reporting rather than throwing keeps every existing caller's behavior
// identical: the transaction notifications ignore the return, and they run after
// their route has already answered, where a throw would be raised into a
// response that is on the wire.
//
// `is_sent: false` also covers the deliberate no-ops below (a non-production
// environment, an unconfigured webhook, an empty message), so a caller that
// treats it as failure must first know it is in a case where a send was owed.
export default async function ({ discord_webhook_url, message }) {
  // prevent notifications in development environment
  if (
    process.env.NODE_ENV !== 'production' ||
    !discord_webhook_url ||
    !message
  ) {
    return { is_sent: false }
  }

  const body = {
    content: message
  }
  const response = await fetch(discord_webhook_url, {
    method: 'post',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })

  return { is_sent: response.ok }
}
