import { Record, List } from 'immutable'

export const Waiver = new Record({
  uid: null,
  tid: null,
  player: null,
  po: 0,
  release: new List(),
  succ: null,
  reason: null,
  bid: null,
  type: null
})

export function createWaiver({
  uid,
  tid,
  player,
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
    player,
    po,
    release: new List(release),
    succ,
    reason,
    bid,
    type
  })
}
