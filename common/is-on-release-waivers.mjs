import dayjs from 'dayjs'

import { transactions as constantsTransactions } from './constants.mjs'

export default function isOnReleaseWaivers({ transactions = [] } = {}) {
  // not on waivers without any transactions
  if (!transactions.length) {
    return false
  }

  const sorted = transactions.sort((a, b) => b.timestamp - a.timestamp)

  // not on waivers if not dropped within the last 24 hours
  const last = sorted[0]

  if (last.type !== constantsTransactions.ROSTER_RELEASE) {
    return false
  }

  if (dayjs().isAfter(dayjs.unix(last.timestamp).add(24, 'hour'))) {
    return false
  }

  // on waivers if there is only one transaction in the last 48 hours
  const previous = sorted[1]
  if (!previous) {
    return true
  }

  // not on waivers if not on roster for 24 hours before being dropped
  const diff = dayjs
    .unix(last.timestamp)
    .diff(dayjs.unix(previous.timestamp), 'hour')
  if (diff < 24) {
    return false
  }

  return true
}
