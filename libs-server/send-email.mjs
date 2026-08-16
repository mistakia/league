import { Resend } from 'resend'
import config from '#config'

const resend =
  config.email && config.email.resend_api_key
    ? new Resend(config.email.resend_api_key)
    : null

/**
 * Hands one message to the mail provider.
 *
 * WHAT THE RETURN VALUE MEANS, and what it does not. `is_sent` says Resend
 * ACCEPTED the message, which is the strongest thing any synchronous caller can
 * learn: whether it reaches the mailbox is decided later, and a bounce or a spam
 * placement is reported only over Resend's webhooks, which this app does not
 * receive. So a caller may say "we sent it", never "it arrived".
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
