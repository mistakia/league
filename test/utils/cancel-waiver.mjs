import { request as chai_request } from 'chai-http'
import server from '#api'

/**
 * Cancels a waiver claim via API
 * @param {Object} options
 * @param {number} options.waiverId - Waiver ID to cancel
 * @param {number} options.teamId - Team ID
 * @param {number} options.leagueId - League ID
 * @param {string} options.token - Authorization token
 * @returns {Promise<Object>} Cancelled waiver response
 */
export default async function cancel_waiver({
  waiverId,
  teamId,
  leagueId,
  token
}) {
  const res = await chai_request
    .execute(server)
    .post(`/api/leagues/${leagueId}/waivers/${waiverId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      teamId,
      leagueId
    })

  if (res.status !== 200) {
    throw new Error(
      `Failed to cancel waiver: ${res.status} - ${JSON.stringify(res.body)}`
    )
  }

  return res.body
}
