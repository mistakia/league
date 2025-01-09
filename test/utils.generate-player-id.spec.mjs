/* global describe it */
import * as chai from 'chai'

import { generate_player_id } from '#libs-server'

chai.should()
const expect = chai.expect

describe('UTILS generate_player_id', function () {
  it('should generate a player id', () => {
    const pid = generate_player_id({
      fname: 'John',
      lname: 'Doe',
      start: '2019',
      dob: '1990-01-01'
    })

    expect(pid).to.equal('JOHN-DOEX-2019-1990-01-01')
    expect(pid).to.be.a('string')
    expect(pid).to.have.lengthOf(25)
    expect(pid).to.match(/^[A-Z]{4}-[A-Z]{4}-\d{4}-\d{4}-\d{2}-\d{2}$/)
  })

  it('should generate a player id with a short last name', () => {
    const pid = generate_player_id({
      fname: 'John',
      lname: 'D',
      start: '2019',
      dob: '1990-01-01'
    })

    expect(pid).to.equal('JOHN-DXXX-2019-1990-01-01')
    expect(pid).to.be.a('string')
    expect(pid).to.have.lengthOf(25)
    expect(pid).to.match(/^[A-Z]{4}-[A-Z]{4}-\d{4}-\d{4}-\d{2}-\d{2}$/)
  })

  it('should generate a player id with a short first name', () => {
    const pid = generate_player_id({
      fname: 'J',
      lname: 'Doe',
      start: '2019',
      dob: '1990-01-01'
    })

    expect(pid).to.equal('JXXX-DOEX-2019-1990-01-01')
    expect(pid).to.be.a('string')
    expect(pid).to.have.lengthOf(25)
    expect(pid).to.match(/^[A-Z]{4}-[A-Z]{4}-\d{4}-\d{4}-\d{2}-\d{2}$/)
  })

  it('should throw an error with missing dob', () => {
    expect(() =>
      generate_player_id({
        fname: 'John',
        lname: 'Doe',
        start: '2019'
      })
    ).to.throw('Missing field dob')
  })

  it('should throw an error with missing start', () => {
    expect(() =>
      generate_player_id({
        fname: 'John',
        lname: 'Doe',
        dob: '1990-01-01'
      })
    ).to.throw('Missing field start')
  })

  it('should throw an error with missing lname', () => {
    expect(() =>
      generate_player_id({
        fname: 'John',
        start: '2019',
        dob: '1990-01-01'
      })
    ).to.throw('Missing field lname')
  })

  it('should throw an error with missing fname', () => {
    expect(() =>
      generate_player_id({
        lname: 'Doe',
        start: '2019',
        dob: '1990-01-01'
      })
    ).to.throw('Missing field fname')
  })

  it('should generate a complete player id with a misformatted dob', () => {
    const pid = generate_player_id({
      fname: 'John',
      lname: 'Doe',
      start: '2019',
      dob: '1990-1-1'
    })

    expect(pid).to.equal('JOHN-DOEX-2019-1990-01-01')
    expect(pid).to.be.a('string')
    expect(pid).to.have.lengthOf(25)
    expect(pid).to.match(/^[A-Z]{4}-[A-Z]{4}-\d{4}-\d{4}-\d{2}-\d{2}$/)
  })

  it('should generate a complete player id with a misformatted start', () => {
    const pid = generate_player_id({
      fname: 'John',
      lname: 'Doe',
      start: '19',
      dob: '1990-01-01'
    })

    expect(pid).to.equal('JOHN-DOEX-0019-1990-01-01')
    expect(pid).to.be.a('string')
    expect(pid).to.have.lengthOf(25)
    expect(pid).to.match(/^[A-Z]{4}-[A-Z]{4}-\d{4}-\d{4}-\d{2}-\d{2}$/)
  })
})
