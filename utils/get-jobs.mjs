import db from '#db'

export default async function () {
  const sub = db('jobs').select(db.raw('max(uid) as maxuid')).groupBy('type')

  const jobs = await db
    .select('*')
    .from(db.raw('(' + sub.toString() + ') AS X'))
    .join('jobs', 'X.maxuid', 'jobs.uid')

  return jobs
}
