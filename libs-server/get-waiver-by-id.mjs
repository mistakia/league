import db from '#db'
import { constants } from '#libs-shared'

export default async function (waiver_id) {
  if (!waiver_id) {
    throw new Error('waiver_id is required')
  }

  const waiver = await db('waivers')
    .select(
      'waivers.*',
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid',
      'waivers.pid',
      'waivers.tid',
      'waivers.userid',
      'waivers.type as waiver_type',
      'waivers.super_priority'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .where('waivers.uid', waiver_id)
    .where('teams.year', constants.season.year)
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
