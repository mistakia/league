import dayjs from 'dayjs'

import db from '#db'
import { constants } from '#common'

export default async function ({ league, pids }) {
  const now = dayjs()
  const isBeforeExtensionDeadline =
    (!constants.season.isRegularSeason && !league.ext_date) ||
    (league.ext_date && now.isBefore(dayjs.unix(league.ext_date)))
  const isBeforeTransitionDeadline =
    (!constants.season.isRegularSeason && !league.tran_date) ||
    (league.tran_date && now.isBefore(dayjs.unix(league.tran_date)))
  const isRestrictedFreeAgency =
    !isBeforeExtensionDeadline && isBeforeTransitionDeadline

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
