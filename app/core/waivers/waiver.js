import { Record, List, Map } from 'immutable'

export const Waiver = new Record({
  waiver_id: null,
  tid: null,
  pid: null,
  priority_order: 0,
  release: new List(),
  is_successful: null,
  reason: null,
  bid_amount: null,
  type: null,
  player_map: new Map()
})

export function createWaiver({
  waiver_id,
  tid,
  pid,
  priority_order,
  release,
  is_successful,
  reason,
  bid_amount,
  type
}) {
  return new Waiver({
    waiver_id,
    tid,
    pid,
    priority_order,
    release: new List(release),
    is_successful,
    reason,
    bid_amount,
    type
  })
}
