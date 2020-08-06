const sgMail = require('@sendgrid/mail')
const config = require('../config')
if (config.email && config.email.api) sgMail.setApiKey(config.email.api)

module.exports = async ({ to, subject, message }) => {
  if (!config.email || !config.email.api) return
  const msg = {
    to,
    from: config.email.from,
    subject,
    text: message
  }
  await sgMail.send(msg)
}
