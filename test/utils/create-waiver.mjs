import { request as chai_request } from 'chai-http'
import server from '#api'
import knex from '#db'

/**
 * Creates a waiver claim via API
 * @param {Object} options
 * @param {string} options.pid - Player ID
 * @param {number} options.teamId - Team ID
 * @param {number} options.leagueId - League ID
 * @param {number} options.type - Waiver type (from waiver_types)
 * @param {string} options.token - Authorization token
 * @param {number} [options.bid] - Bid amount (optional)
 * @param {string[]} [options.release] - Player IDs to release (optional)
 * @returns {Promise<Object>} Waiver response with uid
 */
export default async function create_waiver({
  pid,
  teamId,
  leagueId,
  type,
  token,
  bid = 0,
  release = []
}) {
  const res = await chai_request
    .execute(server)
    .post(`/api/leagues/${leagueId}/waivers`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      teamId,
      pid,
      type,
      leagueId,
      bid,
      release
    })

  if (res.status !== 200) {
    throw new Error(
      `Failed to create waiver: ${res.status} - ${JSON.stringify(res.body)}`
    )
  }

  return res.body
}

/**
 * Cancels any existing uncancelled waivers for a player/team/league combination
 * @param {Object} options
 * @param {string} options.pid - Player ID
 * @param {number} options.teamId - Team ID
 * @param {number} options.leagueId - League ID
 * @param {number} options.type - Waiver type
 */
export async function cancel_existing_waivers({ pid, teamId, leagueId, type }) {
  const existing_waivers = await knex('waivers')
    .where({
      pid,
      tid: teamId,
      lid: leagueId,
      type
    })
    .whereNull('processed')
    .whereNull('cancelled')

  if (existing_waivers.length > 0) {
    await knex('waivers')
      .update('cancelled', Math.round(Date.now() / 1000))
      .whereIn(
        'uid',
        existing_waivers.map((w) => w.uid)
      )
  }
}

/**
 * Creates a fresh waiver, canceling any existing ones first
 * @param {Object} options - Same as create_waiver
 * @returns {Promise<Object>} Waiver response with uid
 */
export async function create_fresh_waiver(options) {
  await cancel_existing_waivers({
    pid: options.pid,
    teamId: options.teamId,
    leagueId: options.leagueId,
    type: options.type
  })

  return create_waiver(options)
}
