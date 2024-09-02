import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import db from '#db'
import {
  isMain,
  report_job,
  draftkings,
  getPlayer,
  updatePlayer
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { constants, fixTeam } from '#libs-shared'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-draftkings-salaries')
debug.enable('import-draftkings-salaries,draft-kings,update-player')

const import_draftkings_salaries = async ({ dry_run = false } = {}) => {
  const draft_groups = await draftkings.get_draftkings_nfl_draft_groups()

  log(`importing ${draft_groups.length} draft groups`)

  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  const salary_inserts = []

  for (const draft_group of draft_groups) {
    const matched_draftkings_ids = new Set()
    const unmatched_draftables = []

    const data = await draftkings.get_draftkings_draft_group_draftables({
      draft_group_id: draft_group.DraftGroupId
    })

    for (const draftable of data.draftables) {
      let player_row

      try {
        player_row = await getPlayer({
          draftkings_id: draftable.playerDkId
        })
      } catch (err) {
        log(err)
      }

      if (player_row) {
        if (matched_draftkings_ids.has(draftable.playerDkId)) {
          log(`Duplicate DraftKings ID: ${draftable.playerDkId}`)
          continue
        }

        matched_draftkings_ids.add(draftable.playerDkId)
        await process_matched_player({
          player_row,
          draftable,
          draft_group,
          nfl_games,
          salary_inserts
        })
      } else {
        unmatched_draftables.push({ draftable, draft_group })
      }
    }

    // Handle unmatched draftables
    for (const { draftable, draft_group } of unmatched_draftables) {
      let player_row

      try {
        player_row = await getPlayer({
          name: `${draftable.firstName} ${draftable.lastName}`,
          pos: draftable.position,
          team: draftable.teamAbbreviation
        })
      } catch (err) {
        log(err)
      }

      if (player_row) {
        if (matched_draftkings_ids.has(draftable.playerDkId)) {
          log(`Duplicate DraftKings ID: ${draftable.playerDkId}`)
          continue
        }

        matched_draftkings_ids.add(draftable.playerDkId)
        await process_matched_player({
          player_row,
          draftable,
          draft_group,
          nfl_games,
          salary_inserts
        })
      } else {
        log(
          `no player found for ${draftable.firstName} ${draftable.lastName} - ${draftable.playerDkId}`
        )
      }
    }
  }

  if (dry_run) {
    log(salary_inserts[0])
    return
  }

  // Insert the salary data into the database
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
  draftable,
  draft_group,
  nfl_games,
  salary_inserts
}) => {
  if (!player_row.draftkings_id) {
    await updatePlayer({
      player_row,
      update: {
        draftkings_id: draftable.playerDkId
      }
    })
  }

  // match the nfl_game
  const [away_team, home_team] = draftable.competition.name.split(' @ ')
  const game = nfl_games.find((game) => {
    const start_time = draftable?.competition?.startTime
    if (!start_time) {
      log(`no start time found for ${draftable.competition.name}`)
      return false
    }
    const game_date = dayjs(start_time).format('YYYY/MM/DD')
    return (
      game.v === fixTeam(away_team) &&
      game.h === fixTeam(home_team) &&
      game.date === game_date
    )
  })

  if (!game) {
    throw new Error(`no game found for ${draftable.competition.name}`)
  }

  const insert = {
    pid: player_row.pid,
    esbid: game?.esbid,
    source_competition_name: draftable?.competition?.name,
    source_player_display_name: `${draftable.firstName} ${draftable.lastName}`,
    source_contest_id: draft_group.DraftGroupId,
    salary: draftable.salary,
    source_id: 'DRAFTKINGS'
  }

  salary_inserts.push(insert)
}

const main = async () => {
  let error
  try {
    await import_draftkings_salaries({ dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_DRAFTKINGS_DFS_SALARIES,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_draftkings_salaries
