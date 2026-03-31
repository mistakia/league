import * as chai from 'chai'
chai.should()

export default async function (request, param) {
  const res = await request

  if (res.status !== 400) {
    console.log(`[test] Expected 400, got ${res.status}:`, res.body)
  }

  res.should.have.status(400)

  res.should.be.json
  res.body.error.should.equal(`missing ${param}`)
}
