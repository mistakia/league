const chai = require('chai')
chai.should()

module.exports = async (request, message) => {
  const res = await request

  res.should.have.status(400)
  // eslint-disable-next-line
  res.should.be.json
  res.body.error.should.equal(message)
}
