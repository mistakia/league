import db from '#db'

export default async function ({ lid, playerIds }) {
  const sub = db('transactions')
    .select(db.raw('max(timestamp) AS maxtime, player AS playerid'))
    .groupBy('player')
    .where('lid', lid)

  const transactions = await db
    .select('*')
    .from(db.raw('(' + sub.toString() + ') AS X'))
    .innerJoin('transactions', function () {
      this.on(function () {
        this.on('playerid', '=', 'player')
        this.andOn('maxtime', '=', 'timestamp')
      })
    })
    .where('lid', lid)
    .whereIn('player', playerIds)

  return transactions
}
