import * as chai from 'chai'
chai.should()

/**
 * Assert that a request returns a 403 Forbidden status
 * @param {Promise} request - The request promise
 * @param {string} expectedError - Optional expected error message pattern
 */
export default async function (request, expectedError = null) {
  const res = await request

  res.should.have.status(403)

  res.should.be.json
  if (expectedError) {
    res.body.error.should.include(expectedError)
  }
}
