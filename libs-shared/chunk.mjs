export const chunk_array = ({ items, chunk_size }) => {
  if (
    !Array.isArray(items) ||
    !Number.isFinite(chunk_size) ||
    chunk_size <= 0
  ) {
    return []
  }

  const chunks = []
  for (let i = 0; i < items.length; i += chunk_size) {
    chunks.push(items.slice(i, i + chunk_size))
  }
  return chunks
}

export const chunk_mutating = ({ items, chunk_size }) => {
  if (
    !Array.isArray(items) ||
    !Number.isFinite(chunk_size) ||
    chunk_size <= 0
  ) {
    return []
  }

  const chunks = []
  const copy = items.slice()
  while (copy.length > 0) {
    chunks.push(copy.splice(0, chunk_size))
  }
  return chunks
}
