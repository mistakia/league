/* global describe it */
import * as chai from 'chai'

import { resolve_against_roster } from '../scripts/backfill-play-stats-gsisid.mjs'

const expect = chai.expect

// Tyrone Wheatley Sr. played 1995-2004; his son, also T.Wheatley, entered the
// league in 2021. They never appear in the same game, which is the whole point:
// the ambiguity that made the old global name match resolve a 2001 row to the
// son does not exist once the candidate pool is one game's roster.
const wheatley_sr = {
  pid: 'TYRO-WHEA-011999',
  formatted_name: 'tyrone wheatley',
  gsis_player_id: '00-0000998',
  nfl_draft_year: 1995,
  draft_round: 1
}

const wheatley_jr = {
  pid: 'TYRO-WHEA-027188',
  formatted_name: 'tyrone wheatley',
  gsis_player_id: '00-0036966',
  nfl_draft_year: 2021,
  draft_round: 0
}

const build_roster = (players) =>
  new Map(players.map((player) => [player.pid, player]))

describe('SCRIPTS backfill-play-stats-gsisid resolve_against_roster', function () {
  it('resolves to the player actually in the game', () => {
    const result = resolve_against_roster({
      play_stat: { player_name: 'T.Wheatley', nfl_team: 'OAK' },
      roster: build_roster([wheatley_sr]),
      season_year: 2001
    })
    expect(result).to.eql({
      gsis_player_id: '00-0000998',
      pid: 'TYRO-WHEA-011999'
    })
  })

  it('abstains when the only namesake is absent from the game roster', () => {
    // The defect this rewrite exists for. Globally, "T.Wheatley" in 2001 was a
    // UNIQUE match against the son once the father was missing from `player` --
    // and uniqueness was read as confidence.
    const result = resolve_against_roster({
      play_stat: { player_name: 'T.Wheatley', nfl_team: 'OAK' },
      roster: build_roster([
        {
          pid: 'RICH-GANN-010001',
          formatted_name: 'rich gannon',
          gsis_player_id: '00-0000123',
          nfl_draft_year: 1987,
          draft_round: 4
        }
      ]),
      season_year: 2001
    })
    expect(result).to.equal(null)
  })

  it('abstains when a game has no roster evidence at all', () => {
    // 2000-2002 carry no feed-supplied gsis_player_id and predate nfl_snaps, so
    // no roster can be built. Resolving nothing is the correct outcome.
    const result = resolve_against_roster({
      play_stat: { player_name: 'T.Wheatley', nfl_team: 'OAK' },
      roster: undefined,
      season_year: 2001
    })
    expect(result).to.equal(null)
  })

  it('abstains when two contemporaries in the game share the name', () => {
    // Both were in the league in 2001, so era cannot separate them and the feed
    // name alone cannot either. Unique-or-abstain means not counting the stat,
    // which beats attributing it to the wrong player.
    const result = resolve_against_roster({
      play_stat: { player_name: 'M.Williams', nfl_team: 'BUF' },
      roster: build_roster([
        {
          pid: 'MOEX-WILL-010002',
          formatted_name: 'moe williams',
          gsis_player_id: '00-0000201',
          nfl_draft_year: 1996,
          draft_round: 3
        },
        {
          pid: 'MIKE-WILL-010003',
          formatted_name: 'mike williams',
          gsis_player_id: '00-0000202',
          nfl_draft_year: 2001,
          draft_round: 1
        }
      ]),
      season_year: 2001
    })
    expect(result).to.equal(null)
  })

  it('rejects a roster entry that could not have played that season', () => {
    // Belt and braces: a roster built from a corrupt identifier can name a
    // player who had not entered the league, and the era falsifier still holds.
    const result = resolve_against_roster({
      play_stat: { player_name: 'T.Wheatley', nfl_team: 'OAK' },
      roster: build_roster([wheatley_jr]),
      season_year: 2001
    })
    expect(result).to.equal(null)
  })
})
