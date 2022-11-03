import db from '#db'
import config from '#config'
import { constants } from '#common'

import sendDiscordMessage from './send-discord-message.mjs'
import { wait } from './wait.mjs'
import get_discord_webhook_url_for_prop_type from './get-discord-webhook-url-for-prop-type.mjs'

const discord_config_exists =
  config.discord_props_change_channel_webhook_url &&
  config.discord_props_open_channel_webhook_url

const handle_over_under_prop = async (prop) => {
  const result = { activated: false, message: null, deactivated: false }

  const { pid, week, year, type, sourceid, ln, o, u, o_am, u_am, active } = prop

  // get last prop
  const props_query = await db('props')
    .where({
      pid,
      year,
      week,
      type,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = props_query[0]
  result.activated =
    (!last_prop && active) || (active && last_prop.active !== active)
  result.deactivated = !active && last_prop && last_prop.active

  // if there is no last prop or if line/odds have changed, insert prop
  if (
    !last_prop ||
    last_prop.ln !== ln ||
    last_prop.o !== o ||
    last_prop.u !== u ||
    last_prop.active !== active
  ) {
    await db('props').insert(prop)

    if (!discord_config_exists || process.env.NODE_ENV !== 'production') {
      return
    }

    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]

    if (!player_row) {
      // TODO: log issue
      return
    }

    result.message = `${player_row.fname} ${player_row.lname} (${player_row.cteam}) ${constants.player_prop_type_desc[type]}`

    if (!last_prop) {
      result.message += ` opened at ${ln}`
      if (o_am && u_am) {
        result.message += ` (Over: ${o_am} / Under: ${u_am})`
      }
    } else {
      const line_changed = last_prop.ln !== ln

      // TODO - temp fix to ignore odd movements
      if (!line_changed && last_prop.active === active) {
        return
      }

      const under_odds_changed = last_prop.u !== u
      const over_odds_changed = last_prop.o !== o

      const changes = []

      if (line_changed) {
        if (result.activated) {
          changes.push('reopened')
        } else if (result.deactivated) {
          changes.push('pulled')
        }

        changes.push(`line changed from ${last_prop.ln} to ${ln}`)
      } else if (result.activated) {
        changes.push(`reopened at ${ln}`)
      } else if (result.deactivated) {
        changes.push('pulled')
      }

      if (under_odds_changed) {
        changes.push(`under odds changed from ${last_prop.u_am} to ${u_am}`)
      }

      if (over_odds_changed) {
        changes.push(`over odds changed from ${last_prop.o_am} to ${o_am}`)
      }

      if (changes.length > 1) {
        result.message += ` ${changes
          .slice(0, changes.length - 1)
          .join(', ')}, and ${changes.slice(-1)}`
      } else {
        result.message += ` ${changes[0]}`
      }
    }

    result.message += ` on ${constants.sourcesTitle[sourceid]} market (${year} Week ${week})`

    return result
  }
}

const handle_alt_line_prop = async (prop) => {
  const result = { activated: false, message: null, deactivated: false }

  const { pid, week, year, type, sourceid, ln, o, o_am, active } = prop

  // get last prop
  const props_query = await db('props')
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

  const last_prop = props_query[0]
  result.activated =
    (!last_prop && active) || (active && last_prop.active !== active)
  result.deactivated = !active && last_prop && last_prop.active

  // if there is no last prop or if line/odds have changed, insert prop
  if (!last_prop || last_prop.o !== o || last_prop.active !== active) {
    await db('props').insert(prop)

    if (!discord_config_exists || process.env.NODE_ENV !== 'production') {
      return
    }

    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]

    if (!player_row) {
      // TODO: log issue
      return
    }

    result.message = `${player_row.fname} ${player_row.lname} (${player_row.cteam}) ${constants.player_prop_type_desc[type]}`

    if (result.activated) {
      result.message += ` opened at ${ln} (${o_am})`
    } else if (result.deactivated) {
      result.message += ` pulled at ${ln} (${o_am})`
    } else {
      const delta = last_prop.o_am - o_am
      const delta_pct = Math.abs(delta) / Math.abs(last_prop.o_am)

      // do not send message if change is less than 1%
      if (delta_pct < 0.02) {
        return
      }

      result.message += ` ${ln} odds changed from ${last_prop.o_am} to ${o_am}`
    }

    result.message += ` on ${constants.sourcesTitle[sourceid]} market (${year} Week ${week})`

    return result
  }
}

