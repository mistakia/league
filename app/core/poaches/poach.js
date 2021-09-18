import { Record, List } from 'immutable'

export const Poach = new Record({
  uid: null,
  tid: null,
  player: null,
  processed: null,
  release: new List(),
  submitted: null
})

export const createPoach = ({
  uid,
  tid,
  player,
  processed,
  release,
  submitted
}) =>
  new Poach({
    uid,
    tid,
    player,
    processed,
    release: new List(release),
    submitted
  })
