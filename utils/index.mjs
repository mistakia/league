export { default as readCSV } from './read-csv.mjs'
export { default as sendNotifications } from './send-notifications.mjs'
export { default as sendEmail } from './send-email.mjs'
export { default as sendGroupmeMessage } from './send-groupme-message.mjs'
export { default as getPlayer } from './get-player.mjs'
export { default as updatePlayer } from './update-player.mjs'
export { default as getSchedule } from './get-schedule.mjs'
export { default as getTeam } from './get-team.mjs'
export { default as isPlayerOnWaivers } from './is-player-on-waivers.mjs'
export { default as isPlayerRostered } from './is-player-rostered.mjs'
export { default as isPlayerLocked } from './is-player-locked.mjs'
export { default as submitPoach } from './submit-poach.mjs'
export { default as submitReserve } from './submit-reserve.mjs'
export { default as submitActivate } from './submit-activate.mjs'
export { default as processPoach } from './process-poach.mjs'
export { default as processRelease } from './process-release.mjs'
export { default as processTransitionBid } from './process-transition-bid.mjs'
export { default as getRoster } from './get-roster.mjs'
export { default as getProjections } from './get-projections.mjs'
export { default as getLeague } from './get-league.mjs'
export { default as resetWaiverOrder } from './reset-waiver-order.mjs'
export { default as getTopPoachingWaiver } from './get-top-poaching-waiver.mjs'
export { default as getTopFreeAgencyWaiver } from './get-top-free-agency-waiver.mjs'
export { default as getTopPracticeSquadWaiver } from './get-top-practice-squad-waiver.mjs'
export { default as getTopTransitionBids } from './get-top-transition-bids.mjs'
export { default as generateSchedule } from './generate-schedule.mjs'
export { default as submitAcquisition } from './submit-acquisition.mjs'
export { default as getTransactionsSinceAcquisition } from './get-transactions-since-acquisition.mjs'
export { default as getTransactionsSinceFreeAgent } from './get-transactions-since-free-agent.mjs'
export { default as getPlayerExtensions } from './get-player-extensions.mjs'
export { default as verifyUserTeam } from './verify-user-team.mjs'
export { default as verifyReserveStatus } from './verify-reserve-status.mjs'
export { default as verifyRestrictedFreeAgency } from './verify-restricted-free-agency.mjs'
export { default as googleDrive } from './google-drive.mjs'
export { default as getJobs } from './get-jobs.mjs'
export { default as getLastTransaction } from './get-last-transaction.mjs'
export { default as getPlayerTransactions } from './get-player-transactions.mjs'
export { default as getPlayers } from './get-players.mjs'
export { default as getRosters } from './get-rosters.mjs'
export { default as getAcquisitionTransaction } from './get-acquisition-transaction.mjs'
export { default as getPlay } from './get-play.mjs'
export { default as isMain } from './is-main.mjs'
export { default as getGameDetailUrl } from './get-game-detail-url.mjs'
export { default as getToken } from './get-token.mjs'
export { default as addPlayer } from './add-player.mjs'
export * as espn from './espn.mjs'
export * as sportradar from './sportradar.mjs'

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const getChartedPlayByPlayQuery = (db) =>
  db('nfl_plays')
    .select(
      'nfl_plays.player_fuml',
      'nfl_plays.fuml',
      'nfl_plays.off',
      'nfl_plays.type',
      'nfl_plays.bc',
      'nfl_plays.yds',
      'nfl_plays.yds_gained',
      'nfl_plays.fd',
      'nfl_plays.succ',
      'nfl_plays.psr',
      'nfl_plays.trg',
      'nfl_plays.intp',
      'nfl_plays.comp',
      'nfl_plays.td',
      'nfl_plays.sk',
      'nfl_plays.dwn',
      'nfl_plays.qtr',
      'nfl_plays.dot',
      'nfl_plays.qbp',
      'nfl_plays.qbhi',
      'nfl_plays.qbhu',
      'nfl_plays.high',
      'nfl_plays.intw',
      'nfl_plays.drp',
      'nfl_plays.cnb',
      'nfl_plays.mbt',
      'nfl_plays.yac',
      'nfl_plays.yaco',
      'nfl_games.wk',
      'nfl_games.day',
      'nfl_plays.cov_type',
      'nfl_plays.sep'
    )
    .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .whereNot('nfl_plays.type', 'NOPL')

const fields = [
  'nfl_plays.esbid',
  'nfl_plays.playId',
  'nfl_plays.sequence',
  'nfl_plays.dwn',
  'nfl_plays.desc',
  'nfl_plays.pos_team',
  'nfl_plays.seas',
  'nfl_plays.wk',
  'nfl_plays.qtr',
  'nfl_plays.ytg',
  'nfl_plays.game_clock_start',
  'nfl_plays.ydl_end',
  'nfl_plays.ydl_start',
  'nfl_plays.fd',
  'nfl_plays.gtg',
  'nfl_plays.drive_play_count',
  'nfl_plays.timestamp',
  'nfl_plays.type_nfl',
  'nfl_plays.updated',

  'nfl_games.h',
  'nfl_games.v'
]

export const getPlayByPlayQuery = (db) =>
  db('nfl_plays')
    .select(fields)
    .join('nfl_games', 'nfl_plays.esbid', '=', 'nfl_games.esbid')
