import dayjs from 'dayjs'

import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ league, pids }) {
  const now = dayjs()
  const isBeforeRestrictedFreeAgencyStart =
    (!constants.season.isRegularSeason && !league.tran_start) ||
    (league.tran_start && now.isBefore(dayjs.unix(league.tran_start)))
  const isBeforeRestrictedFreeAgencyEnd =
    (!constants.season.isRegularSeason && !league.tran_end) ||
    (league.tran_end && now.isBefore(dayjs.unix(league.tran_end)))
  const isRestrictedFreeAgency =
    !isBeforeRestrictedFreeAgencyStart && isBeforeRestrictedFreeAgencyEnd

  if (isRestrictedFreeAgency) {
    const restrictedFreeAgencyBids = await db('restricted_free_agency_bids')
      .whereIn('pid', pids)
      .where('year', constants.season.year)
      .whereNull('processed')
      .whereNull('cancelled')

    if (restrictedFreeAgencyBids.length) {
      throw new Error('Restricted free agency violation')
    }
  }
}
