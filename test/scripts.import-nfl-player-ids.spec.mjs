/* global describe it */
import * as chai from 'chai'

import {
  parse_listing_page,
  resolve_unique_candidate
} from '../scripts/import-nfl-player-ids.mjs'
import {
  last_name_of,
  is_accepted_name_difference,
  names_can_be_same_person
} from '#libs-server/nfl-player-id-adjudication.mjs'

const expect = chai.expect

// Two things in this importer can fail silently, and neither is arithmetic.
//
// The PARSER reads a vendor HTML page. When NFL.com changes its markup the
// selector stops matching, `parse_listing_page` returns an empty array, and a
// run that resolves nothing looks exactly like a run with nothing to do. The
// script guards that at the top level by throwing on an empty listing, but the
// per-row extraction has no such oracle -- a page that still yields ids while
// losing the position and team would silently disable both narrowing stages and
// push every ambiguous name into an abstain. So the parser is pinned against
// real captured markup rather than a hand-built fragment.
//
// The RESOLVER is where a wrong answer costs data. An era-unscoped name attach
// is the defect class this cluster exists to close, and the guarantee that
// matters is the negative one: two candidates that survive team and position
// narrowing must ABSTAIN, never resolve to the first match. That is the exact
// shape that put one person's identifiers on their namesake's row.

// Captured from fantasy.nfl.com/research/players on 2026-08-05. Trimmed to the
// player-name cell of each row -- the stat cells are irrelevant here and run to
// several KB apiece.
const LISTING_HTML = `
<table><tbody>
<tr class="player-2557997 odd first">
  <td class="playerNameAndInfo first"><div class="c c-sf"><b></b>
    <a onclick="return false" href="/players/card?leagueId=0&playerId=2557997"
       class="playerCard playerName playerNameFull playerNameId-2557997 what-playerCard">Christian McCaffrey</a>
    <em>RB - SF</em>
  </div></td>
</tr>
<tr class="player-79860 even">
  <td class="playerNameAndInfo first"><div class="c c-lar"><b></b>
    <a onclick="return false" href="/players/card?leagueId=0&playerId=79860"
       class="playerCard playerName playerNameFull playerNameId-79860 what-playerCard">Matthew Stafford</a>
    <em>QB - LAR</em>
  </div></td>
</tr>
<tr class="player-2560955 odd">
  <td class="playerNameAndInfo first"><div class="c"><b></b>
    <a onclick="return false" href="/players/card?leagueId=0&playerId=2560955"
       class="playerCard playerName playerNameFull playerNameId-2560955 what-playerCard">Josh Allen</a>
    <em>QB</em>
  </div></td>
</tr>
</tbody></table>
`

describe('scripts - import nfl player ids', function () {
  describe('parse_listing_page', function () {
    it('extracts the shield id, name, position and team from each row', () => {
      const players = parse_listing_page(LISTING_HTML)

      expect(players.length).to.equal(3)
      expect(players[0]).to.deep.equal({
        nfl_player_id: 2557997,
        name: 'Christian McCaffrey',
        formatted_name: 'christian mccaffrey',
        position: 'RB',
        team: 'SF'
      })
    })

    it('reads a small legacy id, which is a real nfl.com id and not corruption', () => {
      // 79860 is Matthew Stafford, served live by nfl.com. The 25xxxxx block is
      // where ids are dense, not the bounds of the id space -- a parser or a
      // CHECK constraint that rejects outside it drops genuine values.
      const stafford = parse_listing_page(LISTING_HTML).find(
        (player) => player.formatted_name === 'matthew stafford'
      )

      expect(stafford.nfl_player_id).to.equal(79860)
    })

    it('leaves team null for a row carrying no team', () => {
      const allen = parse_listing_page(LISTING_HTML).find(
        (player) => player.formatted_name === 'josh allen'
      )

      expect(allen.position).to.equal('QB')
      expect(allen.team).to.equal(null)
    })

    it('returns an empty array rather than throwing on unrecognised markup', () => {
      expect(
        parse_listing_page('<table><tbody></tbody></table>')
      ).to.deep.equal([])
    })
  })

  describe('resolve_unique_candidate', function () {
    const listed_player = {
      nfl_player_id: 2560955,
      formatted_name: 'josh allen',
      position: 'QB',
      team: 'BUF'
    }

    it('resolves a lone candidate on name', () => {
      const only = { pid: 'JOSH-ALLE-000001', current_nfl_team: 'BUF' }
      const { player_row, basis } = resolve_unique_candidate({
        candidates: [only],
        listed_player
      })

      expect(player_row).to.equal(only)
      expect(basis).to.equal('name')
    })

    it('narrows two same-name candidates by team', () => {
      const quarterback = { pid: 'JOSH-ALLE-000001', current_nfl_team: 'BUF' }
      const edge_rusher = { pid: 'JOSH-ALLE-000002', current_nfl_team: 'JAX' }

      const { player_row, basis } = resolve_unique_candidate({
        candidates: [edge_rusher, quarterback],
        listed_player
      })

      expect(player_row).to.equal(quarterback)
      expect(basis).to.equal('name_and_team')
    })

    it('narrows by position when team cannot discriminate', () => {
      const quarterback = {
        pid: 'JOSH-ALLE-000001',
        current_nfl_team: 'BUF',
        primary_position: 'QB'
      }
      const linebacker = {
        pid: 'JOSH-ALLE-000002',
        current_nfl_team: 'BUF',
        primary_position: 'LB'
      }

      const { player_row, basis } = resolve_unique_candidate({
        candidates: [linebacker, quarterback],
        listed_player
      })

      expect(player_row).to.equal(quarterback)
      expect(basis).to.equal('name_and_position')
    })

    // The load-bearing assertion in this file. Resolving either row here is the
    // coin flip that produced the existing misattribution, so the only correct
    // answer is neither.
    it('ABSTAINS when two candidates survive both narrowing stages', () => {
      const first = {
        pid: 'JORD-MURR-000108',
        current_nfl_team: 'BUF',
        primary_position: 'QB'
      }
      const second = {
        pid: 'JORD-MURR-006621',
        current_nfl_team: 'BUF',
        primary_position: 'QB'
      }

      const { player_row, basis } = resolve_unique_candidate({
        candidates: [first, second],
        listed_player
      })

      expect(player_row).to.equal(null)
      expect(basis).to.equal('ambiguous')
    })

    it('abstains rather than guessing when the listed row carries no team or position', () => {
      const first = { pid: 'JORD-MURR-000108' }
      const second = { pid: 'JORD-MURR-006621' }

      const { player_row } = resolve_unique_candidate({
        candidates: [first, second],
        listed_player: {
          formatted_name: 'jordan murray',
          position: null,
          team: null
        }
      })

      expect(player_row).to.equal(null)
    })
  })
})

