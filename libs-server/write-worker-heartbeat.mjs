import db from '#db'

export default async function write_worker_heartbeat({
  worker_name,
  status,
  detail = null,
  loop_count = 0
}) {
  if (!worker_name) {
    throw new Error('worker_name is required')
  }
  if (!status) {
    throw new Error('status is required')
  }

  const now = Math.round(Date.now() / 1000)

  await db('worker_heartbeat')
    .insert({
      worker_name,
      last_iteration_at: now,
      last_iteration_status: status,
      last_iteration_detail: detail,
      loop_count,
      updated_at: db.fn.now()
    })
    .onConflict('worker_name')
    .merge([
      'last_iteration_at',
      'last_iteration_status',
      'last_iteration_detail',
      'loop_count',
      'updated_at'
    ])
}
