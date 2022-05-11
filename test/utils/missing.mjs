import chai from 'chai'
chai.should()

export default async function (request, param) {
  const res = await request

  res.should.have.status(400)
  // eslint-disable-next-line
  res.should.be.json
  res.body.error.should.equal(`missing ${param}`)
}
