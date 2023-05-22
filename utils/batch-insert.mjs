export default async function ({ items, save, batch_size }) {
  for (let i = 0; i < items.length; i += batch_size) {
    await save(items.slice(i, i + batch_size))
  }
}
