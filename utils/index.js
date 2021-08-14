const getChartedPlayByPlayQuery = (db) =>
  db('pbp')
    .select(
      'pbp.fuml',
      'pbp.fum',
      'pbp.off',
      'pbp.type',
      'pbp.bc',
      'pbp.yds',
      'pbp.fd',
      'pbp.succ',
      'pbp.psr',
      'pbp.trg',
      'pbp.ints',
      'pbp.comp',
      'pbp.pts',
      'pbp.sk1',
      'pbp.dwn',
      'pbp.qtr',
      'chart.dot',
      'chart.tay',
      'chart.qbp',
      'chart.qbhi',
      'chart.qbhu',
      'chart.high',
      'chart.intw',
      'chart.drp',
      'chart.cnb',
      'chart.mbt',
      'chart.yac',
      'chart.yaco',
      'game.wk',
      'game.day'
    )
    .join('game', 'pbp.gid', 'game.gid')
    .leftJoin('chart', 'pbp.pid', 'chart.pid')
    .whereNot('pbp.type', 'NOPL')
    .where(function () {
      this.whereNot({ 'pbp.act1': 'A' })
      this.orWhereNot({ 'pbp.act2': 'A' })
      this.orWhereNot({ 'pbp.act3': 'A' })
    })

const fields = [
  'nflPlay.esbid',
  'nflPlay.playId',
  'nflPlay.down',
  'nflPlay.playDescription',
  'nflPlay.possessionTeam',
  'nflPlay.season',
  'nflPlay.week',
  'nflPlay.quarter',
  'nflPlay.yardsToGo',
  'nflPlay.clockTime',
  'nflPlay.driveSequenceNumber',
  'nflPlay.endYardLine',
  'nflPlay.startYardLine',
  'nflPlay.firstDown',
  'nflPlay.goalToGo',
  'nflPlay.drivePlayCount',
  'nflPlay.playClock',
  'nflPlay.scoringPlay',
  'nflPlay.timeOfDay',
  'nflPlay.playTypeNFL',
  'nflPlay.updated',

  'nflSchedule.homeTeamAbbr',
  'nflSchedule.awayTeamAbbr'
]

const getPlayByPlayQuery = (db) =>
  db('nflPlay')
    .select(fields)
    .join('nflSchedule', 'nflPlay.esbid', '=', 'nflSchedule.esbid')

module.exports = {
  readCSV: require('./read-csv'),
  sendNotifications: require('./send-notifications'),
  sendEmail: require('./send-email'),
  getPlayerId: require('./get-player-id'),
  getSchedule: require('./get-schedule'),
  isPlayerOnWaivers: require('./is-player-on-waivers'),
  isPlayerRostered: require('./is-player-rostered'),
  isPlayerLocked: require('./is-player-locked'),
  submitPoach: require('./submit-poach'),
  processPoach: require('./process-poach'),
  processRelease: require('./process-release'),
  getRoster: require('./get-roster'),
  getLeague: require('./get-league'),
  resetWaiverOrder: require('./reset-waiver-order'),
  getTopPoachingWaiver: require('./get-top-poaching-waiver'),
  getTopFreeAgencyWaiver: require('./get-top-free-agency-waiver'),
  getTopPracticeSquadWaiver: require('./get-top-practice-squad-waiver'),
  generateSchedule: require('./generate-schedule'),
  submitAcquisition: require('./submit-acquisition'),
  getChartedPlayByPlayQuery,
  getPlayByPlayQuery,
  getTransactionsSinceAcquisition: require('./get-transactions-since-acquisition'),
  getTransactionsSinceFreeAgent: require('./get-transactions-since-free-agent'),

  upsert: require('./upsert'),

  verifyUserTeam: require('./verify-user-team'),
  verifyReserveStatus: require('./verify-reserve-status')
}
