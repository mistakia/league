import { Record, List, Map } from 'immutable'

export const Poach = new Record({
  poach_id: null,
  tid: null,
  pid: null,
  processed: null,
  release: new List(),
  submitted: null,
  player_map: new Map(),
  player_tid: null
})

export const createPoach = ({
  poach_id,
  tid,
  pid,
  processed,
  release,
  submitted,
  player_tid
}) =>
  new Poach({
    poach_id,
    tid,
    pid,
    processed,
    release: new List(release),
    submitted,
    player_tid
  })
