import db from '#db'
import config from '#config'
import { constants } from '#common'

import sendDiscordMessage from './send-discord-message.mjs'

async function insertProp(prop) {
  const { pid, wk, year, type, sourceid, ln, o, u } = prop

  // get last prop
  const results = await db('props')
    .where({
      pid,
      year,
      wk,
      type,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = results[0]

  // if there is no last prop or if line/odds have changed, insert prop
  if (
    !last_prop ||
    (last_prop.ln === ln && last_prop.o === o && last_prop.u === u)
  ) {
    await db('props').insert(prop)

    if (
      !config.discord_props_channel_webhook_url ||
      process.env.NODE_ENV !== 'production'
    ) {
      return
    }

    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]

    if (!player_row) {
      // TODO: log issue
      return
    }

    let message = `${player_row.fname} ${player_row.lname} (${player_row.cteam}) ${constants.player_prop_type_desc[type]}`

    if (!last_prop) {
      message += ` opened at ${ln} (Over: ${o} / Under: ${u})`
    } else {
      const line_changed = last_prop.ln !== ln
      const under_odds_changed = last_prop.u !== u
      const over_odds_changed = last_prop.o !== o

      const changes = []

      if (line_changed) {
        changes.push(`line changed from ${last_prop.ln} to ${ln}`)
      }

      if (under_odds_changed) {
        changes.push(`under changed from ${last_prop.u} to ${u}`)
      }

      if (over_odds_changed) {
        changes.push(`over changed from ${last_prop.o} to ${o}`)
      }

      if (changes.length > 1) {
        message += ` ${changes
          .slice(0, changes.length - 1)
          .join(', ')}, and ${changes.slice(-1)}`
      } else {
        message += ` ${changes[0]}`
      }
    }

    message += ` (${constants.sourcesTitle[sourceid]})`

    await sendDiscordMessage({
      webhookUrl: config.discord_props_channel_webhook_url,
      message
    })
  }
}
export default async function (props) {
  for (const prop of props) {
    await insertProp(prop)
  }
}
