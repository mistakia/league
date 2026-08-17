/* global describe it */

import * as chai from 'chai'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import {
  build_slate_message,
  DISCORD_MESSAGE_LIMIT
} from '#scripts/announce-draft-slate.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)
chai.should()
const expect = chai.expect

const DRAFT_TIMEZONE = 'America/New_York'
const eastern = (date_string) => dayjs.tz(date_string, DRAFT_TIMEZONE)

// The live 2026 board on the evening of Aug 17: 1.01-1.05 made, so the coming
// day seats 1.06 through 1.10 at the 2-hour slots of an 11:00-21:00 band.
const slots = [
  {
    pick: 6,
    pick_string: '1.6',
    name: 'Mayeday McMillions',
    abbreviation: 'MILL',
    window_open_at: eastern('2026-08-18 11:00')
  },
  {
    pick: 7,
    pick_string: '1.7',
    name: 'Mayeday McMillions',
    abbreviation: 'MILL',
    window_open_at: eastern('2026-08-18 13:00')
  },
  {
    pick: 8,
    pick_string: '1.8',
    name: 'OHamp Lamb Hunters',
    abbreviation: 'TTPD',
    window_open_at: eastern('2026-08-18 15:00')
  }
]

describe('scripts - announce draft slate', function () {
  describe('build_slate_message', function () {
    it('names the day, every slot and the team holding it', () => {
      const message = build_slate_message({
        season_year: 2026,
        slate_date: slots[0].window_open_at,
        slots
      })

      expect(message).to.include('windows for Tuesday, August 18')
      expect(message).to.include('11:00 AM   1.6   Mayeday McMillions (MILL)')
      expect(message).to.include(' 1:00 PM   1.7   Mayeday McMillions (MILL)')
      expect(message).to.include(' 3:00 PM   1.8   OHamp Lamb Hunters (TTPD)')
    })

    it('states when the pick on the clock becomes passable', () => {
      const message = build_slate_message({
        season_year: 2026,
        slate_date: slots[0].window_open_at,
        slots,
        on_clock: {
          name: 'Mayeday McMillions',
          pick_string: '1.6',
          pass_window: eastern('2026-08-18 13:00')
        }
      })

      expect(message).to.include('On the clock: Mayeday McMillions with 1.6')
      expect(message).to.include('selects from 1:00 PM on Tue Aug 18')
    })

    it('omits the deadline when nobody can pass the pick on the clock', () => {
      const message = build_slate_message({
        season_year: 2026,
        slate_date: slots[0].window_open_at,
        slots,
        on_clock: {
          name: 'Mayeday McMillions',
          pick_string: '1.6',
          pass_window: null
        }
      })

      expect(message).to.include('On the clock: Mayeday McMillions with 1.6.')
      expect(message).to.not.include('selects from')
    })

    // A pick whose window opened before this publication is passable NOW, which
    // is a different fact from the coming day's schedule. Printing its past
    // slot time inside the day's list would read as an error in the list.
    it('names already-passable picks apart from the day list', () => {
      const message = build_slate_message({
        season_year: 2026,
        slate_date: slots[0].window_open_at,
        slots,
        already_open: [
          {
            pick: 3,
            pick_string: '1.3',
            name: 'Is This Thing On?',
            abbreviation: 'GM',
            window_open_at: eastern('2026-08-17 11:00')
          }
        ]
      })

      expect(message).to.include('Already passable: 1.3 Is This Thing On?.')
      expect(message).to.not.include('1.3   Is This Thing On? (GM)')
    })

    // The live board on 2026-08-17 carried 21 outstanding picks already
    // passable, which named unbounded is a wall of text and on a fuller board
    // eats the message limit. Discord truncates rather than rejecting, and the
    // tail is the rule statement.
    it('summarizes a long already-passable list instead of naming every pick', () => {
      const many = Array.from({ length: 21 }, (_, index) => ({
        pick: index + 1,
        pick_string: `1.${index + 1}`,
        name: 'Who gives a shit',
        abbreviation: 'w/e',
        window_open_at: eastern('2026-08-17 11:00')
      }))

      const message = build_slate_message({
        season_year: 2026,
        slate_date: slots[0].window_open_at,
        slots,
        already_open: many
      })

      expect(message).to.include('and 15 more.')
      expect(message.length).to.be.at.most(DISCORD_MESSAGE_LIMIT)
    })

    // The day's list is the one section that cannot be dropped, so a band
    // seating many picks can push the optional sections over on its own.
    it('drops the optional sections before letting Discord truncate', () => {
      const wide_slate = Array.from({ length: 30 }, (_, index) => ({
        pick: index + 1,
        pick_string: `${index + 1}.10`,
        name: 'A team with a fairly long name',
        abbreviation: 'LONG',
        window_open_at: eastern('2026-08-18 11:00')
      }))

      const many = Array.from({ length: 6 }, (_, index) => ({
        pick: index + 1,
        pick_string: `1.${index + 1}`,
        name: 'Another team with a fairly long name',
        abbreviation: 'LONG',
        window_open_at: eastern('2026-08-17 11:00')
      }))

      const message = build_slate_message({
        season_year: 2026,
        slate_date: wide_slate[0].window_open_at,
        slots: wide_slate,
        already_open: many,
        on_clock: {
          name: 'Mayeday McMillions',
          pick_string: '1.6',
          pass_window: eastern('2026-08-18 13:00')
        }
      })

      expect(message.length).to.be.at.most(DISCORD_MESSAGE_LIMIT)
      expect(message).to.not.include('Already passable')
      expect(message).to.not.include('On the clock')
      expect(message).to.include(
        '11:00 AM   1.10  A team with a fairly long name'
      )
      expect(message).to.include('OUT OF ORDER')
    })

    it('states the out-of-order rule the windows exist to govern', () => {
      const message = build_slate_message({
        season_year: 2026,
        slate_date: slots[0].window_open_at,
        slots
      })

      expect(message).to.include('OUT OF ORDER')
      expect(message).to.include('on the clock regardless of its window')
    })
  })
})
