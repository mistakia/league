import { Record } from 'immutable'

export const Source = new Record({
  uid: null,
  name: null,
  url: null,
  weight: null
})

export function createSource({ uid, name, url, weight }) {
  return new Source({
    uid,
    name,
    url,
    weight
  })
}
