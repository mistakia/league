import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain, updatePlayer } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-player-id')
debug.enable('update-player-id,update-player')

const updatePlayerId = async ({ pid, update_pid }) => {
  const player_rows = await db('player').where({ pid })
  const player_row = player_rows[0]

  if (!player_row) {
    log(`pid ${pid} not found`)
    return
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore draft set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`draft rows updated: ${rows.info}`)
  } else {
    const draft = await db('draft').where({ pid })
    log(`draft rows: ${draft.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore gamelogs set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`gamelogs rows updated: ${rows.info}`)
  } else {
    const gamelogs = await db('gamelogs').where({ pid })
    log(`gamelogs rows: ${gamelogs.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore keeptradecut_rankings set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`keeptradecut_rankings rows updated: ${rows.info}`)
  } else {
    const ktc_rankings = await db('keeptradecut_rankings').where({ pid })
    log(`keeptradecut_rankings rows: ${ktc_rankings.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_baselines set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_baselines rows updated: ${rows.info}`)
  } else {
    const league_baselines = await db('league_baselines').where({ pid })
    log(`league_baselines rows: ${league_baselines.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_cutlist set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_cutlist rows updated: ${rows.info}`)
  } else {
    const league_cutlist = await db('league_cutlist').where({ pid })
    log(`league_cutlist rows: ${league_cutlist.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_player_projection_points set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_player_projection_points rows updated: ${rows.info}`)
  } else {
    const league_player_projection_points = await db(
      'league_player_projection_points'
    ).where({ pid })
    log(
      `league_player_projection_points rows: ${league_player_projection_points.length}`
    )
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_player_projection_values set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_player_projection_values rows updated: ${rows.info}`)
  } else {
    const league_player_projection_values = await db(
      'league_player_projection_values'
    ).where({ pid })
    log(
      `league_player_projection_values rows: ${league_player_projection_values.length}`
    )
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_team_lineup_contributions set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_team_lineup_contributions rows updated: ${rows.info}`)
  } else {
    const league_team_lineup_contributions = await db(
      'league_team_lineup_contributions'
    ).where({ pid })
    log(
      `league_team_lineup_contributions rows: ${league_team_lineup_contributions.length}`
    )
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_team_lineup_contribution_weeks set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_team_lineup_contribution_weeks rows updated: ${rows.info}`)
  } else {
    const league_team_lineup_contribution_weeks = await db(
      'league_team_lineup_contribution_weeks'
    ).where({ pid })
    log(
      `league_team_lineup_contribution_weeks rows: ${league_team_lineup_contribution_weeks.length}`
    )
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore league_team_lineup_starters set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`league_team_lineup_starters rows updated: ${rows.info}`)
  } else {
    const league_team_lineup_starters = await db(
      'league_team_lineup_starters'
    ).where({ pid })
    log(
      `league_team_lineup_starters rows: ${league_team_lineup_starters.length}`
    )
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore offense set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`offense rows updated: ${rows.info}`)
  } else {
    const offense = await db('offense').where({ pid })
    log(`offense rows: ${offense.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore player_changelog set id = '${update_pid}' where id = '${pid}'`
    )
    log(`player_changelog rows updated: ${rows.info}`)
  } else {
    const player_changelog = await db('player_changelog').where('id', pid)
    log(`player_changelog rows: ${player_changelog.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore players_status set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`players_status rows updated: ${rows.info}`)
  } else {
    const players_status = await db('players_status').where({ pid })
    log(`players_status rows: ${players_status.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore poach_releases set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`poach_releases rows updated: ${rows.info}`)
  } else {
    const poach_releases = await db('poach_releases').where({ pid })
    log(`poach_releases rows: ${poach_releases.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore poaches set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`poaches rows updated: ${rows.info}`)
  } else {
    const poaches = await db('poaches').where({ pid })
    log(`poaches rows: ${poaches.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore practice set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`practice rows updated: ${rows.info}`)
  } else {
    const practice = await db('practice').where({ pid })
    log(`practice rows: ${practice.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore projections set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`projections rows updated: ${rows.info}`)
  } else {
    const projections = await db('projections').where({ pid })
    log(`projections rows: ${projections.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore projections_archive set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`projections_archive rows updated: ${rows.info}`)
  } else {
    const projections_archive = await db('projections_archive').where({ pid })
    log(`projections_archive rows: ${projections_archive.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore props set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`props rows updated: ${rows.info}`)
  } else {
    const props = await db('props').where({ pid })
    log(`props rows: ${props.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore rankings set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`rankings rows updated: ${rows.info}`)
  } else {
    const rankings = await db('rankings').where({ pid })
    log(`rankings rows: ${rankings.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore ros_projections set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`ros_projections rows updated: ${rows.info}`)
  } else {
    const ros_projections = await db('ros_projections').where({ pid })
    log(`ros_projections rows: ${ros_projections.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore rosters_players set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`rosters_players rows updated: ${rows.info}`)
  } else {
    const rosters_players = await db('rosters_players').where({ pid })
    log(`rosters_players rows: ${rosters_players.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore trade_releases set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`trade_releases rows updated: ${rows.info}`)
  } else {
    const trade_releases = await db('trade_releases').where({ pid })
    log(`trade_releases rows: ${trade_releases.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore trades_players set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`trades_players rows updated: ${rows.info}`)
  } else {
    const trades_players = await db('trades_players').where({ pid })
    log(`trades_players rows: ${trades_players.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore transactions set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`transactions rows updated: ${rows.info}`)
  } else {
    const transactions = await db('transactions').where({ pid })
    log(`transactions rows: ${transactions.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore transition_bids set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`transition_bids rows updated: ${rows.info}`)
  } else {
    const transition_bids = await db('transition_bids').where({ pid })
    log(`transition_bids rows: ${transition_bids.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore transition_releases set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`transition_releases rows updated: ${rows.info}`)
  } else {
    const transition_releases = await db('transition_releases').where({ pid })
    log(`transition_releases rows: ${transition_releases.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore waiver_releases set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`waiver_releases rows updated: ${rows.info}`)
  } else {
    const waiver_releases = await db('waiver_releases').where({ pid })
    log(`waiver_releases rows: ${waiver_releases.length}`)
  }

  if (update_pid) {
    const [rows] = await db.raw(
      `update ignore waivers set pid = '${update_pid}' where pid = '${pid}'`
    )
    log(`waivers rows updated: ${rows.info}`)
  } else {
    const waivers = await db('waivers').where({ pid })
    log(`waivers rows: ${waivers.length}`)
  }

  if (update_pid) {
    // delete player_row
    await db('player').where({ pid }).del()

    // update player_row
    await updatePlayer({ pid: update_pid, update: player_row })
  }
}

const main = async () => {
  let error
  try {
    await updatePlayerId({ pid: argv.pid, update_pid: argv.update_pid })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default updatePlayerId
