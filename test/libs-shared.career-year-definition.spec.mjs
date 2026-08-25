/* global describe it */

import * as chai from 'chai'

import { career_year_from_distinct_prior_reg_seasons } from '#libs-shared/career-year-definition.mjs'

const { expect } = chai

// The single declared career-year definition, pinned here so a change to the
// rule (see libs-shared/career-year-definition.mjs) that the materializer
// (generate-player-career-game-counts) and the data-view projection share is a
// loud spec break rather than silently reshaping every career-year filter.
describe('career_year definition', () => {
  it('is a function of season_year alone: distinct prior REG seasons + 1', () => {
    expect(career_year_from_distinct_prior_reg_seasons(0)).to.equal(1)
    expect(career_year_from_distinct_prior_reg_seasons(1)).to.equal(2)
    expect(career_year_from_distinct_prior_reg_seasons(5)).to.equal(6)
  })
})
