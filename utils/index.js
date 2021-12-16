const getChartedPlayByPlayQuery = (db) =>
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

const getPlayByPlayQuery = (db) =>
  db('nfl_plays')
    .select(fields)
    .join('nfl_games', 'nfl_plays.esbid', '=', 'nfl_games.esbid')

module.exports = {
  readCSV: require('./read-csv'),
  sendNotifications: require('./send-notifications'),
  sendEmail: require('./send-email'),
  sendGroupmeMessage: require('./send-groupme-message'),
  getPlayer: require('./get-player'),
  updatePlayer: require('./update-player'),
  getSchedule: require('./get-schedule'),
  getTeam: require('./get-team'),
  isPlayerOnWaivers: require('./is-player-on-waivers'),
  isPlayerRostered: require('./is-player-rostered'),
  isPlayerLocked: require('./is-player-locked'),
  submitPoach: require('./submit-poach'),
  submitReserve: require('./submit-reserve'),
  submitActivate: require('./submit-activate'),
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
