import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dayjs from 'dayjs'

import db from '#db'
import {
  is_main,
  report_job,
  fanduel,
  find_player_row,
  updatePlayer,
  wait,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-fanduel-salaries')
enable_debug_namespaces(
  'import-fanduel-salaries,get-player,fanduel,update-player'
)

const import_fanduel_salaries = async ({
  dry_run = false,
  ignore_cache = false,
  season_year
} = {}) => {
  // get slates
  const fanduel_slate_data = await fanduel.get_dfs_fixtures({ ignore_cache })

  // An empty upstream is handled GRACEFULLY and never thrown on -- no date can
  // be put on when FanDuel opens a board, so an absent slate is not a failure.
  // What must not happen is a run that writes nothing being indistinguishable
  // from a run that worked: on 2026-09-01 four runs took this path, logged one
  // line, exited 0 and recorded is_successful true while player_salaries held
  // zero FANDUEL rows for the whole 2026 season.
  //
  // So the two empty shapes are reported SEPARATELY, because they point at
  // different owners. No fixture lists at all is FanDuel serving us nothing,
  // which is usually a session or credential breakage on our side. Fixture
  // lists that carry no NFL slate is FanDuel serving another sport's board,
  // which is a genuinely quiet week. Both return a distinguishable skip that
  // main() reports, in the shape import-fftoday-projections.mjs established.
  if (
    !fanduel_slate_data ||
    !fanduel_slate_data.fixture_lists ||
    !fanduel_slate_data.fixture_lists.length
  ) {
    console.log(
      'fanduel returned no fixture lists at all; nothing to import, skipping. This is upstream serving us nothing rather than a quiet board — check the session and credentials before treating it as expected.'
    )
    return { skipped: true, no_fixture_lists: true }
  }

  const game_description_names = ['NFL Main', 'NFL Single Game']
  const filtered_fanduel_slates = fanduel_slate_data.fixture_lists.filter(
    (fixture) =>
      fixture.sport === 'NFL' &&
      game_description_names.includes(fixture.game_description_name)
  )

  if (!filtered_fanduel_slates.length) {
    console.log(
      `fanduel published ${fanduel_slate_data.fixture_lists.length} fixture list(s), none of them an NFL slate of interest; nothing to import, skipping`
    )
    return { skipped: true, no_nfl_slates: true }
  }

  log(`Found ${filtered_fanduel_slates.length} fanduel slates of interest`)

  const nfl_games = await db('nfl_games').where({
    season_year
  })

  await wait(10000)

  const salary_inserts = []
  const unmatched_games = []

  // iterate through slates
  for (const fanduel_slate of filtered_fanduel_slates) {
    const matched_fanduel_ids = new Set()
    const unmatched_players = []

    const data = await fanduel.get_dfs_fixture_players({
      fixture_id: fanduel_slate.id,
      ignore_cache
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
        player_row = await find_player_row({
          fanduel_player_id: fanduel_player.id
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
          teams_index,
          unmatched_games
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
        player_row = await find_player_row({
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
          teams_index,
          unmatched_games
        })
      } else {
        log(
          `No player found for ${fanduel_player.first_name} ${fanduel_player.last_name} - ${fanduel_player.id}`
        )
      }
    }

    await wait(20000)
  }

  if (unmatched_games.length) {
    log(
      `${unmatched_games.length} unmatched games skipped: ${unmatched_games.join(', ')}`
    )
  }

  if (dry_run) {
    log(salary_inserts[0])
    return { skipped: true, dry_run: true }
  }

  // Slates were found and processed, and they produced nothing. Unlike an empty
  // upstream this is NOT graceful: FanDuel published a board and we resolved
  // none of it, which means player matching or game matching has broken. It
  // throws so report_job records the failure and the exit code carries it.
  if (!salary_inserts.length) {
    throw_if_shortfall(
      `fanduel salaries: processed ${filtered_fanduel_slates.length} NFL slate(s) and produced 0 salary rows. Upstream published a board; player or game matching has broken.`
    )
  }

  await db('player_salaries')
    .insert(salary_inserts)
    .onConflict(['pid', 'esbid', 'source_contest_id'])
    .merge()
  console.log(`Inserted ${salary_inserts.length} salary records`)

  return { skipped: false, rows_inserted: salary_inserts.length }
}

const process_matched_player = async ({
  player_row,
  fanduel_player,
  fanduel_slate,
  fanduel_game,
  nfl_games,
  salary_inserts,
  teams_index,
  unmatched_games
}) => {
  if (!player_row.fanduel_player_id) {
    await updatePlayer({
      player_row,
      update: {
        fanduel_player_id: fanduel_player.id
      },
      source: 'fanduel'
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
      game.away_nfl_team === fixTeam(away_team_abbreviation) &&
      game.home_nfl_team === fixTeam(home_team_abbreviation) &&
      game.date === game_date
    )
  })

  if (!game) {
    log(
      `No game found for ${away_team_name} @ ${home_team_name} on ${fanduel_game.start_date} — skipping`
    )
    unmatched_games.push(`${away_team_name} @ ${home_team_name}`)
    return
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
  let job_reason = null
  try {
    const argv = initialize_cli()
    const dry_run = argv.dry
    const ignore_cache = argv.ignore_cache

    const results = await handle_season_args_for_script({
      argv,
      script_name: 'import-fanduel-salaries',
      script_function: import_fanduel_salaries,
      year_query: async () => [{ season_year: current_season.year }],
      script_args: { dry_run, ignore_cache },
      season_only: true
    })

    // A skip stays SUCCESSFUL — an upstream that has published nothing is not a
    // failure and pages nobody — but it carries its reason onto the ledger row,
    // so a run that wrote nothing is no longer identical to a run that worked.
    // Volume is judged separately and from outside the run by the
    // `dfs-salary-source-week-coverage` data check, because a run that returns
    // early can never reach an oracle of its own.
    const skipped = results.filter((result) => result && result.skipped)
    if (skipped.length && skipped.length === results.length) {
      job_reason = `imported nothing: ${skipped
        .map((result) =>
          result.no_fixture_lists
            ? 'fanduel returned no fixture lists at all'
            : result.no_nfl_slates
              ? 'fanduel published no NFL slate of interest'
              : 'dry run'
        )
        .join('; ')}`
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_FANDUEL_DFS_SALARIES,
    job_reason,
    error
  })

  // Carry the outcome in the exit code, not only in the `jobs` table — see the
  // matching note in import-draftkings-salaries.mjs. FanDuel's stakes are higher
  // than DraftKings': a missed FanDuel week is UNRECOVERABLE, because FanDuel
  // expires its fixture lists and no historical source carries its salaries past
  // 2021. Every week this job fails silently is gone for good.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_fanduel_salaries
