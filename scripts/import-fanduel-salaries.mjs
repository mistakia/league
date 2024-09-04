import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import db from '#db'
import {
  is_main,
  report_job,
  fanduel,
  getPlayer,
  updatePlayer,
  wait
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { constants, fixTeam } from '#libs-shared'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel-salaries')
debug.enable('import-fanduel-salaries,get-player,fanduel,update-player')

const import_fanduel_salaries = async ({ dry_run = false } = {}) => {
  // get slates
  const fanduel_slate_data = await fanduel.get_dfs_fixtures()

  const game_description_names = ['NFL Main', 'NFL Single Game']
  const filtered_fanduel_slates = fanduel_slate_data.fixture_lists.filter(
    (fixture) =>
      fixture.sport === 'NFL' &&
      game_description_names.includes(fixture.game_description_name)
  )

  log(`Found ${filtered_fanduel_slates.length} fanduel slates of interest`)

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  await wait(10000)

  const salary_inserts = []

  // iterate through slates
  for (const fanduel_slate of filtered_fanduel_slates) {
    const matched_fanduel_ids = new Set()
    const unmatched_players = []

    const data = await fanduel.get_dfs_fixture_players({
      fixture_id: fanduel_slate.id
    })

    log(
      `Found ${data.players.length} players for fanduel slate ${fanduel_slate.id}`
    )

    const teams_index = {}
    for (const team of data.teams) {
      teams_index[team.id] = team
    }

    const games_index = {}
    for (const game of data.fixtures) {
      games_index[game.id] = game
    }

    for (const fanduel_player of data.players) {
      let player_row

      try {
        player_row = await getPlayer({
          fanduel_id: fanduel_player.id
        })
      } catch (err) {
        log(err)
      }

      if (player_row) {
        if (matched_fanduel_ids.has(fanduel_player.id)) {
          log(`Duplicate Fanduel ID: ${fanduel_player.id}`)
          continue
        }

        const fandule_game_id = fanduel_player.fixture?._members?.[0]
        const fanduel_game = games_index[fandule_game_id]

        matched_fanduel_ids.add(fanduel_player.id)
        await process_matched_player({
          player_row,
          fanduel_player,
          fanduel_slate,
          fanduel_game,
          nfl_games,
          salary_inserts,
          teams_index
        })
      } else {
        unmatched_players.push({ fanduel_player, fanduel_slate })
      }
    }
    // handle unmatched players

    for (const { fanduel_player, fanduel_slate } of unmatched_players) {
      let player_row

      try {
        const team_id = fanduel_player.team?._members?.[0]
        player_row = await getPlayer({
          name: `${fanduel_player.first_name} ${fanduel_player.last_name}`,
          pos: fanduel_player.position,
          team: teams_index[team_id]?.code
        })
      } catch (err) {
        log(err)
      }

      if (player_row) {
        if (matched_fanduel_ids.has(fanduel_player.id)) {
          log(`Duplicate Fanduel ID: ${fanduel_player.id}`)
          continue
        }

        matched_fanduel_ids.add(fanduel_player.id)
        const fandule_game_id = fanduel_player.fixture?._members?.[0]
        const fanduel_game = games_index[fandule_game_id]

        await process_matched_player({
          player_row,
          fanduel_player,
          fanduel_slate,
          fanduel_game,
          nfl_games,
          salary_inserts,
          teams_index
        })
      } else {
        log(
          `No player found for ${fanduel_player.first_name} ${fanduel_player.last_name} - ${fanduel_player.id}`
        )
      }
    }

    await wait(20000)
  }

  if (dry_run) {
    log(salary_inserts[0])
    return
  }

  if (salary_inserts.length > 0) {
    await db('player_salaries')
      .insert(salary_inserts)
      .onConflict(['pid', 'esbid', 'source_contest_id'])
      .merge()
    log(`Inserted ${salary_inserts.length} salary records`)
  } else {
    log('No salary records to insert')
  }
}

const process_matched_player = async ({
  player_row,
  fanduel_player,
  fanduel_slate,
  fanduel_game,
  nfl_games,
  salary_inserts,
  teams_index
}) => {
  if (!player_row.fanduel_id) {
    await updatePlayer({
      player_row,
      update: {
        fanduel_id: fanduel_player.id
      }
    })
  }

  // match the nfl_game
  const away_team_id = fanduel_game.away_team?.team?._members?.[0]
  const away_team_abbreviation = teams_index[away_team_id]?.code
  const away_team_name = teams_index[away_team_id]?.full_name
  const home_team_id = fanduel_game.home_team?.team?._members?.[0]
  const home_team_abbreviation = teams_index[home_team_id]?.code
  const home_team_name = teams_index[home_team_id]?.full_name
  const game = nfl_games.find((game) => {
    const game_date = dayjs(fanduel_game.start_date).format('YYYY/MM/DD')
    return (
      game.v === fixTeam(away_team_abbreviation) &&
      game.h === fixTeam(home_team_abbreviation) &&
      game.date === game_date
    )
  })

  if (!game) {
    throw new Error(
      `No game found for ${away_team_name} @ ${home_team_name} on ${fanduel_game.start_date}`
    )
  }

  const insert = {
    pid: player_row.pid,
    esbid: game?.esbid,
    source_competition_name: `${away_team_name} @ ${home_team_name} — ${fanduel_game.start_date}`,
    source_player_display_name: `${fanduel_player.first_name} ${fanduel_player.last_name}`,
    source_contest_id: fanduel_slate.id,
    salary: fanduel_player.salary,
    source_id: 'FANDUEL'
  }

  salary_inserts.push(insert)
}

const main = async () => {
  let error
  try {
    await import_fanduel_salaries({ dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_FANDUEL_DFS_SALARIES,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_fanduel_salaries
