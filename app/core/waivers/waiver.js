import { Record, List, Map } from 'immutable'

export const Waiver = new Record({
  uid: null,
  tid: null,
  pid: null,
  po: 0,
  release: new List(),
  succ: null,
  reason: null,
  bid: null,
  type: null,
  player_map: new Map()
})

export function createWaiver({
  uid,
  tid,
  pid,
  po,
  release,
  succ,
  reason,
  bid,
  type
}) {
  return new Waiver({
    uid,
    tid,
    pid,
    po,
    release: new List(release),
    succ,
    reason,
    bid,
    type
  })
}
