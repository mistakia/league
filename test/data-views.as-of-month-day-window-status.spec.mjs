/* global describe it */

import * as chai from 'chai'

import {
  as_of_window_status,
  as_of_years_in_scope
} from '#app/core/data-views-fields/month-day.mjs'

const expect = chai.expect

/*
  The calendar rule behind the control's "this day has not arrived" note.

  Every case below is anchored on the measurement in the task that asked for it:
  on 2026-08-16, anchor 09-10 held 2,012 observations across 509 players (its
  window opened 2026-08-11) while anchor 12-31 held zero, because its window
  does not open until 2026-12-01. Both columns rendered blank-looking to a
  reader and nothing distinguished them.

  A date is constructed with local-time components on purpose: the control
  compares against the reader's own calendar day, and a UTC parse of
  '2026-08-16' would land on the previous day west of Greenwich.
*/
const on = (year, month, day) => new Date(year, month - 1, day)

describe('DATA VIEWS as_of_month_day window status', function () {
  it('reports a window that has not opened, with the date it opens', function () {
    const result = as_of_window_status({
      month_day: '12-31',
      years: [2026],
      today: on(2026, 8, 16)
    })

    expect(result.status).to.equal('not_open')
    expect(result.window_opens_at).to.deep.equal(on(2026, 12, 1))
  })

  it('reports a window that has opened but whose day has not arrived', function () {
    // 09-10 on 2026-08-16: the window opened five days ago, which is why 473 of
    // 500 rows had a value and 27 did not.
    const result = as_of_window_status({
      month_day: '09-10',
      years: [2026],
      today: on(2026, 8, 16)
    })

    expect(result.status).to.equal('partial')
    expect(result.window_opens_at).to.equal(null)
  })

  it('reports open once the day itself has passed', function () {
    const result = as_of_window_status({
      month_day: '09-10',
      years: [2026],
      today: on(2026, 9, 11)
    })

    expect(result.status).to.equal('open')
  })

  it('reports open on the anchor day itself', function () {
    const result = as_of_window_status({
      month_day: '09-10',
      years: [2026],
      today: on(2026, 9, 10)
    })

    expect(result.status).to.equal('open')
  })

  it('reports the MOST open year in scope, since one populated year is enough', function () {
    // A view spanning 2024 and 2026 is not empty just because 2026 is ahead.
    const result = as_of_window_status({
      month_day: '12-31',
      years: [2024, 2026],
      today: on(2026, 8, 16)
    })

    expect(result.status).to.equal('open')
  })

  it('names the SOONEST opening when no year in scope has opened', function () {
    const result = as_of_window_status({
      month_day: '12-31',
      years: [2027, 2026],
      today: on(2026, 8, 16)
    })

    expect(result.status).to.equal('not_open')
    expect(result.window_opens_at).to.deep.equal(on(2026, 12, 1))
  })

  it('clamps 02-29 back to February in a non-leap year, as the emitter does', function () {
    // make_date raises rather than rolling forward, so the server resolves this
    // to Feb 28. A bare JS Date rolls to Mar 1, which would put the window a day
    // late and promise a date the query never uses.
    const result = as_of_window_status({
      month_day: '02-29',
      years: [2027],
      today: on(2027, 1, 1)
    })

    expect(result.status).to.equal('not_open')
    expect(result.window_opens_at).to.deep.equal(on(2027, 1, 29))
  })

  it('returns nothing when no day is set, so an unset param warns about nothing', function () {
    expect(as_of_window_status({ month_day: null, years: [2026] })).to.equal(
      null
    )
  })

  it('returns nothing when no year is in scope', function () {
    expect(as_of_window_status({ month_day: '12-31', years: [] })).to.equal(
      null
    )
  })
})

describe('DATA VIEWS as_of_month_day years in scope', function () {
  it('falls back to the default year when the column pins none', function () {
    expect(
      as_of_years_in_scope({ column_params: {}, default_year: 2026 })
    ).to.deep.equal([2026])
  })

  it('reads the year the column pins', function () {
    expect(
      as_of_years_in_scope({
        column_params: { year: [2024] },
        default_year: 2026
      })
    ).to.deep.equal([2024])
  })

  it('applies year_offset, which is what moves the anchor into another year', function () {
    // Without this a column offset back a year would be warned about as though
    // its day were still ahead.
    expect(
      as_of_years_in_scope({
        column_params: { year: [2026], year_offset: [-1] },
        default_year: 2026
      })
    ).to.deep.equal([2025])
  })
})
