import db from '#db'
import { job_details } from '#libs-shared/job-constants.mjs'

import send_discord_message from './send-discord-message.mjs'

export default async function report_error({ job_type, error, message }) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  // get discord_webhook_url for #alerts channel from databse
  const res = await db('config')
    .where({ key: 'alerts_discord_webhook_url' })
    .first()
  const discord_webhook_url = res.value

  let alert_message = ''

  if (job_type) {
    alert_message = `**[${job_details[job_type]}]** `
  }

  alert_message += `${message}`

  if (error) {
    alert_message += `\n\n**Error:** ${error.message}`
    if (error.stack) {
      alert_message += `\n\n**Stack trace:**\n\`\`\`\n${error.stack}\n\`\`\``
    }
  }

  await send_discord_message({ message: alert_message, discord_webhook_url })
}
