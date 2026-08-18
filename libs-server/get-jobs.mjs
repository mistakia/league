import db from '#db'

export default async function () {
  const sub_query = db('jobs')
    .select(db.raw('max(job_id) as max_job_id'))
    .groupBy('type')
    .as('sub_query')

  const jobs = await db
    .select('*')
    .from(sub_query)
    .join('jobs', 'sub_query.max_job_id', 'jobs.job_id')

  return jobs
}
