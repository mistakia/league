/* global describe it */

const chai = require('chai')
const dayjs = require('dayjs')

const { getDraftWindow } = require('../common')

chai.should()
const expect = chai.expect

describe('COMMON getDraftWindow', function () {
  it('first pick', () => {
    const start = dayjs().utc().utcOffset(-4).startOf('day')
    const draftWindow = getDraftWindow({
      start: start.unix(),
      pickNum: 1
    })

    expect(draftWindow.hour()).to.equal(11)
    expect(draftWindow.minute()).to.equal(0)
    expect(draftWindow.day()).to.equal(start.day())
  })

  it('second pick', () => {
    const start = dayjs().utc().utcOffset(-4).startOf('day')
    const draftWindow = getDraftWindow({
      start: start.unix(),
      pickNum: 2
    })

    expect(draftWindow.hour()).to.equal(12)
    expect(draftWindow.minute()).to.equal(0)
    expect(draftWindow.day()).to.equal(start.day())
  })

  it('sixth pick', () => {
    const start = dayjs().utc().utcOffset(-4).startOf('day')
    const draftWindow = getDraftWindow({
      start: start.unix(),
      pickNum: 6
    })

    expect(draftWindow.hour()).to.equal(16)
    expect(draftWindow.minute()).to.equal(0)
    expect(draftWindow.day()).to.equal(start.day())
  })

  it('seventh pick', () => {
    const start = dayjs().utc().utcOffset(-4).startOf('day')
    const draftWindow = getDraftWindow({
      start: start.unix(),
      pickNum: 7
    })

    expect(draftWindow.hour()).to.equal(11)
    expect(draftWindow.minute()).to.equal(0)
    expect(draftWindow.day()).to.equal(start.add('1', 'day').day())
  })
})
