import { request as chai_request } from 'chai-http'
import server from '#api'

/**
 * Builds a cancel waiver request (doesn't execute it)
 * Useful for error tests that need to test validation
 * @param {Object} options
 * @param {number} options.waiverId - Waiver ID to cancel
 * @param {number} options.leagueId - League ID
 * @param {string} [options.token] - Authorization token (optional)
 * @param {Object} [options.body] - Request body (teamId, leagueId)
 * @returns {Object} Chai request object (not executed)
 */
export default function build_cancel_waiver_request({
  waiverId,
  leagueId,
  token = null,
  body = {}
}) {
  let request = chai_request
    .execute(server)
    .post(`/api/leagues/${leagueId}/waivers/${waiverId}/cancel`)

  if (token) {
    request = request.set('Authorization', `Bearer ${token}`)
  }

  if (Object.keys(body).length > 0) {
    request = request.send(body)
  }

  return request
}
