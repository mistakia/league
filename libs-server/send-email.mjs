import sgMail from '@sendgrid/mail'
import config from '#config'

if (config.email && config.email.api) {
  sgMail.setApiKey(config.email.api)
}

export default async function ({ to, subject, message }) {
  if (!config.email || !config.email.api) return
  const msg = {
    to,
    from: config.email.from,
    subject,
    text: message
  }
  await sgMail.send(msg)
}
