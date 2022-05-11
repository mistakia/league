export default async function (request) {
  const res = await request

  res.should.have.status(401)
  // eslint-disable-next-line
  res.should.be.json
  res.body.error.should.equal('invalid token')
}
