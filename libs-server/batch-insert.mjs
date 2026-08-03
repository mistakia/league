// Chunk `items` into `batch_size` slices and hand each to `save`.
//
// `concurrency` bounds how many chunks may be in flight at once, and defaults to
// 1 -- the strictly serial behaviour this module had before the option existed.
// Serial is the right default rather than a conservative one: whether two chunks
// may safely overlap is a property of what `save` does, not of the chunking, and
// there are 75 call sites here that were written against a serial loop. Raising
// it is a per-call-site claim that the chunks are independent.
//
// A rejected chunk does not cancel the workers already running -- there is no
// way to cancel an in-flight query -- so the workers are drained before the
// first error is rethrown. Rejecting eagerly instead would leave the remaining
// workers to settle unobserved and surface as unhandled rejections, attributed
// to whatever happened to be running when the process noticed.
export default async function ({ items, save, batch_size, concurrency = 1 }) {
  if (concurrency <= 1) {
    for (let i = 0; i < items.length; i += batch_size) {
      await save(items.slice(i, i + batch_size))
    }
    return
  }

  const chunks = []
  for (let i = 0; i < items.length; i += batch_size) {
    chunks.push(items.slice(i, i + batch_size))
  }

  let next_chunk = 0

  // Workers pull from a shared cursor rather than being handed a fixed share, so
  // a slow chunk does not idle the others. The read-and-increment is safe
  // without a lock because it spans no await.
  const worker = async () => {
    while (next_chunk < chunks.length) {
      const chunk = chunks[next_chunk++]
      await save(chunk)
    }
  }

  const results = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, chunks.length) }, worker)
  )

  const failure = results.find((result) => result.status === 'rejected')
  if (failure) {
    throw failure.reason
  }
}
