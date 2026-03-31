export default async function (request) {
  const res = await request

  if (res.status !== 401) {
    console.log(`[test] Expected 401, got ${res.status}:`, res.body)
  }

  res.should.have.status(401)

  res.should.be.json
  res.body.error.should.equal('Authentication required')
}
