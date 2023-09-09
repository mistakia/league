import { Record, List, Map } from 'immutable'

export const Poach = new Record({
  uid: null,
  tid: null,
  pid: null,
  processed: null,
  release: new List(),
  submitted: null,
  playerMap: new Map(),
  player_tid: null
})

export const createPoach = ({
  uid,
  tid,
  pid,
  processed,
  release,
  submitted,
  player_tid
}) =>
  new Poach({
    uid,
    tid,
    pid,
    processed,
    release: new List(release),
    submitted,
    player_tid
  })
