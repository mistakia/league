import { Record, List } from 'immutable'

export const Poach = new Record({
  uid: null,
  tid: null,
  pid: null,
  processed: null,
  release: new List(),
  submitted: null
})

export const createPoach = ({ uid, tid, pid, processed, release, submitted }) =>
  new Poach({
    uid,
    tid,
    pid,
    processed,
    release: new List(release),
    submitted
  })
