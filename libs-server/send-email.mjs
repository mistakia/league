import { Resend } from 'resend'
import config from '#config'

const resend =
  config.email && config.email.resend_api_key
    ? new Resend(config.email.resend_api_key)
    : null

export default async function ({ to, subject, message }) {
  if (!resend) return
  await resend.emails.send({
    from: config.email.from,
    to,
    subject,
    text: message
  })
}
