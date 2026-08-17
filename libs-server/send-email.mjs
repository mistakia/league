import { Resend } from 'resend'
import config from '#config'

// Resolved PER CALL rather than once at module load. Binding the client at
// import time made "no mail provider" a property of the process rather than of
// the config, so the not-configured branch below was unreachable for anything
// that had already imported this module -- including a spec, which is why the
// branch went uncovered while a caller silently ignored it in production.
const get_client = () => {
  const api_key = config.email && config.email.resend_api_key
  return api_key ? new Resend(api_key) : null
}

/**
 * Hands one message to the mail provider.
 *
 * WHAT THE RETURN VALUE MEANS, and what it does not. `is_sent` says Resend
 * ACCEPTED the message, which is the strongest thing any synchronous caller can
 * learn: whether it reaches the mailbox is decided later, and a bounce or a spam
 * placement is reported only over Resend's webhooks, which this app does not
 * receive. So a caller may say "we sent it", never "it arrived".
 *
 * RECEIVING THOSE WEBHOOKS WAS EVALUATED ON 2026-08-17 AND DECLINED, so that
 * the question is not re-opened from scratch each time a message goes missing.
 * The decisive point is that a webhook would not answer the case that prompted
 * it: a receiving MTA accepting a message and filing it in spam is a successful
 * delivery at the SMTP layer, so Gmail spam-foldering a reset link emits
 * `email.delivered` and nothing else -- `email.complained` fires only if the
 * recipient reports it, which someone who never saw the message cannot do. A
 * webhook catches hard bounces and complaints, and spam placement is the
 * likelier explanation for a reset nobody received.
 *
 * The cost was also higher than it looks. There is no send record anywhere in
 * `db/` to correlate against, so an arriving `email_id` cannot become "which
 * user" without a new table and writes at both call sites; skipping that table
 * by signalling on the payload's recipient address would put a raw email
 * address into a synced, indexed timeline, which both callers deliberately
 * avoid. `express.json()` is also global (`api/index.mjs`), so signature
 * verification needs a raw-body carve-out ahead of it, on a new unauthenticated
 * route mounted above the blanket auth guard.
 *
 * What covers the real need instead: the accepted message id is logged at the
 * reset call site, so a report of a missing email resolves as complaint ->
 * grep the log for `email_id` -> look it up in the Resend dashboard. Revisit
 * this if the two call sites become many, or if a bounce ever needs to reach
 * an operator without a user complaining first -- the webhook is the only
 * option that pushes rather than waits, and that is what would buy.
 *
 * IT THROWS ON A REFUSAL, and that is the whole reason this returns anything at
 * all. `resend.emails.send` RESOLVES with `{ data, error }` rather than
 * throwing -- every non-2xx becomes an `error` object on a fulfilled promise
 * (resend/dist/index.mjs, `fetchRequest`) -- so an unusable key, an unverified
 * sending domain or a rejected recipient all read as success to an `await` that
 * ignores the result. That is the surface-pipeline-failures shape: the failing
 * path and the healthy path had the same observable, and a caller telling a
 * user "check your email" could not have known better.
 *
 * A missing mailer config is NOT an error. Local development has none, and a
 * caller that can carry on without mail should carry on -- so it comes back as
 * `is_sent: false` for the caller to report honestly, rather than as a throw
 * that turns every dev-mode form into a 500.
 */
export default async function ({ to, subject, message }) {
  const resend = get_client()

  if (!resend) {
    return { is_sent: false, reason: 'no mail provider is configured' }
  }

  const { data, error } = await resend.emails.send({
    from: config.email.from,
    to,
    subject,
    text: message
  })

  if (error) {
    throw new Error(
      `the mail provider refused the message: ${error.message || error.name}`
    )
  }

  return { is_sent: true, email_id: data && data.id }
}
