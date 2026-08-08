import dayjs from 'dayjs'

import { transaction_types } from '#constants'

export default function isOnReleaseWaivers({ transactions = [] } = {}) {
  // not on waivers without any transactions
  if (!transactions.length) {
    return false
  }

  // transactions.occurred_at is timestamptz: a Date on the server, an ISO
  // string in the SPA. Subtracting the raw values would be NaN for the string
  // form and would silently degrade the sort with nothing raising.
  const sorted = transactions.sort(
    (a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)
  )

  // not on waivers if not dropped within the last 24 hours
  const last = sorted[0]

  if (last.type !== transaction_types.ROSTER_RELEASE) {
    return false
  }

  if (dayjs().isAfter(dayjs(last.occurred_at).add(24, 'hour'))) {
    return false
  }

  // on waivers if there is only one transaction in the last 48 hours
  const previous = sorted[1]
  if (!previous) {
    return true
  }

  // not on waivers if not on roster for 24 hours before being dropped
  // EXCEPTION: if previous transaction is POACHED, allow immediate release to waivers
  const diff = dayjs(last.occurred_at).diff(dayjs(previous.occurred_at), 'hour')
  if (diff < 24 && previous.type !== transaction_types.POACHED) {
    return false
  }

  return true
}
