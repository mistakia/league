/* global describe it */
import * as chai from 'chai'

import {
  parse_listing_page,
  resolve_unique_candidate
} from '../scripts/import-nfl-player-ids.mjs'

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
