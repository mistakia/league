const getChartedPlayByPlayQuery = (db) =>
  db('nflPlay')
    .select(
      'nflPlay.fum',
      'nflPlay.fuml',
      'nflPlay.off',
      'nflPlay.type',
      'nflPlay.bc',
      'nflPlay.yds',
      'nflPlay.yds_gained',
      'nflPlay.fd',
      'nflPlay.succ',
      'nflPlay.psr',
      'nflPlay.trg',
      'nflPlay.intp',
      'nflPlay.comp',
      'nflPlay.td',
      'nflPlay.sk',
      'nflPlay.dwn',
      'nflPlay.qtr',
      'nflPlay.dot',
      'nflPlay.qbp',
      'nflPlay.qbhi',
      'nflPlay.qbhu',
      'nflPlay.high',
      'nflPlay.intw',
      'nflPlay.drp',
      'nflPlay.cnb',
      'nflPlay.mbt',
      'nflPlay.yac',
      'nflPlay.yaco',
      'nfl_games.wk',
      'nfl_games.day'
    )
    .join('nfl_games', 'nflPlay.esbid', 'nfl_games.esbid')
    .whereNot('nflPlay.type', 'NOPL')

const fields = [
  'nflPlay.esbid',
  'nflPlay.playId',
  'nflPlay.sequence',
  'nflPlay.dwn',
  'nflPlay.playDescription',
  'nflPlay.possessionTeam',
  'nflPlay.seas',
  'nflPlay.wk',
  'nflPlay.qtr',
  'nflPlay.yardsToGo',
  'nflPlay.clockTime',
  'nflPlay.driveSequenceNumber',
  'nflPlay.endYardLine',
  'nflPlay.startYardLine',
  'nflPlay.fd',
  'nflPlay.goalToGo',
  'nflPlay.drivePlayCount',
  'nflPlay.playClock',
  'nflPlay.scoringPlay',
  'nflPlay.timeOfDay',
  'nflPlay.type_nfl',
  'nflPlay.updated',

  'nfl_games.h',
  'nfl_games.v'
]

const getPlayByPlayQuery = (db) =>
  db('nflPlay')
    .select(fields)
    .join('nfl_games', 'nflPlay.esbid', '=', 'nfl_games.esbid')

module.exports = {
  readCSV: require('./read-csv'),
  sendNotifications: require('./send-notifications'),
  sendEmail: require('./send-email'),
  sendGroupmeMessage: require('./send-groupme-message'),
  getPlayerId: require('./get-player-id'),
  getSchedule: require('./get-schedule'),
  getTeam: require('./get-team'),
  isPlayerOnWaivers: require('./is-player-on-waivers'),
  isPlayerRostered: require('./is-player-rostered'),
  isPlayerLocked: require('./is-player-locked'),
  submitPoach: require('./submit-poach'),
  processPoach: require('./process-poach'),
  processRelease: require('./process-release'),
  processTransitionBid: require('./process-transition-bid'),
  getRoster: require('./get-roster'),
  getProjections: require('./get-projections'),
  getLeague: require('./get-league'),
  resetWaiverOrder: require('./reset-waiver-order'),
  getTopPoachingWaiver: require('./get-top-poaching-waiver'),
  getTopFreeAgencyWaiver: require('./get-top-free-agency-waiver'),
  getTopPracticeSquadWaiver: require('./get-top-practice-squad-waiver'),
  getTopTransitionBids: require('./get-top-transition-bids'),
  generateSchedule: require('./generate-schedule'),
  submitAcquisition: require('./submit-acquisition'),
  getChartedPlayByPlayQuery,
  getPlayByPlayQuery,
  getTransactionsSinceAcquisition: require('./get-transactions-since-acquisition'),
  getTransactionsSinceFreeAgent: require('./get-transactions-since-free-agent'),

  upsert: require('./upsert'),

  verifyUserTeam: require('./verify-user-team'),
  verifyReserveStatus: require('./verify-reserve-status'),
  verifyRestrictedFreeAgency: require('./verify-restricted-free-agency'),

  googleDrive: require('./google-drive'),
  getJobs: require('./get-jobs'),

  getPlayerTransactions: require('./get-player-transactions'),
  getPlayers: require('./get-players'),
  getRosters: require('./get-rosters'),
  getAcquisitionTransaction: require('./get-acquisition-transaction'),
  getPlay: require('./get-play')
}
