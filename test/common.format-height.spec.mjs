/* global describe it */

import * as chai from 'chai'

import { formatHeight } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED formatHeight', function () {
  it('inches', () => {
    const target = 82
    expect(formatHeight('82')).to.equal(target)
    expect(formatHeight(82)).to.equal(target)
  })

  it('feet and inches', () => {
    const target = 74
    expect(formatHeight('6\' 2"')).to.equal(target)
    expect(formatHeight('6\'2"')).to.equal(target)
    expect(formatHeight('6 \' 2 "')).to.equal(target)
    expect(formatHeight('6 \' 2"')).to.equal(target)
    expect(formatHeight('6  \' 2  "')).to.equal(target)
  })

  it('feet', () => {
    const target = 72
    expect(formatHeight("6'")).to.equal(target)
    expect(formatHeight("6 '")).to.equal(target)
    expect(formatHeight("6 ' ")).to.equal(target)
    expect(formatHeight('6 \' 0"')).to.equal(target)
  })

  describe('errors', function () {
    it('negative', () => {
      expect(formatHeight(-2)).to.equal(null)
    })

    it('too tall', () => {
      expect(formatHeight(88)).to.equal(null)
    })

    it('null', () => {
      expect(formatHeight(null)).to.equal(null)
    })

    it('undefined', () => {
      expect(formatHeight(undefined)).to.equal(null)
    })
  })
})
