import debug from 'debug'
import fetch from 'node-fetch'
import diff from 'deep-diff'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs'
import os from 'os'
import readline from 'readline'

import db from '#db'
// import { job_types } from '#libs-shared/job-constants.mjs'

import { isMain, readCSV, updatePlayer } from '#libs-server'
import { formatPlayerName, fixTeam } from '#libs-shared'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('audit-player-ids-dynastyprocess-repo')
debug.enable('audit-player-ids-dynastyprocess-repo,update-player')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const askQuestion = (question) => {
  return new Promise((resolve) => rl.question(question, resolve))
}

const fantasy_data_id_blacklist = [17165]

const audit_player_ids_dynastyprocess_repo = async ({
  force_download = false,
  update_player_conflicts = false,
  start_year = null
} = {}) => {
  const url =
    'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv'
  const file_name = 'db_playerids.csv'
  const path = `${os.tmpdir()}/${file_name}`

  if (force_download || !fs.existsSync(path)) {
    log(`downloading ${url}`)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`)
    const csv_data = await response.text()
    fs.writeFileSync(path, csv_data)
  } else {
    log(`file exists: ${path}`)
  }

  const csv_data = await readCSV(path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  const dynastyprocess_data = []

  for (const player_data of csv_data) {
    try {
      dynastyprocess_data.push({
        // mfl_id: player_data.mfl_id, TODO add field to player table
        sportradar_id: player_data.sportradar_id,
        gsisid: player_data.gsis_id,
        // pff_id: player_data.pff_id, TODO add field to player table
        sleeper_id: player_data.sleeper_id,
        nflid: player_data.nfl_id,
        espn_id: player_data.espn_id ? Number(player_data.espn_id) : null,
        yahoo_id: player_data.yahoo_id ? Number(player_data.yahoo_id) : null,
        // fleaflicker_id: player_data.fleaflicker_id, TODO add field to player table
        // cbs_id: player_data.cbs_id,
        rotowire_id: player_data.rotowire_id
          ? Number(player_data.rotowire_id)
          : null,
        rotoworld_id: player_data.rotoworld_id
          ? Number(player_data.rotoworld_id)
          : null,
        keeptradecut_id: player_data.ktc_id ? Number(player_data.ktc_id) : null,
        pfr_id: player_data.pfr_id,
        // cfbref_id: player_data.cfbref_id,
        // stats_id: player_data.stats_id,
        // stats_global_id: player_data.stats_global_id,
        fantasy_data_id: player_data.fantasy_data_id
          ? Number(player_data.fantasy_data_id)
          : null,
        formatted: formatPlayerName(player_data.name),
        pos: player_data.position,
        current_nfl_team: fixTeam(player_data.team),
        dob: player_data.birthdate,
        round: player_data.draft_round ? Number(player_data.draft_round) : null,
        dpos: player_data.draft_ovr ? Number(player_data.draft_ovr) : null,
        // twitter_username: player_data.twitter_username, TODO add field to player table
        height: player_data.height ? Number(player_data.height) : null,
        weight: player_data.weight ? Number(player_data.weight) : null
        // col: player_data.college // TODO format/standardize college name
        // swish_id: player_data.swish_id // TODO add field to player table
      })
    } catch (err) {
      log(`error parsing row: ${player_data}`)
      throw err
    }
  }

  const player_data = await db('player').select([
    'pid',
    'sportradar_id',
    'fantasy_data_id',
    'gsisid',
    'sleeper_id',
    'nflid',
    'espn_id',
    'yahoo_id',
    'rotowire_id',
    'rotoworld_id',
    'keeptradecut_id',
    'pfr_id',
    'formatted',
    'pos',
    'current_nfl_team',
    'dob',
    'round',
    'dpos',
    'height',
    'weight',
    'start'
    // 'col' TODO
  ])

  let total_differences = 0
  let total_players_not_matched = 0
  let total_players_with_no_differences = 0
  const field_difference_count = {}

  for (const dp_player of dynastyprocess_data) {
    if (fantasy_data_id_blacklist.includes(dp_player.fantasy_data_id)) {
      continue
    }

    const matching_player = player_data.find(
      (player) =>
        // (player.sportradar_id &&
        //   player.sportradar_id === dp_player.sportradar_id) ||
        (player.fantasy_data_id &&
          player.fantasy_data_id === dp_player.fantasy_data_id) ||
        (player.gsisid && player.gsisid === dp_player.gsisid) ||
        (player.sleeper_id && player.sleeper_id === dp_player.sleeper_id) ||
        (player.nflid && player.nflid === dp_player.nflid) ||
        (player.espn_id && player.espn_id === dp_player.espn_id) ||
        (player.yahoo_id && player.yahoo_id === dp_player.yahoo_id) ||
        (player.rotowire_id && player.rotowire_id === dp_player.rotowire_id) ||
        (player.rotoworld_id &&
          player.rotoworld_id === dp_player.rotoworld_id) ||
        (player.keeptradecut_id &&
          player.keeptradecut_id === dp_player.keeptradecut_id) ||
        (player.pfr_id && player.pfr_id === dp_player.pfr_id)
    )

    if (!matching_player) {
      // TODO create new player
      log(
        `no matching player for ${dp_player.formatted}, ${dp_player.pos}, ${dp_player.current_nfl_team}`
      )
      total_players_not_matched++
      continue
    }

    if (start_year && matching_player.start !== start_year) {
      continue
    }

    const diff_result = diff(
      matching_player,
      dp_player,
      (path, key) =>
        key === 'pid' ||
        key === 'formatted' ||
        key === 'height' ||
        key === 'weight' ||
        key === 'pos' || // TODO
        key === 'nflid' ||
        key === 'current_nfl_team'
    )

    if (diff_result) {
      const filtered_diff_result = diff_result.filter(
        (change) => change.rhs !== null && change.kind !== 'D'
      )
      if (filtered_diff_result.length) {
        total_differences++
        for (const change of filtered_diff_result) {
          const field = change.path[0]
          if (!field_difference_count[field]) {
            field_difference_count[field] = 0
          }
          field_difference_count[field]++
        }
        const matched_id = Object.keys(matching_player).find(
          (key) =>
            dp_player[key] &&
            key.endsWith('id') &&
            key !== 'sportradar_id' &&
            matching_player[key] === dp_player[key]
        )
        log(
          `Differences for ${dp_player.formatted} (matched by ${matched_id}: ${dp_player[matched_id]}):`
        )
        log({
          db_player: `${matching_player.formatted} (${matching_player.pos}, ${matching_player.current_nfl_team})`,
          dp_player: `${dp_player.formatted} (${dp_player.pos}, ${dp_player.current_nfl_team})`
        })
        log(filtered_diff_result)

        const truthy_differences = filtered_diff_result.filter((change) => {
          if (change.path[0] === 'dob') {
            return (
              change.lhs !== '0000-00-00' &&
              change.rhs !== '0000-00-00' &&
              change.lhs &&
              change.rhs
            )
          }
          return change.lhs && change.rhs
        })

        if (truthy_differences.length === 0) {
          const updates = filtered_diff_result.reduce((acc, change) => {
            acc[change.path[0]] = change.rhs
            return acc
          }, {})

          await updatePlayer({
            player_row: matching_player,
            update: updates
          })
          log(`Updated player ${dp_player.formatted} with all differences`)
        } else if (update_player_conflicts) {
          for (const change of filtered_diff_result) {
            const field = change.path[0]
            const current_value = matching_player[field]
            const new_value = change.rhs
            log(
              `Field: ${field}, Current Value: ${current_value}, New Value: ${new_value}`
            )
            const answer = await askQuestion(
              `Update ${field} from ${current_value} to ${new_value}? (y/n): `
            )
            if (answer.toLowerCase() === 'y') {
              await updatePlayer({
                player_row: matching_player,
                update: { [field]: new_value }
              })
              log(`Updated field ${field} for player ${dp_player.formatted}`)
            } else {
              log(
                `Skipped updating field ${field} for player ${dp_player.formatted}`
              )
            }
          }
        }
      } else {
        total_players_with_no_differences++
      }
    } else {
      total_players_with_no_differences++
    }
  }

  log(`Total players: ${dynastyprocess_data.length}`)
  log(`Total players not matched: ${total_players_not_matched}`)
  log(`Total players with no differences: ${total_players_with_no_differences}`)
  log(`Total players with differences: ${total_differences}`)
  log('Total differences by field:')
  Object.entries(field_difference_count).forEach(([field, count]) => {
    log(`${field}: ${count}`)
  })
}

const main = async () => {
  let error
  try {
    const force_download = argv.d
    const update_player_conflicts = argv.update
    await audit_player_ids_dynastyprocess_repo({
      force_download,
      update_player_conflicts,
      start_year: argv.start_year
    })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: job_types.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default audit_player_ids_dynastyprocess_repo
