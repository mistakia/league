import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, pfr, updatePlayer, find_player_row } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-player-draft-position-pfr')
debug.enable(
  'import-player-draft-position-pfr,update-player,get-player,pro-football-reference'
)

const import_player_draft_position_pfr = async ({
  year = constants.season.year,
  ignore_cache = false,
  dry = false
} = {}) => {
  const draft_players = await pfr.get_draft({ year, ignore_cache })

  log(`Importing ${draft_players.length} draft players for ${year}`)

  // In dry run mode, output the first draft player and exit
  if (dry && draft_players.length > 0) {
    const first_player = draft_players[0]
    log('Dry run mode - Sample player data:')
    log(JSON.stringify(first_player, null, 2))
    return {
      draft_players_count: draft_players.length,
      sample_player: first_player
    }
  }

  const pfr_ids = draft_players.map((player) => player.pfr_id)
  const players = await db('player').whereIn('pfr_id', pfr_ids)

  const players_map = {}
  for (const player_row of players) {
    players_map[player_row.pfr_id] = player_row
  }
  const missing_players = []

  for (const draft_player of draft_players) {
    let player_row = players_map[draft_player.pfr_id]

    if (!player_row) {
      try {
        const params = {
          name: draft_player.player_name,
          team: draft_player.team,
          start: year
        }
        player_row = await find_player_row(params)
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      missing_players.push(draft_player)
      continue
    }

    // Create update object with PFR draft data fields
    // Note: College team data is available from PFR but not included for now
    // TODO: Consider including college team data in a future update
    const update = {
      round: draft_player.round,
      dpos: draft_player.overall_pick,
      pfr_id: draft_player.pfr_id,
      pfr_all_pro_first_team: draft_player.all_pro_first_team_selections,
      pfr_pro_bowls: draft_player.pro_bowl_selections,
      pfr_years_as_primary_starter: draft_player.years_as_primary_starter,
      pfr_weighted_career_approximate_value:
        draft_player.pfr_weighted_career_approximate_value,
      pfr_draft_team_approximate_value:
        draft_player.pfr_weighted_career_approximate_value_drafted_team
    }

    // No need to check for changes as that's handled by update-player.mjs
    await updatePlayer({
      player_row,
      update
    })
  }

  log(`missing players: ${missing_players.length}`)
  return { missing_players_count: missing_players.length }
}

const main = async () => {
  let error
  try {
    await import_player_draft_position_pfr({
      year: argv.year,
      ignore_cache: argv.ignore_cache,
      dry: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_player_draft_position_pfr