const handle_leader_prop = async (prop) => {
  const result = { activated: false, message: null, deactivated: false }

  const { pid, week, year, type, sourceid, o, o_am, active } = prop

  // get last prop
  const props_query = await db('props')
    .where({
      pid,
      year,
      week,
      type,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = props_query[0]
  result.activated =
    (!last_prop && active) || (active && last_prop.active !== active)
  result.deactivated = !active && last_prop && last_prop.active

  // if there is no last prop or if line/odds have changed, insert prop
  if (!last_prop || last_prop.o !== o || last_prop.active !== active) {
    await db('props').insert(prop)

    if (!discord_config_exists || process.env.NODE_ENV !== 'production') {
      return
    }

    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]

    if (!player_row) {
      // TODO: log issue
      return
    }

    result.message = `${player_row.fname} ${player_row.lname} (${player_row.cteam}) ${constants.player_prop_type_desc[type]}`

    if (result.activated) {
      result.message += ` opened at ${o_am}`
    } else if (result.deactivated) {
      result.message += ` pulled at ${o_am}`
    } else {
      const delta = last_prop.o_am - o_am
      const delta_pct = Math.abs(delta) / Math.abs(last_prop.o_am)

      // do not send message if change is less than 1%
      if (delta_pct < 0.02) {
        return
      }

      result.message += ` odds changed from ${last_prop.o_am} to ${o_am}`
    }

    result.message += ` on ${constants.sourcesTitle[sourceid]} market (${year} Week ${week})`

    return result
  }
}

async function insertProp(prop) {
  const is_alt_line_prop = constants.player_prop_types_alts.includes(prop.type)
  const is_leader_prop = constants.player_prop_types_leaders.includes(prop.type)
  let result
  if (is_alt_line_prop) {
    result = await handle_alt_line_prop(prop)
  } else if (is_leader_prop) {
    result = await handle_leader_prop(prop)
  } else {
    result = await handle_over_under_prop(prop)
  }

  if (!result || !result.message) {
    return
  }

  if (result.activated) {
    // send message to general open channel
    await sendDiscordMessage({
      webhookUrl: config.discord_props_open_channel_webhook_url,
      message: result.message
    })

    // throttle discord messages
    await wait(1000)

    if (is_alt_line_prop) {
      // alt line open channel
      await sendDiscordMessage({
        webhookUrl: config.discord_props_open_alts_channel_webhook_url,
        message: result.message
      })
    } else if (is_leader_prop) {
      const is_sunday_leaders =
        constants.player_prop_types_sunday_leaders.includes(prop.type)

      if (is_sunday_leaders) {
        // sunday leaders open channel
        await sendDiscordMessage({
          webhookUrl:
            config.discord_props_open_sunday_leaders_channel_webhook_url,
          message: result.message
        })
      } else {
        // game leader open channel
        await sendDiscordMessage({
          webhookUrl:
            config.discord_props_open_game_leaders_channel_webhook_url,
          message: result.message
        })
      }
    } else {
      // over/under open channel
      await sendDiscordMessage({
        webhookUrl: config.discord_props_open_over_under_channel_webhook_url,
        message: result.message
      })
    }

    // throttle discord messages
    await wait(1000)

    const prop_type_webhook_url = get_discord_webhook_url_for_prop_type(
      prop.type
    )
    await sendDiscordMessage({
      webhookUrl: prop_type_webhook_url,
      message: result.message
    })
  } else {
    await sendDiscordMessage({
      webhookUrl: config.discord_props_change_channel_webhook_url,
      message: result.message
    })
  }

  // throttle discord messages
  await wait(1000)
}

export default async function (props) {
  for (const prop of props) {
    await insertProp(prop)
  }
}
