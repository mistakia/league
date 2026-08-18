import { Record } from 'immutable'

export const Source = new Record({
  source_id: null,
  name: null,
  url: null,
  weight: null
})

export function createSource({ source_id, name, url, weight }) {
  return new Source({
    source_id,
    name,
    url,
    weight
  })
}
