/* global describe it */

import * as chai from 'chai'

import calculate_live_projection from '#libs-shared/calculate-live-projection.mjs'

chai.should()
const { expect } = chai

describe('LIBS-SHARED calculate_live_projection', function () {
  describe('basic calculations', function () {
    it('returns full projection when game has not started', () => {
      const result = calculate_live_projection({
        accumulated_points: 0,
        full_game_projection: 15,
        game_progress: 0
      })

      expect(result.projected_total).to.equal(15)
      expect(result.remaining_projection).to.equal(15)
      expect(result.accumulated_points).to.equal(0)
      expect(result.game_progress).to.equal(0)
    })

    it('returns accumulated points when game is complete', () => {
      const result = calculate_live_projection({
        accumulated_points: 18.5,
        full_game_projection: 15,
        game_progress: 1
      })

      expect(result.projected_total).to.equal(18.5)
      expect(result.remaining_projection).to.equal(0)
      expect(result.accumulated_points).to.equal(18.5)
      expect(result.game_progress).to.equal(1)
    })

    it('calculates mid-game projection correctly', () => {
      const result = calculate_live_projection({
        accumulated_points: 8,
        full_game_projection: 16,
        game_progress: 0.5
      })

      // Accumulated (8) + remaining (16 * 0.5 = 8) = 16
      expect(result.projected_total).to.equal(16)
      expect(result.remaining_projection).to.equal(8)
      expect(result.accumulated_points).to.equal(8)
      expect(result.game_progress).to.equal(0.5)
    })

    it('handles player outperforming projection', () => {
      const result = calculate_live_projection({
        accumulated_points: 20,
        full_game_projection: 15,
        game_progress: 0.5
      })

      // Accumulated (20) + remaining (15 * 0.5 = 7.5) = 27.5
      expect(result.projected_total).to.equal(27.5)
      expect(result.remaining_projection).to.equal(7.5)
    })

    it('handles player underperforming projection', () => {
      const result = calculate_live_projection({
        accumulated_points: 2,
        full_game_projection: 20,
        game_progress: 0.75
      })

      // Accumulated (2) + remaining (20 * 0.25 = 5) = 7
      expect(result.projected_total).to.equal(7)
      expect(result.remaining_projection).to.equal(5)
    })
  })

  describe('edge cases', function () {
    it('handles zero projection', () => {
      const result = calculate_live_projection({
        accumulated_points: 5,
        full_game_projection: 0,
        game_progress: 0.5
      })

      expect(result.projected_total).to.equal(5)
      expect(result.remaining_projection).to.equal(0)
    })

    it('handles missing accumulated_points', () => {
      const result = calculate_live_projection({
        full_game_projection: 10,
        game_progress: 0.5
      })

      expect(result.projected_total).to.equal(5)
      expect(result.accumulated_points).to.equal(0)
    })

    it('handles missing full_game_projection', () => {
      const result = calculate_live_projection({
        accumulated_points: 8,
        game_progress: 0.5
      })

      expect(result.projected_total).to.equal(8)
      expect(result.remaining_projection).to.equal(0)
    })

    it('handles missing game_progress', () => {
      const result = calculate_live_projection({
        accumulated_points: 5,
        full_game_projection: 10
      })

      expect(result.projected_total).to.equal(15)
      expect(result.game_progress).to.equal(0)
    })

    it('clamps game_progress to 0-1 range', () => {
      const result_negative = calculate_live_projection({
        accumulated_points: 5,
        full_game_projection: 10,
        game_progress: -0.5
      })
      expect(result_negative.game_progress).to.equal(0)

      const result_over = calculate_live_projection({
        accumulated_points: 5,
        full_game_projection: 10,
        game_progress: 1.5
      })
      expect(result_over.game_progress).to.equal(1)
    })

    it('handles NaN inputs gracefully', () => {
      const result = calculate_live_projection({
        accumulated_points: NaN,
        full_game_projection: NaN,
        game_progress: NaN
      })

      expect(result.projected_total).to.equal(0)
      expect(result.remaining_projection).to.equal(0)
      expect(result.accumulated_points).to.equal(0)
      expect(result.game_progress).to.equal(0)
    })
  })

  describe('rounding', function () {
    it('rounds to 2 decimal places', () => {
      const result = calculate_live_projection({
        accumulated_points: 10.333333,
        full_game_projection: 15.666666,
        game_progress: 0.333333
      })

      expect(result.projected_total).to.equal(20.78)
      expect(result.remaining_projection).to.equal(10.44)
      expect(result.accumulated_points).to.equal(10.33)
    })
  })
})
