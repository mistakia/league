import dayjs from 'dayjs'

import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ league, pids }) {
  const now = dayjs()
  const isBeforeTransitionStart =
    (!constants.season.isRegularSeason && !league.tran_start) ||
    (league.tran_start && now.isBefore(dayjs.unix(league.tran_start)))
  const isBeforeTransitionEnd =
    (!constants.season.isRegularSeason && !league.tran_end) ||
    (league.tran_end && now.isBefore(dayjs.unix(league.tran_end)))
  const isRestrictedFreeAgency =
    !isBeforeTransitionStart && isBeforeTransitionEnd

  if (isRestrictedFreeAgency) {
    const transitionBids = await db('transition_bids')
      .whereIn('pid', pids)
      .where('year', constants.season.year)
      .whereNull('processed')
      .whereNull('cancelled')

    if (transitionBids.length) {
      throw new Error('Restricted free agency violation')
    }
  }
}
