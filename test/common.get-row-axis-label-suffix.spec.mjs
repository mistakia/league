/* global describe it */

import * as chai from 'chai'

import get_row_axis_label_suffix from '#libs-shared/get-row-axis-label-suffix.mjs'

const { expect } = chai

describe('get_row_axis_label_suffix', () => {
  it('week split active, row has both year and week — returns suffix', () => {
    expect(get_row_axis_label_suffix(['week'], { year: 2022, week: 5 })).to.equal(
      ' (2022 W5)'
    )
  })

  it('week split active, row missing week — returns empty string', () => {
    expect(get_row_axis_label_suffix(['week'], { year: 2022 })).to.equal('')
  })

  it('week split active, row missing year — returns empty string', () => {
    expect(get_row_axis_label_suffix(['week'], { week: 5 })).to.equal('')
  })

  it('year split active, row has year — returns suffix', () => {
    expect(get_row_axis_label_suffix(['year'], { year: 2022 })).to.equal(' (2022)')
  })

  it('year split active, row missing year — returns empty string', () => {
    expect(get_row_axis_label_suffix(['year'], {})).to.equal('')
  })

  it('both row_axes active, week takes precedence', () => {
    expect(
      get_row_axis_label_suffix(['week', 'year'], { year: 2022, week: 5 })
    ).to.equal(' (2022 W5)')
  })

  it('no row_axes active — returns empty string', () => {
    expect(get_row_axis_label_suffix([], { year: 2022, week: 5 })).to.equal('')
  })
})
