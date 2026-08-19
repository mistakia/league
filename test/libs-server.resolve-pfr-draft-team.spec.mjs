/* global describe it */

import * as chai from 'chai'

import { resolve_pfr_draft_team } from '#libs-server/resolve-pfr-draft-team.mjs'

const expect = chai.expect

describe('resolve_pfr_draft_team', () => {
  it('maps Oilers-era HOU (1990-96) to TEN', () => {
    expect(resolve_pfr_draft_team('HOU', 1990)).to.equal('TEN')
    expect(resolve_pfr_draft_team('HOU', 1996)).to.equal('TEN')
  })

  it('keeps Texans-era HOU (2002+) as HOU', () => {
    expect(resolve_pfr_draft_team('HOU', 2002)).to.equal('HOU')
    expect(resolve_pfr_draft_team('HOU', 2026)).to.equal('HOU')
  })

  it('leaves every other team and year untouched', () => {
    expect(resolve_pfr_draft_team('TEN', 1995)).to.equal('TEN')
    expect(resolve_pfr_draft_team('OTI', 1997)).to.equal('OTI')
    expect(resolve_pfr_draft_team('HOU', 1997)).to.equal('HOU')
    expect(resolve_pfr_draft_team(null, 1995)).to.equal(null)
    expect(resolve_pfr_draft_team(undefined, 1995)).to.equal(undefined)
  })
})
