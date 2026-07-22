import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import db from '#db'
import { is_main, report_job, draftkings, updatePlayer } from '#libs-server'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-draftkings-salaries')
debug.enable('import-draftkings-salaries,draft-kings,update-player')

const import_draftkings_salaries = async ({ dry_run = false, year } = {}) => {
  await preload_active_players({
    all_players: false,
    include_otc_id_index: false,
    include_name_draft_index: false
  })

  const draft_groups = await draftkings.get_draftkings_nfl_draft_groups()

  log(`importing ${draft_groups.length} draft groups`)

  const nfl_games = await db('nfl_games').where({
    year
  })

  const salary_inserts = []
  const unmatched_games = []

  for (const draft_group of draft_groups) {
    const matched_draftkings_ids = new Set()
    const unmatched_draftables = []

    const data = await draftkings.get_draftkings_draft_group_draftables({
      draft_group_id: draft_group.DraftGroupId
    })

    for (const draftable of data.draftables) {
      let player_row

      try {
        player_row = find_player({
          draftkings_player_id: draftable.playerDkId,
          ignore_free_agent: false,
          ignore_retired: false
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
          salary_inserts,
          unmatched_games
        })
      } else {
        unmatched_draftables.push({ draftable, draft_group })
      }
    }

    // Handle unmatched draftables
    for (const { draftable, draft_group } of unmatched_draftables) {
      let player_row

      try {
        player_row = find_player({
          name: `${draftable.firstName} ${draftable.lastName}`,
          teams: draftable.teamAbbreviation ? [draftable.teamAbbreviation] : [],
          ignore_free_agent: false,
          ignore_retired: false
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
          salary_inserts,
          unmatched_games
        })
      } else {
        log(
          `no player found for ${draftable.firstName} ${draftable.lastName} - ${draftable.playerDkId}`
        )
      }
    }
  }

  if (unmatched_games.length) {
    log(
      `${unmatched_games.length} unmatched games skipped: ${unmatched_games.join(', ')}`
    )
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
  salary_inserts,
  unmatched_games
}) => {
  if (!player_row.draftkings_player_id) {
    await updatePlayer({
      player_row,
      update: {
        draftkings_player_id: draftable.playerDkId
      },
      source: 'draftkings'
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
    log(`no game found for ${draftable.competition.name} — skipping`)
    unmatched_games.push(draftable.competition.name)
    return
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
    const argv = initialize_cli()
    const dry_run = argv.dry

    await handle_season_args_for_script({
      argv,
      script_name: 'import-draftkings-salaries',
      script_function: import_draftkings_salaries,
      year_query: async () => [{ year: current_season.year }],
      script_args: { dry_run },
      season_only: true
    })
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

if (is_main(import.meta.url)) {
  main()
}

export default import_draftkings_salaries
