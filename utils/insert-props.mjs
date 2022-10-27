import db from '#db'
import config from '#config'
import { constants } from '#common'

import sendDiscordMessage from './send-discord-message.mjs'

const handle_over_under_prop = async (prop) => {
  const { pid, week, year, type, sourceid, ln, o, u, o_am, u_am } = prop

  // get last prop
  const results = await db('props')
    .where({
      pid,
      year,
      week,
      type,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = results[0]

  // if there is no last prop or if line/odds have changed, insert prop
  if (
    !last_prop ||
    last_prop.ln !== ln ||
    last_prop.o !== o ||
    last_prop.u !== u
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
      message += ` opened at ${ln} (Over: ${o_am} / Under: ${u_am})`
    } else {
      const line_changed = last_prop.ln !== ln

      // TODO - temp fix to ignore odd movements
      if (!line_changed) {
        return
      }

      const under_odds_changed = last_prop.u !== u
      const over_odds_changed = last_prop.o !== o

      const changes = []

      if (line_changed) {
        changes.push(`line changed from ${last_prop.ln} to ${ln}`)
      }

      if (under_odds_changed) {
        changes.push(`under odds changed from ${last_prop.u_am} to ${u_am}`)
      }

      if (over_odds_changed) {
        changes.push(`over odds changed from ${last_prop.o_am} to ${o_am}`)
      }

      if (changes.length > 1) {
        message += ` ${changes
          .slice(0, changes.length - 1)
          .join(', ')}, and ${changes.slice(-1)}`
      } else {
        message += ` ${changes[0]}`
      }
    }

    message += ` on ${constants.sourcesTitle[sourceid]} market`

    await sendDiscordMessage({
      webhookUrl: config.discord_props_channel_webhook_url,
      message
    })
  }
}

const handle_alt_line_prop = async (prop) => {
  const { pid, week, year, type, sourceid, ln, o, o_am } = prop

  // get last prop
  const results = await db('props')
    .where({
      pid,
      year,
      week,
      type,
      ln,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = results[0]

  // if there is no last prop or if line/odds have changed, insert prop
  if (!last_prop || last_prop.o !== o) {
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
      message += ` opened at ${ln} (${o_am})`
    } else {
      message += ` odds changed from ${last_prop.o_am} to ${o_am}`
    }

    message += ` on ${constants.sourcesTitle[sourceid]} market`

    await sendDiscordMessage({
      webhookUrl: config.discord_props_channel_webhook_url,
      message
    })
  }
}

const handle_leader_prop = async (prop) => {
  const { pid, week, year, type, sourceid, o, o_am } = prop

  // get last prop
  const results = await db('props')
    .where({
      pid,
      year,
      week,
      type,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = results[0]

  // if there is no last prop or if line/odds have changed, insert prop
  if (!last_prop || last_prop.o !== o) {
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
      message += ` opened at ${o_am}`
    } else {
      message += ` odds changed from ${last_prop.o_am} to ${o_am}`
    }

    message += ` on ${constants.sourcesTitle[sourceid]} market`

    await sendDiscordMessage({
      webhookUrl: config.discord_props_channel_webhook_url,
      message
    })
  }
}

async function insertProp(prop) {
  const is_alt_line_prop = constants.player_prop_types_alts.includes(prop.type)
  const is_leader_prop = constants.player_prop_types_leaders.includes(prop.type)
  if (is_alt_line_prop) {
    await handle_alt_line_prop(prop)
  } else if (is_leader_prop) {
    await handle_leader_prop(prop)
  } else {
    await handle_over_under_prop(prop)
  }
}

export default async function (props) {
  for (const prop of props) {
    await insertProp(prop)
  }
}
