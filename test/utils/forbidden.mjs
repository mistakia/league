import * as chai from 'chai'
chai.should()

/**
 * Assert that a request returns a 403 Forbidden status
 * @param {Promise} request - The request promise
 * @param {string} expectedError - Optional expected error message pattern
 */
export default async function (request, expectedError = null) {
  const res = await request

  if (res.status !== 403) {
    console.log(`[test] Expected 403, got ${res.status}:`, res.body)
  }

  res.should.have.status(403)

  res.should.be.json
  if (expectedError) {
    res.body.error.should.include(expectedError)
  }
}
