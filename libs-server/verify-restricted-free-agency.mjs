import dayjs from 'dayjs'

import db from '#db'
import { current_season } from '#constants'

export default async function ({ league, pids }) {
  const now = dayjs()
  const is_before_restricted_free_agency_start =
    (!current_season.isRegularSeason && !league.tran_start) ||
    (league.tran_start && now.isBefore(dayjs.unix(league.tran_start)))
  const is_before_restricted_free_agency_end =
    (!current_season.isRegularSeason && !league.tran_end) ||
    (league.tran_end && now.isBefore(dayjs.unix(league.tran_end)))
  const isRestrictedFreeAgency =
    !is_before_restricted_free_agency_start &&
    is_before_restricted_free_agency_end

  if (isRestrictedFreeAgency) {
    const restrictedFreeAgencyBids = await db('restricted_free_agency_bids')
      .whereIn('pid', pids)
      .where('year', current_season.year)
      .whereNull('processed')
      .whereNull('cancelled')

    if (restrictedFreeAgencyBids.length) {
      throw new Error('Restricted free agency violation')
    }
  }
}
