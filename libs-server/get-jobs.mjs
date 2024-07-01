import db from '#db'

export default async function () {
  const sub_query = db('jobs')
    .select(db.raw('max(uid) as maxuid'))
    .groupBy('type')
    .as('sub_query')

  const jobs = await db
    .select('*')
    .from(sub_query)
    .join('jobs', 'sub_query.maxuid', 'jobs.uid')

  return jobs
}
