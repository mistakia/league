// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const moment = require('moment')
const debug = require('debug')

const { constants, groupBy } = require('../common')
const { sendNotifications, submitPoach, resetWaiverOrder } = require('../utils')
const db = require('../db')

const log = debug('process:waivers:poach')
debug.enable('process:waivers:poach')

const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const waivers = await db('waivers')
    .select('teams.*', 'waivers.uid as wid', 'waivers.player', 'waivers.drop', 'waivers.tid', 'waivers.userid')
    .join('teams', 'waivers.tid', 'teams.uid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.POACH)

  if (!waivers.length) {
    log('no waivers to process')
    process.exit()
  }

  const waiversByLeague = groupBy(waivers, 'lid')
  for (const lid in waiversByLeague) {
    const leagueWaivers = waiversByLeague[lid]
    const playerIds = leagueWaivers.map(w => w.player)
    const sub = db('transactions')
      .select(db.raw('max(timestamp) as maxtime, CONCAT(player, "_", lid) AS Group1'))
      .groupBy('Group1')
      .whereIn('player', playerIds)
      .where('lid', lid)

    const transactions = await db
      .select('*', 'player.fname', 'player.lname')
      .from(db.raw('(' + sub.toString() + ') AS X'))
      .join(
        'transactions',
        function () {
          this.on(function () {
            this.on(db.raw('CONCAT(player, "_", lid) = X.Group1'))
            this.andOn('timestamp', '=', 'maxtime')
          })
        }
      )
      .join('player', 'transactions.player', 'player.player')

    const filtered = leagueWaivers.filter(w => {
      // ignore waiver for players deactivated in the last 24 hours
      const tran = transactions.find(t => t.player === w.player)
      if ((tran.type === constants.transactions.ROSTER_DEACTIVATE ||
        tran.type === constants.transactions.DRAFT ||
        tran.type === constants.transactions.PRACTICE_ADD) &&
        moment().isBefore(moment(tran.timestamp, 'X').add('24', 'hours'))
      ) {
        log(`ignoring waiver for ${w.player}, less than 24 hours`)
        return false
      }

      return true
    })
    const sorted = filtered.sort((a, b) => a.wo - b.wo)

    for (const waiver of sorted) {
      let error

      const tran = transactions.find(t => t.player === waiver.player)
      try {
        await submitPoach({
          leagueId: waiver.lid,
          userId: waiver.userid,
          drop: waiver.drop,
          player: waiver.player,
          teamId: waiver.tid,
          team: waiver
        })

        log(`poaching waiver awarded to ${waiver.name} (${waiver.tid}) for ${waiver.player}`)

        await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
      } catch (err) {
        error = err
        log(`poaching waiver unsuccessful for ${waiver.name} (${waiver.tid}) because ${error.message}`)
        await sendNotifications({
          leagueId: waiver.lid,
          teamIds: [waiver.tid],
          voice: false,
          league: false,
          message: `Your waiver claim to poach ${tran.fname} ${tran.lname} was unsuccessful.`
        })
      }

      await db('waivers')
        .update('succ', !error)
        .update('reason', error ? error.message : null) // TODO - add error codes
        .update('processed', timestamp)
        .where('uid', waiver.wid)
    }
  }

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
