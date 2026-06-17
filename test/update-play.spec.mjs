/* global describe, it */

import * as chai from 'chai'

import { compute_play_changes } from '#libs-server/update-play.mjs'

const expect = chai.expect

// Minimal play_row stub — compute_play_changes only reads esbid/playId for
// changelog identity and diffs the remaining props.
const make_play_row = (overrides = {}) => ({
  esbid: 1001,
  playId: 5,
  ...overrides
})

describe('compute_play_changes — authority blocklist (protected_fields)', function () {
  it('does NOT overwrite a protected field under overwrite_existing=true (2026-05-24 incident)', function () {
    const { field_updates, changes_count, changelog_entries } =
      compute_play_changes({
        play_row: make_play_row({ catchable_ball: true }),
        update: { catchable_ball: false },
        overwrite_existing: true,
        protected_fields: new Set(['catchable_ball'])
      })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.not.have.property('catchable_ball')
    expect(changelog_entries).to.have.lengthOf(0)
  })

  it('does NOT overwrite a protected field even when listed in overwrite_fields', function () {
    const { field_updates, changes_count } = compute_play_changes({
      play_row: make_play_row({ catchable_ball: true }),
      update: { catchable_ball: false },
      overwrite_existing: false,
      overwrite_fields: ['catchable_ball'],
      protected_fields: new Set(['catchable_ball'])
    })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.not.have.property('catchable_ball')
  })

  it('STILL fills a protected field when the existing value is empty', function () {
    const { field_updates, changes_count } = compute_play_changes({
      play_row: make_play_row({ catchable_ball: null }),
      update: { catchable_ball: true },
      protected_fields: new Set(['catchable_ball'])
    })

    expect(changes_count).to.equal(1)
    expect(field_updates.catchable_ball).to.equal(true)
  })

  it('overwrites a NON-protected field under overwrite_existing even when a blocklist is supplied', function () {
    const { field_updates, changes_count } = compute_play_changes({
      play_row: make_play_row({ pocket_location: 'middle' }),
      update: { pocket_location: 'left' },
      overwrite_existing: true,
      protected_fields: new Set(['catchable_ball'])
    })

    expect(changes_count).to.equal(1)
    expect(field_updates.pocket_location).to.equal('left')
  })

  it('regression guard: without protected_fields, overwrite_existing=true DOES clobber (pre-fix behavior)', function () {
    const { field_updates, changes_count } = compute_play_changes({
      play_row: make_play_row({ catchable_ball: true }),
      update: { catchable_ball: false },
      overwrite_existing: true
    })

    expect(changes_count).to.equal(1)
    expect(field_updates.catchable_ball).to.equal(false)
  })

  it('skips an absent (null) Sportradar flag for a protected field rather than clearing it', function () {
    // map_sportradar_flag returns null for absent knockdown/hurry; a null rhs
    // is skipped, so an existing FTN value survives even without the blocklist.
    const { field_updates, changes_count } = compute_play_changes({
      play_row: make_play_row({ qb_hit: true }),
      update: { qb_hit: null },
      overwrite_existing: true,
      protected_fields: new Set(['catchable_ball'])
    })

    expect(changes_count).to.equal(0)
    expect(field_updates).to.not.have.property('qb_hit')
  })
})
