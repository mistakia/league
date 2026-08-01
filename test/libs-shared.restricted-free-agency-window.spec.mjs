/* global describe it */
import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import {
  get_restricted_free_agency_window_config,
  get_restricted_free_agency_window_start,
  get_restricted_free_agency_window_index,
  get_restricted_free_agency_processing_time,
  get_restricted_free_agency_nominating_team_index
} from '#libs-shared'

dayjs.extend(utc)
dayjs.extend(timezone)

const expect = chai.expect
const league_timezone = 'America/New_York'

// The anchor column is timestamptz, so it arrives as a Date; window index
// probes are unix seconds.
const et_date = (value) => dayjs.tz(value, league_timezone).toDate()
const et_unix = (value) => dayjs.tz(value, league_timezone).unix()
const format_et = (timestamp) =>
  dayjs.unix(timestamp).tz(league_timezone).format('YYYY-MM-DD HH:mm')

// Reproduces the pre-2026-08 production configuration: one nomination a day
// announced at 9 PM ET, bids processed at 6 PM ET the following day.
const legacy_league = {
  restricted_free_agency_first_window_at: et_date('2026-08-01 21:00'),
  restricted_free_agency_window_hours: 24,
  restricted_free_agency_processing_lead_hours: 3
}

// League 1's 2026 configuration: two nominations a day at 5 PM and 5 AM ET,
// bids processed one hour before the next announcement.
const twelve_hour_league = {
  restricted_free_agency_first_window_at: et_date('2026-08-01 17:00'),
  restricted_free_agency_window_hours: 12,
  restricted_free_agency_processing_lead_hours: 1
}

describe('LIBS-SHARED restricted free agency windows', function () {
  describe('config', function () {
    it('derives the bid window from the cadence and the lead', () => {
      expect(
        get_restricted_free_agency_window_config({ league: legacy_league })
      ).to.deep.equal({
        window_hours: 24,
        processing_lead_hours: 3,
        bid_window_hours: 21,
        windows_per_day: 1
      })

      expect(
        get_restricted_free_agency_window_config({ league: twelve_hour_league })
      ).to.deep.equal({
        window_hours: 12,
        processing_lead_hours: 1,
        bid_window_hours: 11,
        windows_per_day: 2
      })
    })

    it('falls back to the 24h / 3h defaults', () => {
      const config = get_restricted_free_agency_window_config({
        league: {
          restricted_free_agency_first_window_at: et_date('2026-08-01 21:00')
        }
      })

      expect(config.window_hours).to.equal(24)
      expect(config.processing_lead_hours).to.equal(3)
    })
  })

  describe('boundaries', function () {
    it('reproduces the legacy 9 PM announce / 6 PM process schedule', () => {
      for (let window_index = 0; window_index < 5; window_index++) {
        const announce_at = get_restricted_free_agency_window_start({
          league: legacy_league,
          window_index
        })
        const process_at = get_restricted_free_agency_processing_time({
          league: legacy_league,
          window_index
        })

        expect(format_et(announce_at)).to.equal(
          dayjs
            .unix(et_unix('2026-08-01 21:00'))
            .tz(league_timezone)
            .add(window_index, 'day')
            .format('YYYY-MM-DD HH:mm')
        )
        // 6 PM ET the following day
        expect(format_et(process_at).slice(-5)).to.equal('18:00')
        expect(process_at - announce_at).to.equal(21 * 3600)
      }
    })

    it('announces twice a day on a 12-hour cadence', () => {
      const announcements = [0, 1, 2, 3].map((window_index) =>
        format_et(
          get_restricted_free_agency_window_start({
            league: twelve_hour_league,
            window_index
          })
        )
      )

      expect(announcements).to.deep.equal([
        '2026-08-01 17:00',
        '2026-08-02 05:00',
        '2026-08-02 17:00',
        '2026-08-03 05:00'
      ])
    })

    it('processes one hour before the next announcement', () => {
      for (let window_index = 0; window_index < 4; window_index++) {
        const process_at = get_restricted_free_agency_processing_time({
          league: twelve_hour_league,
          window_index
        })
        const next_announce_at = get_restricted_free_agency_window_start({
          league: twelve_hour_league,
          window_index: window_index + 1
        })

        expect(next_announce_at - process_at).to.equal(3600)
        expect(process_at).to.be.below(next_announce_at)
      }
    })

    it('keeps the wall-clock hour across a DST transition', () => {
      // 2026 fall-back is Nov 1
      const november_league = {
        restricted_free_agency_first_window_at: et_date('2026-10-30 17:00'),
        restricted_free_agency_window_hours: 12,
        restricted_free_agency_processing_lead_hours: 1
      }

      const hours = [0, 2, 4, 6, 8].map((window_index) =>
        format_et(
          get_restricted_free_agency_window_start({
            league: november_league,
            window_index
          })
        ).slice(-5)
      )

      expect(hours).to.deep.equal(['17:00', '17:00', '17:00', '17:00', '17:00'])
    })
  })

  describe('window index', function () {
    it('inverts the boundary calculation', () => {
      for (let window_index = 0; window_index < 12; window_index++) {
        const announce_at = get_restricted_free_agency_window_start({
          league: twelve_hour_league,
          window_index
        })

        expect(
          get_restricted_free_agency_window_index({
            league: twelve_hour_league,
            timestamp: announce_at
          })
        ).to.equal(window_index)

        // still inside the same window an hour later
        expect(
          get_restricted_free_agency_window_index({
            league: twelve_hour_league,
            timestamp: announce_at + 3600
          })
        ).to.equal(window_index)

        // the instant before it opens belongs to the previous window
        expect(
          get_restricted_free_agency_window_index({
            league: twelve_hour_league,
            timestamp: announce_at - 1
          })
        ).to.equal(window_index - 1)
      }
    })

    it('is negative before the first window', () => {
      expect(
        get_restricted_free_agency_window_index({
          league: twelve_hour_league,
          timestamp: et_unix('2026-08-01 12:00')
        })
      ).to.equal(-1)
    })
  })

  describe('nominating team rotation', function () {
    const num_teams = 10

    it('repeats descending draft order every round', () => {
      const order = [...Array(20)].map((ignore, window_index) =>
        get_restricted_free_agency_nominating_team_index({
          window_index,
          num_teams
        })
      )

      expect(order).to.deep.equal([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
      ])
    })

    it('holds every team to a single slot-of-day', () => {
      // With the team count a multiple of the windows per day, a team's turns
      // all land on the same parity, so half the league nominates overnight
      // every time. The published schedule states each team's slot-of-day on
      // this basis.
      const slots_by_team = {}

      for (let window_index = 0; window_index < 20; window_index++) {
        const team_index = get_restricted_free_agency_nominating_team_index({
          window_index,
          num_teams
        })
        slots_by_team[team_index] = slots_by_team[team_index] || []
        slots_by_team[team_index].push(window_index % 2)
      }

      expect(Object.keys(slots_by_team).length).to.equal(num_teams)

      for (const team_index of Object.keys(slots_by_team)) {
        expect(slots_by_team[team_index]).to.deep.equal(
          [Number(team_index) % 2, Number(team_index) % 2],
          `team ${team_index} should hold one slot-of-day for both turns`
        )
      }
    })

    it('gives every team exactly one window per round', () => {
      const first_round = [...Array(num_teams)].map((ignore, window_index) =>
        get_restricted_free_agency_nominating_team_index({
          window_index,
          num_teams
        })
      )

      expect([...new Set(first_round)].length).to.equal(num_teams)
    })
  })
})
