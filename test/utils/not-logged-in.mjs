export default async function (request) {
  const res = await request

  res.should.have.status(401)

  res.should.be.json
  res.body.error.should.equal('Authentication required')
}
