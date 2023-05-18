export default async function batch_insert({
  inserts,
  save,
  batch_size = 5000
}) {
  for (let i = 0; i < inserts.length; i += batch_size) {
    const batch = inserts.slice(i, i + batch_size)
    await save(batch)
  }
}
