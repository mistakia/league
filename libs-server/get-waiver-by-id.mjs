import db from '#db'
import { current_season } from '#constants'

export default async function (waiver_id) {
  if (!waiver_id) {
    throw new Error('waiver_id is required')
  }

  const waiver = await db('waivers')
    .select(
      'waivers.*',
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid_amount',
      'waivers.pid',
      'waivers.tid',
      'waivers.user_id',
      'waivers.type as waiver_type',
      'waivers.super_priority'
    )
    .join('teams', 'waivers.tid', 'teams.team_id')
    .where('waivers.uid', waiver_id)
    .where('teams.season_year', current_season.year)
    .first()

  if (!waiver) {
    throw new Error(`Waiver with ID ${waiver_id} not found`)
  }

  if (waiver.processed) {
    throw new Error(`Waiver ${waiver_id} has already been processed`)
  }

  if (waiver.cancelled) {
    throw new Error(`Waiver ${waiver_id} has been cancelled`)
  }

  return waiver
}
