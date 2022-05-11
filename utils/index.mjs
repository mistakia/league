import readCSV from './read-csv.mjs'
import sendNotifications from './send-notifications.mjs'
import sendEmail from './send-email.mjs'
import sendGroupmeMessage from './send-groupme-message.mjs'
import getPlayer from './get-player.mjs'
import updatePlayer from './update-player.mjs'
import getSchedule from './get-schedule.mjs'
import getTeam from './get-team.mjs'
import isPlayerOnWaivers from './is-player-on-waivers.mjs'
import isPlayerRostered from './is-player-rostered.mjs'
import isPlayerLocked from './is-player-locked.mjs'
import submitPoach from './submit-poach.mjs'
import submitReserve from './submit-reserve.mjs'
import submitActivate from './submit-activate.mjs'
import processPoach from './process-poach.mjs'
import processRelease from './process-release.mjs'
import processTransitionBid from './process-transition-bid.mjs'
import getRoster from './get-roster.mjs'
import getProjections from './get-projections.mjs'
import getLeague from './get-league.mjs'
import resetWaiverOrder from './reset-waiver-order.mjs'
import getTopPoachingWaiver from './get-top-poaching-waiver.mjs'
import getTopFreeAgencyWaiver from './get-top-free-agency-waiver.mjs'
import getTopPracticeSquadWaiver from './get-top-practice-squad-waiver.mjs'
import getTopTransitionBids from './get-top-transition-bids.mjs'
import generateSchedule from './generate-schedule.mjs'
import submitAcquisition from './submit-acquisition.mjs'
import getTransactionsSinceAcquisition from './get-transactions-since-acquisition.mjs'
import getTransactionsSinceFreeAgent from './get-transactions-since-free-agent.mjs'
import getPlayerExtensions from './get-player-extensions.mjs'
import verifyUserTeam from './verify-user-team.mjs'
import verifyReserveStatus from './verify-reserve-status.mjs'
import verifyRestrictedFreeAgency from './verify-restricted-free-agency.mjs'
import googleDrive from './google-drive.mjs'
import getJobs from './get-jobs.mjs'
import getLastTransaction from './get-last-transaction.mjs'
import getPlayerTransactions from './get-player-transactions.mjs'
import getPlayers from './get-players.mjs'
import getRosters from './get-rosters.mjs'
import getAcquisitionTransaction from './get-acquisition-transaction.mjs'
import getPlay from './get-play.mjs'
import isMain from './is-main.mjs'
import getGameDetailUrl from './get-game-detail-url.mjs'
import getToken from './get-token.mjs'

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

export {
  readCSV,
  sendNotifications,
  sendEmail,
  sendGroupmeMessage,
  getPlayer,
  updatePlayer,
  getSchedule,
  getTeam,
  isPlayerOnWaivers,
  isPlayerRostered,
  isPlayerLocked,
  submitPoach,
  submitReserve,
  submitActivate,
  processPoach,
  processRelease,
  processTransitionBid,
  getRoster,
  getProjections,
  getLeague,
  resetWaiverOrder,
  getTopPoachingWaiver,
  getTopFreeAgencyWaiver,
  getTopPracticeSquadWaiver,
  getTopTransitionBids,
  generateSchedule,
  submitAcquisition,
  getTransactionsSinceAcquisition,
  getTransactionsSinceFreeAgent,
  getPlayerExtensions,
  verifyUserTeam,
  verifyReserveStatus,
  verifyRestrictedFreeAgency,
  googleDrive,
  getJobs,
  getLastTransaction,
  getPlayerTransactions,
  getPlayers,
  getRosters,
  getAcquisitionTransaction,
  getPlay,
  isMain,
  getGameDetailUrl,
  getToken
}
