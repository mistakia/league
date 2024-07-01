import db from '#db'

export default async function ({ lid, pids }) {
  const sub_query = db('transactions')
    .select(db.raw('max(timestamp) AS maxtime, pid AS playerid'))
    .groupBy('pid')
    .where('lid', lid)
    .as('sub_query')

  const transactions = await db
    .select('*')
    .from(sub_query)
    .innerJoin('transactions', function () {
      this.on(function () {
        this.on('playerid', '=', 'pid')
        this.andOn('maxtime', '=', 'timestamp')
      })
    })
    .where('lid', lid)
    .whereIn('pid', pids)

  return transactions
}
