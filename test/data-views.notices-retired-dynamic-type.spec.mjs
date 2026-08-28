/* global describe, it */

import * as chai from 'chai'

import get_data_view_notices from '../app/core/data-views/data-view-notices.mjs'
import { resolve_nfl_week_dynamic_value } from '#libs-shared/nfl-week-dynamic-values.mjs'

const expect = chai.expect

// A dynamic_type nobody declares. Standing in for the next type anyone retires:
// removals have shipped with no migration rule before (next_n_nfl_years, gone in
// df8d12ea9 on 2026-04-22), so a persisted view naming a type the resolver no
// longer knows is a reachable state rather than a hypothetical one.
const RETIRED_TYPE = 'next_n_nfl_years'

describe('DATA VIEWS notices over a retired dynamic type', function () {
  // The control. If this stops throwing, every assertion below passes for the
  // wrong reason -- the notice path would be handling a value that resolves
  // fine rather than one that blows up.
  it('the shared resolver still THROWS on the retired type', function () {
    expect(() =>
      resolve_nfl_week_dynamic_value({ dynamic_type: RETIRED_TYPE })
    ).to.throw(/unknown dynamic_type/)
  })

  // The notice path runs inside a createSelector on the data-views render path,
  // so an escaping throw is a page crash rather than a missing preview. The
  // server-side throw is deliberately untouched -- there the unbounded row axis
  // it prevents is a real multi-million-row fan-out, and a notice has no row
  // axis for that rationale to apply to.
  it('does not throw when a FILTER names the retired type', function () {
    const where = [
      {
        params: { nfl_week_id: [{ dynamic_type: RETIRED_TYPE, value: 2 }] }
      }
    ]
    const columns = [{ params: { year: [2026] } }]

    expect(() => get_data_view_notices({ where, columns })).to.not.throw()
    expect(get_data_view_notices({ where, columns })).to.be.an('array')
  })

  it('does not throw when a COLUMN names the retired type', function () {
    const where = [{ params: { nfl_week_id: ['2026_REG_WEEK_1'] } }]
    const columns = [
      { params: { nfl_week_id: [{ dynamic_type: RETIRED_TYPE, value: 2 }] } }
    ]

    expect(() => get_data_view_notices({ where, columns })).to.not.throw()
  })

  // The catch must not swallow a type that resolves. An unresolvable value and
  // a working one land on different paths, and conflating them would make the
  // fix indistinguishable from deleting the notice feature.
  it('still previews a declared dynamic type', function () {
    const where = [
      { params: { nfl_week_id: [{ dynamic_type: 'current_nfl_week' }] } }
    ]
    const columns = [{ params: { year: [2026] } }]

    const notices = get_data_view_notices({ where, columns })
    expect(notices).to.be.an('array')
    expect(notices.length).to.be.at.least(1)
    // Discriminating, not merely non-empty: the preview carries the resolved
    // season rather than an empty scope fragment.
    const [resolved] = resolve_nfl_week_dynamic_value({
      dynamic_type: 'current_nfl_week'
    })
    const year = resolved.slice(0, 4)
    expect(notices.some((n) => n.message.includes(year))).to.equal(true)
  })
})