describe('scripts - audit nfl player id attribution', function () {
  describe('last_name_of', function () {
    it('drops a generational suffix', () => {
      expect(last_name_of('Ricky White III')).to.equal('white')
      expect(last_name_of('Michael Pittman Jr.')).to.equal('pittman')
    })

    it('matches a display name against a legal name on the surname alone', () => {
      // nfl.com serves display names and we store legal ones, so these pairs
      // are the SAME person and must not be reported as misattribution.
      expect(last_name_of('Kenny Gainwell')).to.equal(
        last_name_of('kenneth gainwell')
      )
      expect(last_name_of('JJ McCarthy')).to.equal(
        last_name_of('jonathan mccarthy')
      )
      expect(last_name_of('Tank Dell')).to.equal(last_name_of('nathaniel dell'))
    })

    it('separates two genuinely different people', () => {
      expect(last_name_of('Jordan Love')).to.not.equal(
        last_name_of('jeff okudah')
      )
    })
  })

  describe('is_accepted_name_difference', function () {
    // A legal name change is the one disagreement the surname test cannot
    // absorb, and treating it as a defect would destroy a correct value.
    const robbie = {
      pid: 'ROBB-ANDE-017101',
      nfl_player_id: 2556462,
      card_name: 'Robbie Chosen'
    }

    it('accepts the recorded legal name change', () => {
      expect(is_accepted_name_difference(robbie)).to.equal(true)
    })

    it('does NOT accept the same pid once its id has moved', () => {
      // The adjudication is pinned to the value it was granted for, so a row
      // that later acquires a different id is re-reported rather than
      // inheriting the exception.
      expect(
        is_accepted_name_difference({ ...robbie, nfl_player_id: 2564007 })
      ).to.equal(false)
    })

    it('does NOT accept a different pid holding the same id', () => {
      expect(
        is_accepted_name_difference({ ...robbie, pid: 'JEFF-OKUD-007629' })
      ).to.equal(false)
    })

    it('does NOT accept an unrelated disagreement', () => {
      expect(
        is_accepted_name_difference({
          pid: 'JEFF-OKUD-007629',
          nfl_player_id: 2564007,
          card_name: 'Jordan Love'
        })
      ).to.equal(false)
    })
  })
})

describe('libs-server - nfl player id adjudication', function () {
  // This predicate decides whether the scheduled ingest raises a signal, so a
  // false positive is a recurring alert on correct data and a false negative
  // means the defect this task repaired can return unnoticed.
  it('accepts a display name against a legal name', () => {
    expect(
      names_can_be_same_person({
        pid: 'KENN-GAIN-005953',
        nfl_player_id: 2566397,
        our_name: 'kenneth gainwell',
        card_name: 'Kenny Gainwell'
      })
    ).to.equal(true)
  })

  it('accepts the recorded legal name change', () => {
    expect(
      names_can_be_same_person({
        pid: 'ROBB-ANDE-017101',
        nfl_player_id: 2556462,
        our_name: 'robbie anderson',
        card_name: 'Robbie Chosen'
      })
    ).to.equal(true)
  })

  it('REJECTS two different people', () => {
    expect(
      names_can_be_same_person({
        pid: 'JEFF-OKUD-007629',
        nfl_player_id: 2564007,
        our_name: 'jeff okudah',
        card_name: 'Jordan Love'
      })
    ).to.equal(false)
  })
})
