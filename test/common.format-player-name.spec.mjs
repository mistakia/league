/* global describe it */

import * as chai from 'chai'

import { format_player_name } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED format_player_name', function () {
  it('lower', () => {
    expect(format_player_name('Nick Chubb')).to.equal('nick chubb')
  })

  it('suffixes', () => {
    expect(format_player_name('Odell Beckham Jr.')).to.equal('odell beckham')
    expect(format_player_name("Le'Veon Bell Sr.")).to.equal('leveon bell')
    expect(format_player_name('Keelan Cole Sr.')).to.equal('keelan cole')
    expect(format_player_name('Allen Robinson II')).to.equal('allen robinson')
    expect(format_player_name('Chris Herndon IV')).to.equal('chris herndon')
    expect(format_player_name('D.J. Chark Jr.')).to.equal('dj chark')
    expect(format_player_name('Henry Ruggs III')).to.equal('henry ruggs')
    expect(format_player_name('JJ Arcega-Whiteside')).to.equal(
      'jj arcega-whiteside'
    )
  })

  it('periods', () => {
    expect(format_player_name('A.J. Green')).to.equal('aj green')
  })

  it('whitespace', () => {
    expect(format_player_name('          A.J.    Green ')).to.equal('aj green')
  })

  describe('errors', function () {
    it('integer', () => {
      expect(format_player_name(-2)).to.equal(null)
    })

    it('null', () => {
      expect(format_player_name(null)).to.equal(null)
    })

    it('undefined', () => {
      expect(format_player_name(undefined)).to.equal(null)
    })
  })
})
