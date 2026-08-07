import dayjs from 'dayjs'

import db from '#db'
import { current_season } from '#constants'

export default async function ({ league, pids }) {
  const now = dayjs()
  const is_before_restricted_free_agency_start =
    (!current_season.isRegularSeason &&
      !league.restricted_free_agency_period_start) ||
    (league.restricted_free_agency_period_start &&
      now.isBefore(dayjs(league.restricted_free_agency_period_start)))
  const is_before_restricted_free_agency_end =
    (!current_season.isRegularSeason &&
      !league.restricted_free_agency_period_end) ||
    (league.restricted_free_agency_period_end &&
      now.isBefore(dayjs(league.restricted_free_agency_period_end)))
  const isRestrictedFreeAgency =
    !is_before_restricted_free_agency_start &&
    is_before_restricted_free_agency_end

  if (isRestrictedFreeAgency) {
    const restrictedFreeAgencyBids = await db('restricted_free_agency_bids')
      .whereIn('pid', pids)
      .where('season_year', current_season.year)
      .whereNull('processed')
      .whereNull('cancelled')

    if (restrictedFreeAgencyBids.length) {
      throw new Error('Restricted free agency violation')
    }
  }
}
