import debug from 'debug'

import db from '#db'

const log = debug('update-player-id')

export default async function ({ current_pid, new_pid }) {
  const player_rows = await db('player').where({ pid: current_pid })
  const player_row = player_rows[0]

  if (!player_row) {
    log(`pid ${current_pid} not found`)
    return
  }

  const [draft_rows] = await db.raw(
    `update ignore draft set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`draft rows updated: ${draft_rows.info}`)
  await db('draft').where('pid', current_pid).del()

  const [player_gamelogs_rows] = await db.raw(
    `update ignore player_gamelogs set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`player_gamelogs rows updated: ${player_gamelogs_rows.info}`)
  await db('player_gamelogs').where('pid', current_pid).del()

  const [keeptradecut_rankings_rows] = await db.raw(
    `update ignore keeptradecut_rankings set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`keeptradecut_rankings rows updated: ${keeptradecut_rankings_rows.info}`)
  await db('keeptradecut_rankings').where('pid', current_pid).del()

  const [league_baselines_rows] = await db.raw(
    `update ignore league_baselines set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`league_baselines rows updated: ${league_baselines_rows.info}`)
  await db('league_baselines').where('pid', current_pid).del()

  const [league_cutlist_rows] = await db.raw(
    `update ignore league_cutlist set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`league_cutlist rows updated: ${league_cutlist_rows.info}`)
  await db('league_cutlist').where('pid', current_pid).del()

  const [league_player_projection_points_rows] = await db.raw(
    `update ignore league_player_projection_points set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_player_projection_points rows updated: ${league_player_projection_points_rows.info}`
  )
  await db('league_player_projection_points').where('pid', current_pid).del()

  const [league_player_projection_values_rows] = await db.raw(
    `update ignore league_player_projection_values set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_player_projection_values rows updated: ${league_player_projection_values_rows.info}`
  )
  await db('league_player_projection_values').where('pid', current_pid).del()

  const [league_team_lineup_contributions_rows] = await db.raw(
    `update ignore league_team_lineup_contributions set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_team_lineup_contributions rows updated: ${league_team_lineup_contributions_rows.info}`
  )
  await db('league_team_lineup_contributions').where('pid', current_pid).del()

  const [league_team_lineup_contribution_weeks_rows] = await db.raw(
    `update ignore league_team_lineup_contribution_weeks set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_team_lineup_contribution_weeks rows updated: ${league_team_lineup_contribution_weeks_rows.info}`
  )
  await db('league_team_lineup_contribution_weeks')
    .where('pid', current_pid)
    .del()

  const [league_team_lineup_starters_rows] = await db.raw(
    `update ignore league_team_lineup_starters set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_team_lineup_starters rows updated: ${league_team_lineup_starters_rows.info}`
  )
  await db('league_team_lineup_starters').where('pid', current_pid).del()

  const [player_changelog_rows] = await db.raw(
    `update ignore player_changelog set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`player_changelog rows updated: ${player_changelog_rows.info}`)
  await db('player_changelog').where('pid', current_pid).del()

  const [players_status_rows] = await db.raw(
    `update ignore players_status set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`players_status rows updated: ${players_status_rows.info}`)
  await db('players_status').where('pid', current_pid).del()

  const [poach_releases_rows] = await db.raw(
    `update ignore poach_releases set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`poach_releases rows updated: ${poach_releases_rows.info}`)
  await db('poach_releases').where('pid', current_pid).del()

  const [poaches_rows] = await db.raw(
    `update ignore poaches set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`poaches rows updated: ${poaches_rows.info}`)
  await db('poaches').where('pid', current_pid).del()

  const [practice_rows] = await db.raw(
    `update ignore practice set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`practice rows updated: ${practice_rows.info}`)
  await db('practice').where('pid', current_pid).del()

  const [projections_rows] = await db.raw(
    `update ignore projections set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`projections rows updated: ${projections_rows.info}`)
  await db('projections').where('pid', current_pid).del()

  const [projections_archive_rows] = await db.raw(
    `update ignore projections_archive set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`projections_archive rows updated: ${projections_archive_rows.info}`)
  await db('projections_archive').where('pid', current_pid).del()

  const [props_rows] = await db.raw(
    `update ignore props set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`props rows updated: ${props_rows.info}`)
  await db('props').where('pid', current_pid).del()

  const [props_index_rows] = await db.raw(
    `update ignore props_index set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`props_index rows updated: ${props_index_rows.info}`)
  await db('props_index').where('pid', current_pid).del()

  const [rankings_rows] = await db.raw(
    `update ignore rankings set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`rankings rows updated: ${rankings_rows.info}`)
  await db('rankings').where('pid', current_pid).del()

  const [ros_projections_rows] = await db.raw(
    `update ignore ros_projections set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`ros_projections rows updated: ${ros_projections_rows.info}`)
  await db('ros_projections').where('pid', current_pid).del()

  const [rosters_players_rows] = await db.raw(
    `update ignore rosters_players set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`rosters_players rows updated: ${rosters_players_rows.info}`)
  await db('rosters_players').where('pid', current_pid).del()

  const [trade_releases_rows] = await db.raw(
    `update ignore trade_releases set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`trade_releases rows updated: ${trade_releases_rows.info}`)
  await db('trade_releases').where('pid', current_pid).del()

  const [trades_players_rows] = await db.raw(
    `update ignore trades_players set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`trades_players rows updated: ${trades_players_rows.info}`)
  await db('trades_players').where('pid', current_pid).del()

  const [transactions_rows] = await db.raw(
    `update ignore transactions set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`transactions rows updated: ${transactions_rows.info}`)
  await db('transactions').where('pid', current_pid).del()

  const [transition_bids_rows] = await db.raw(
    `update ignore transition_bids set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`transition_bids rows updated: ${transition_bids_rows.info}`)
  await db('transition_bids').where('pid', current_pid).del()

  const [transition_releases_rows] = await db.raw(
    `update ignore transition_releases set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`transition_releases rows updated: ${transition_releases_rows.info}`)
  await db('transition_releases').where('pid', current_pid).del()

  const [waiver_releases_rows] = await db.raw(
    `update ignore waiver_releases set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`waiver_releases rows updated: ${waiver_releases_rows.info}`)
  await db('waiver_releases').where('pid', current_pid).del()

  const [waivers_rows] = await db.raw(
    `update ignore waivers set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`waivers rows updated: ${waivers_rows.info}`)
  await db('waivers').where('pid', current_pid).del()

  const [league_player_gamelogs_rows] = await db.raw(
    `update ignore league_player_gamelogs set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_player_gamelogs rows updated: ${league_player_gamelogs_rows.info}`
  )
  await db('league_player_gamelogs').where('pid', current_pid).del()

  const [league_player_regular_seasonlogs_rows] = await db.raw(
    `update ignore league_player_regular_seasonlogs set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(
    `league_player_regular_seasonlogs rows updated: ${league_player_regular_seasonlogs_rows.info}`
  )
  await db('league_player_regular_seasonlogs').where('pid', current_pid).del()

  const [league_player_rows] = await db.raw(
    `update ignore league_player set pid = '${new_pid}' where pid = '${current_pid}'`
  )
  log(`league_player rows updated: ${league_player_rows.info}`)
  await db('league_player').where('pid', current_pid).del()
}
