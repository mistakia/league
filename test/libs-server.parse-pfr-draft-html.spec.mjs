/* global describe it */

import * as chai from 'chai'

import { parse_draft_html } from '#libs-server/parse-pfr-draft-html.mjs'

const expect = chai.expect

// Mirrors the real PFR draft page structure: a #drafts table whose tbody
// carries one tr per pick, plus repeated .thead separator rows between rounds.
const build_row = ({
  round = '1',
  pick = '1',
  team = 'CLE',
  player = 'Test Player',
  pfr_id = 'TestPl00',
  pos = 'QB',
  all_pros_first_team = '0',
  pro_bowls = '0',
  years_as_primary_starter = '0',
  career_av = '0',
  draft_av = '0',
  college = 'Test University'
} = {}) => `
  <tr>
    <th scope="row" data-stat="draft_round">${round}</th>
    <td data-stat="draft_pick">${pick}</td>
    <td data-stat="team"><a href="/teams/${team.toLowerCase()}/1995.htm">${team}</a></td>
    <td data-stat="player"><a href="/players/T/${pfr_id}.htm">${player}</a></td>
    <td data-stat="pos">${pos}</td>
    <td data-stat="all_pros_first_team">${all_pros_first_team}</td>
    <td data-stat="pro_bowls">${pro_bowls}</td>
    <td data-stat="years_as_primary_starter">${years_as_primary_starter}</td>
    <td data-stat="career_av">${career_av}</td>
    <td data-stat="draft_av">${draft_av}</td>
    <td data-stat="college_id"><a href="/schools/test/">${college}</a></td>
  </tr>
`

const build_page = (rows) => `
  <html>
    <body>
      <table id="drafts">
        <thead>
          <tr><th data-stat="draft_round">Rnd</th></tr>
        </thead>
        <tbody>
          ${rows.join('\n')}
        </tbody>
      </table>
    </body>
  </html>
`

describe('parse_draft_html', () => {
  it('extracts every field of a row', () => {
    const html = build_page([
      build_row({
        round: '1',
        pick: '3',
        team: 'KAN',
        player: 'Patrick Mahomes',
        pfr_id: 'MahoPa00',
        pos: 'QB',
        all_pros_first_team: '2',
        pro_bowls: '6',
        years_as_primary_starter: '8',
        career_av: '109',
        draft_av: '109',
        college: 'Texas Tech'
      })
    ])

    const draft_players = parse_draft_html(html, 2017)

    expect(draft_players).to.have.lengthOf(1)
    expect(draft_players[0]).to.deep.equal({
      round: 1,
      overall_pick: 3,
      team: 'KC',
      player_name: 'Patrick Mahomes',
      pfr_id: 'MahoPa00',
      draft_position: 'QB',
      all_pro_first_team_selections: 2,
      pro_bowl_selections: 6,
      years_as_primary_starter: 8,
      pfr_weighted_career_approximate_value: 109,
      pfr_weighted_career_approximate_value_drafted_team: 109,
      college_team: 'Texas Tech'
    })
  })

  it('resolves legacy team abbreviations through fixTeam', () => {
    const html = build_page([
      build_row({ pick: '1', team: 'RAI', pfr_id: 'RaidPl00' }),
      build_row({ pick: '2', team: 'PHO', pfr_id: 'CardPl00' })
    ])

    const draft_players = parse_draft_html(html, 1994)

    expect(draft_players.map((p) => p.team)).to.deep.equal(['LV', 'ARI'])
  })

  it('resolves Oilers-era HOU to TEN and Texans-era HOU to HOU', () => {
    const oilers_page = build_page([build_row({ team: 'HOU' })])
    const texans_page = build_page([build_row({ team: 'HOU' })])

    expect(parse_draft_html(oilers_page, 1995)[0].team).to.equal('TEN')
    expect(parse_draft_html(texans_page, 2003)[0].team).to.equal('HOU')
  })

  it('drops a row without a round or a pick, and excludes .thead rows', () => {
    const html = build_page([
      build_row({ round: '1', pick: '1', pfr_id: 'KeptOn00' }),
      // Round-separator row PFR emits between rounds. It carries numeric
      // round/pick cells so only the .thead selector can exclude it — a
      // non-numeric separator would be dropped by the round/pick guard
      // instead, and the assertion would not distinguish the two.
      build_row({ round: '1', pick: '32', pfr_id: 'Separa00' }).replace(
        '<tr>',
        '<tr class="thead">'
      ),
      // a row missing the round cell entirely
      `<tr><td data-stat="draft_pick">2</td><td data-stat="player"><a href="/players/N/NoRound00.htm">No Round</a></td></tr>`,
      // a row missing the pick cell entirely
      `<tr><th data-stat="draft_round">1</th><td data-stat="player"><a href="/players/N/NoPick00.htm">No Pick</a></td></tr>`,
      // a row whose round and pick are non-numeric
      build_row({ round: 'Rnd', pick: 'Pick', pfr_id: 'NonNum00' }),
      build_row({ round: '2', pick: '33', pfr_id: 'KeptTw00' })
    ])

    const draft_players = parse_draft_html(html, 2020)

    expect(draft_players.map((p) => p.pfr_id)).to.deep.equal([
      'KeptOn00',
      'KeptTw00'
    ])
  })

  it('falls back to plain text and nulls when a row carries no links', () => {
    const html = build_page([
      `<tr>
        <th data-stat="draft_round">7</th>
        <td data-stat="draft_pick">250</td>
        <td data-stat="team"></td>
        <td data-stat="player">Unlinked Player</td>
        <td data-stat="pos"></td>
        <td data-stat="college_id"></td>
      </tr>`
    ])

    const draft_players = parse_draft_html(html, 2020)

    expect(draft_players).to.have.lengthOf(1)
    expect(draft_players[0]).to.deep.equal({
      round: 7,
      overall_pick: 250,
      team: null,
      player_name: 'Unlinked Player',
      pfr_id: null,
      draft_position: null,
      all_pro_first_team_selections: 0,
      pro_bowl_selections: 0,
      years_as_primary_starter: 0,
      pfr_weighted_career_approximate_value: 0,
      pfr_weighted_career_approximate_value_drafted_team: 0,
      college_team: null
    })
  })

  it('returns an empty array when the page carries no draft table', () => {
    expect(parse_draft_html('<html><body></body></html>', 2020)).to.deep.equal(
      []
    )
  })
})
