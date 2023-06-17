/* global describe it */

import chai from 'chai'

import { formatPlayerName } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED formatPlayerName', function () {
  it('lower', () => {
    expect(formatPlayerName('Nick Chubb')).to.equal('nick chubb')
  })

  it('suffixes', () => {
    expect(formatPlayerName('Odell Beckham Jr.')).to.equal('odell beckham')
    expect(formatPlayerName("Le'Veon Bell Sr.")).to.equal('leveon bell')
    expect(formatPlayerName('Keelan Cole Sr.')).to.equal('keelan cole')
    expect(formatPlayerName('Allen Robinson II')).to.equal('allen robinson')
    expect(formatPlayerName('Chris Herndon IV')).to.equal('chris herndon')
    expect(formatPlayerName('D.J. Chark Jr.')).to.equal('dj chark')
    expect(formatPlayerName('Henry Ruggs III')).to.equal('henry ruggs')
    expect(formatPlayerName('JJ Arcega-Whiteside')).to.equal(
      'jj arcega-whiteside'
    )
  })

  it('periods', () => {
    expect(formatPlayerName('A.J. Green')).to.equal('aj green')
  })

  it('whitespace', () => {
    expect(formatPlayerName('          A.J.    Green ')).to.equal('aj green')
  })

  describe('errors', function () {
    it('integer', () => {
      expect(formatPlayerName(-2)).to.equal(null)
    })

    it('null', () => {
      expect(formatPlayerName(null)).to.equal(null)
    })

    it('undefined', () => {
      expect(formatPlayerName(undefined)).to.equal(null)
    })
  })
})
