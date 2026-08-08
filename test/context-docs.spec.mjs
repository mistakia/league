/* global describe before after beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'
import yaml from 'js-yaml'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

import server from '#api'
import knex from '#db'
import league_fixture from '#db/fixtures/league.mjs'
import { insert_restricted_free_agency_bid } from './utils/insert-restricted-free-agency-bid.mjs'
import {
  current_season,
  roster_slot_types,
  player_tag_types,
  transaction_types
} from '#constants'
import {
  generate_docs_index,
  generate_league_context,
  generate_league_rules,
  generate_league_schedule,
  generate_league_rosters,
  generate_league_rosters_csv,
  generate_team_context
} from '#libs-server'
import {
  build_frontmatter,
  markdown_table,
  format_date_et,
  doc_url
} from '#libs-server/context-docs/index.mjs'
import { epoch_to_timestamptz } from '#libs-shared'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chai_http)
const { expect } = chai

const base_url = 'https://xo.football'

// Franchise-tag amounts are not part of the default league, so seed them.
const league_params = {
  franchise_tag_salary_qb: 15,
  franchise_tag_salary_rb: 10,
  franchise_tag_salary_wr: 12,
  franchise_tag_salary_te: 8
}

const parse_frontmatter = (markdown) => {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  expect(match, 'document has a frontmatter block').to.exist
  return yaml.load(match[1])
}

// Give every team a manager, standings row, and populate the enumerated
// calendar fields; put one RFA-tagged (bid < value) active player plus a
// practice-squad player on team 1, and a completed + an upcoming matchup.
const seed_full_league = async () => {
  const year = current_season.year

  const users = []
  const seasonlogs = []
  for (let i = 1; i <= 12; i++) {
    users.push({
      id: i,
      username: `manager${i}`,
      email: `manager${i}@test.dev`
    })
    seasonlogs.push({
      lid: 1,
      tid: i,
      season_year: year,
      division: (i % 4) + 1,
      regular_season_wins: 12 - i,
      regular_season_losses: i - 1,
      regular_season_ties: 0,
      points_for: 1000 + i,
      points_against: 900 + i,
      overall_finish: i
    })
  }
  // Neither users nor seasonlogs/matchups are cleared by the league fixture, so
  // make this seeding idempotent across beforeEach runs.
  await knex('league_team_seasonlogs').where({ lid: 1 }).del()
  await knex('matchups').where({ lid: 1 }).del()
  await knex('users').insert(users).onConflict('id').merge()
  await knex('league_team_seasonlogs').insert(seasonlogs)

  const players = await knex('player')
    .whereNot('primary_position', 'DST')
    .limit(2)
  const rfa_player = players[0]
  const ps_player = players[1]
  const roster0 = await knex('rosters')
    .where({ tid: 1, lid: 1, week: 0, season_year: year })
    .first()

  // The roster player's salary basis (`value`) comes from its transaction row;
  // get-roster only surfaces roster players that have one.
  await knex('transactions').insert([
    {
      pid: rfa_player.pid,
      tid: 1,
      lid: 1,
      type: transaction_types.RESTRICTED_FREE_AGENCY_TAG,
      player_salary: 50,
      week: 0,
      season_year: year,
      occurred_at: epoch_to_timestamptz(Math.round(Date.now() / 1000) - 100),
      userid: 1
    },
    {
      pid: ps_player.pid,
      tid: 1,
      lid: 1,
      type: transaction_types.PRACTICE_ADD,
      player_salary: 5,
      week: 0,
      season_year: year,
      occurred_at: epoch_to_timestamptz(Math.round(Date.now() / 1000) - 200),
      userid: 1
    }
  ])
  await knex('rosters_players').insert([
    {
      roster_id: roster0.uid,
      slot: roster_slot_types.QB,
      pid: rfa_player.pid,
      player_position: rfa_player.primary_position,
      tag: player_tag_types.RESTRICTED_FREE_AGENCY,
      extensions: 0,
      tid: 1,
      lid: 1,
      week: 0,
      season_year: year
    },
    {
      roster_id: roster0.uid,
      slot: roster_slot_types.PS,
      pid: ps_player.pid,
      player_position: ps_player.primary_position,
      tag: player_tag_types.REGULAR,
      extensions: 0,
      tid: 1,
      lid: 1,
      week: 0,
      season_year: year
    }
  ])
  await insert_restricted_free_agency_bid({
    pid: rfa_player.pid,
    tid: 1,
    lid: 1,
    userid: 1,
    original_team_id: 1,
    year,
    bid_amount: 10
  })

  await knex('matchups').insert([
    {
      away_team_id: 2,
      home_team_id: 1,
      lid: 1,
      season_year: year,
      week: 1,
      home_points: 100.5,
      away_points: 90.25
    },
    {
      away_team_id: 4,
      home_team_id: 3,
      lid: 1,
      season_year: year,
      week: 1,
      home_points: 0,
      away_points: 0,
      home_projection: 110.5,
      away_projection: 105.25
    }
  ])

  await knex('draft').insert({
    round: 1,
    pick: 3,
    pick_str: '1.03',
    tid: 1,
    original_team_id: 1,
    lid: 1,
    season_year: year
  })

  // Populate the enumerated calendar event fields.
  const t = current_season.regular_season_start
  await knex('seasons')
    .where({ lid: 1, season_year: year })
    .update({
      season_started_at: t.subtract(20, 'weeks').toDate(),
      free_agency_period_start: t.subtract(6, 'weeks').toDate(),
      free_agency_live_auction_start: t.subtract(5, 'weeks').toDate(),
      free_agency_live_auction_end: t
        .subtract(5, 'weeks')
        .add(1, 'day')
        .toDate(),
      free_agency_period_end: t.subtract(2, 'weeks').toDate(),
      restricted_free_agency_period_start: t.subtract(4, 'weeks').toDate(),
      restricted_free_agency_period_end: t.subtract(3, 'weeks').toDate(),
      season_finalized_at: t.add(20, 'weeks').toDate(),
      wildcard_round: 15,
      championship_round: [16, 17]
    })

  return { rfa_player, ps_player }
}

describe('context documents', function () {
  this.timeout(60 * 1000)

  before(function () {
    MockDate.set(
      current_season.regular_season_start.subtract(1, 'month').toISOString()
    )
  })

  after(function () {
    MockDate.reset()
  })

  // The league fixture does not clear matchups/seasonlogs, so purge them before
  // every test to keep lifecycle (empty-state) cases isolated from seeded ones.
  beforeEach(async function () {
    await knex('matchups').where({ lid: 1 }).del()
    await knex('league_team_seasonlogs').where({ lid: 1 }).del()
  })

  describe('markdown helpers', function () {
    it('build_frontmatter parses back and carries type/generated_at/canonical_url', function () {
      const fm = build_frontmatter({
        type: 'league_context',
        fields: { canonical_url: 'https://xo.football/leagues/1.md' },
        related: { children: ['https://xo.football/leagues/1/teams/5.md'] }
      })
      fm.should.match(/^---\n[\s\S]*\n---\n$/)
      const parsed = parse_frontmatter(fm)
      parsed.type.should.equal('league_context')
      parsed.should.have.property('generated_at')
      parsed.canonical_url.should.equal('https://xo.football/leagues/1.md')
      parsed.children.should.deep.equal([
        'https://xo.football/leagues/1/teams/5.md'
      ])
    })

    it('markdown_table renders N data rows', function () {
      const table = markdown_table(
        ['A', 'B'],
        [
          [1, 2],
          [3, 4],
          [5, 6]
        ]
      )
      // header + divider + 3 rows
      table.split('\n').length.should.equal(5)
    })

    it('format_date_et yields an ET-labeled string and a placeholder for empty', function () {
      format_date_et(1700000000).should.match(/ ET$/)
      format_date_et(null).should.equal('TBD')
    })
  })

  describe('documentation index', function () {
    it('describes every published document from the file itself', async function () {
      const doc = await generate_docs_index({ base_url })
      const fm = parse_frontmatter(doc)
      fm.type.should.equal('docs_index')
      fm.canonical_url.should.equal(`${base_url}/docs.md`)

      // completeness: every markdown/JSON file at the top of docs/ is listed,
      // so a document added to the repository cannot go unpublished here
      const docs_dir = fileURLToPath(new URL('../docs/', import.meta.url))
      const files = (await fs.readdir(docs_dir, { withFileTypes: true }))
        .filter(
          (entry) =>
            entry.isFile() &&
            (entry.name.endsWith('.md') || entry.name.endsWith('.json'))
        )
        .map((entry) => entry.name)
      files.length.should.be.above(0)
      for (const file of files) {
        // the constitution is published at its own canonical path
        const url =
          file === 'constitution.md'
            ? `${base_url}/constitution.md`
            : `${base_url}/docs/${file}`
        doc.should.include(url)
      }

      // the API surfaces: browser explorer and its fetchable JSON sibling
      doc.should.include(`${base_url}/api/docs/`)
      doc.should.include(`${base_url}/api/docs/openapi.json`)

      // descriptions come from each file — entity frontmatter, an H1 paragraph,
      // or a JSON schema's own title/description
      doc.should.include('Create Data View Link')
      doc.should.include('Generate valid data view links for the league system')
      doc.should.include('Data View Specifications Master Index')

      // and the league doc set is described by shape, not for one league
      doc.should.include('## League context documents')
      doc.should.include('`/leagues/:lid/rosters.md`')
    })
  })

  describe('fully-configured league', function () {
    beforeEach(async function () {
      await league_fixture(knex, league_params)
      await seed_full_league()
    })

    it('league context: frontmatter, standings, cross-links', async function () {
      const doc = await generate_league_context({ db: knex, lid: 1, base_url })
      const fm = parse_frontmatter(doc)
      fm.type.should.equal('league_context')
      fm.children.length.should.equal(12)

      // one standings row per team (table body rows between header and blank)
      const standings_rows = doc
        .split('\n')
        .filter((line) => /^\| \d+ \| \[Team/.test(line))
      standings_rows.length.should.equal(12)

      doc.should.include(doc_url(base_url, { lid: 1, view: 'rules' }))
      doc.should.include(doc_url(base_url, { lid: 1, view: 'schedule' }))
      doc.should.include(doc_url(base_url, { lid: 1, tid: 1 }))

      // the Genesis league (lid 1) cross-links the authored constitution
      doc.should.include(`${base_url}/constitution.md`)
    })

    it('league context: surfaces the docs index, API explorer, and OpenAPI', async function () {
      const doc = await generate_league_context({ db: knex, lid: 1, base_url })
      const fm = parse_frontmatter(doc)

      fm.related.should.include(`${base_url}/docs.md`)
      fm.related.should.include(`${base_url}/api/docs/openapi.json`)

      doc.should.include('## Documentation and API')
      doc.should.include(`${base_url}/api/docs/`)
      doc.should.include(`${base_url}/docs/workflow-create-data-view-link.md`)
      doc.should.include(`${base_url}/docs/data-views-system.md`)
      doc.should.include(`${base_url}/docs/glossary.md`)
    })

    it('rules: labeled scoring/roster (no raw keys), cap, franchise amounts', async function () {
      const doc = await generate_league_rules({ db: knex, lid: 1, base_url })
      const fm = parse_frontmatter(doc)
      fm.type.should.equal('league_rules')

      // scoring rendered with human labels, never raw field keys
      doc.should.include('Completions')
      doc.should.include('Two PT Conv.')
      doc.should.not.match(/\| (pa|tdp|twoptc|prtd) \|/)

      // roster construction labels present
      doc.should.include('QB/RB/WR/TE')
      doc.should.include('Short Term Reserve Limit')

      // cap / faab / salary-attribution line and franchise amounts
      doc.should.include('Salary cap')
      doc.should.include('Free agency budget (FAAB)')
      doc.should.include('Salary attribution rule')
      doc.should.include('$15') // franchise_tag_salary_qb

      // Genesis league (lid 1) points to the authored constitution for governance
      doc.should.include('League Constitution')
      doc.should.include(`${base_url}/constitution.md`)
    })

    it('schedule: calendar rows for each populated event, matchups with names', async function () {
      const doc = await generate_league_schedule({ db: knex, lid: 1, base_url })
      parse_frontmatter(doc).type.should.equal('league_schedule')

      const expected_events = [
        'Season Begins',
        'Rookie Draft',
        'Extension Deadline',
        'Free Agency Period Begins',
        'Free Agency Live Auction',
        'Free Agency Auction Ends',
        'Free Agency Period Ends',
        'Restricted Free Agency Begins',
        'Restricted Free Agency Ends',
        'Trade Deadline',
        'Season Finalized'
      ]
      for (const event of expected_events) {
        doc.should.include(event)
      }

      // matchup names resolved (not raw tids)
      doc.should.include('Team1')
      doc.should.include('Team2')
      doc.should.include('won')
    })

    it('team: cap uses bid (not value), pids resolved, no raw slot codes', async function () {
      const doc = await generate_team_context({
        db: knex,
        lid: 1,
        tid: 1,
        base_url
      })
      parse_frontmatter(doc).type.should.equal('team_context')

      // cap == 200 - bid(10); would be 200 - value(50) = 150 if bid ignored
      doc.should.include('$190 of $200')

      // slot groups rendered with display names, no numeric codes
      doc.should.include('### Starters')
      doc.should.include('### Practice Squad')
      doc.should.match(/\| QB \|/)
      doc.should.match(/\| PS \|/)
    })

    it('team: extension deadline passed → as-recorded salary basis', async function () {
      const doc = await generate_team_context({
        db: knex,
        lid: 1,
        tid: 1,
        base_url
      })
      const fm = parse_frontmatter(doc)
      fm.salary_basis.should.equal('as_recorded')
      fm.salary_year.should.equal(current_season.year)
      fm.should.have.property('extension_deadline')

      doc.should.include(`| ${current_season.year} Salary |`)
      doc.should.include(`Salary basis: **${current_season.year} as recorded**`)
      doc.should.include(`Cap space (${current_season.year})`)
      doc.should.not.include('post-extension')
    })

    it('team: extension window open → post-extension salary basis and prices', async function () {
      const year = current_season.year
      await knex('seasons')
        .where({ lid: 1, season_year: year })
        .update({ ext_date: current_season.now.add(1, 'week').toDate() })

      // A regular contract with one extension already used: the recorded $20
      // becomes $20 + (1 + 1) * 5 = $30 on the post-extension basis.
      const player = await knex('player')
        .whereNot('primary_position', 'DST')
        .orderBy('pid')
        .offset(2)
        .first()
      const roster0 = await knex('rosters')
        .where({ tid: 1, lid: 1, week: 0, season_year: year })
        .first()
      await knex('transactions').insert({
        pid: player.pid,
        tid: 1,
        lid: 1,
        type: transaction_types.AUCTION_PROCESSED,
        player_salary: 20,
        week: 0,
        season_year: year,
        occurred_at: epoch_to_timestamptz(Math.round(Date.now() / 1000) - 300),
        userid: 1
      })
      await knex('rosters_players').insert({
        roster_id: roster0.uid,
        slot: roster_slot_types.BENCH,
        pid: player.pid,
        player_position: player.primary_position,
        tag: player_tag_types.REGULAR,
        extensions: 1,
        tid: 1,
        lid: 1,
        week: 0,
        season_year: year
      })

      const doc = await generate_team_context({
        db: knex,
        lid: 1,
        tid: 1,
        base_url
      })
      const fm = parse_frontmatter(doc)
      fm.salary_basis.should.equal('post_extension')

      doc.should.include(`| ${year} Salary (post-extension) |`)
      doc.should.include(`Salary basis: **post-extension ${year}**`)
      doc.should.include(`Cap space (post-extension ${year})`)

      // the extended salary, not the recorded $20
      const player_name = `${player.first_name} ${player.last_name}`.trim()
      const bench_row = doc
        .split('\n')
        .find((line) => line.startsWith('| BE |') && line.includes(player_name))
      expect(bench_row, 'bench row rendered').to.exist
      bench_row.should.include('$30')
      bench_row.should.not.include('$20')
    })

    it('rosters: every team, cap summary, salary basis, CSV link', async function () {
      const doc = await generate_league_rosters({ db: knex, lid: 1, base_url })
      const fm = parse_frontmatter(doc)
      fm.type.should.equal('league_rosters')
      fm.num_teams.should.equal(12)
      fm.num_rostered_players.should.equal(2)
      fm.salary_basis.should.equal('as_recorded')
      fm.csv_url.should.equal(`${base_url}/leagues/1/rosters.csv`)
      fm.children.length.should.equal(12)

      // one section per team, and the cap summary carries a row per team
      for (let tid = 1; tid <= 12; tid++) {
        doc.should.include(`### Team${tid} (team ${tid})`)
      }
      doc.should.include('## Cap summary')
      doc.should.include(`| ${current_season.year} Salary |`)
      doc.should.include(`Salary basis: **${current_season.year} as recorded**`)

      // team 1 holds the seeded RFA contract at its $10 bid; the other eleven
      // teams are empty
      doc.should.include('$190')
      doc.should.include('_Empty._')
    })

    it('rosters csv: one row per rostered player, salary basis on every row', async function () {
      const csv = await generate_league_rosters_csv({ db: knex, lid: 1 })
      const lines = csv.trim().split('\r\n')

      lines[0].should.equal(
        'league_id,year,team_id,team_name,group,slot,player_id,player_name,position,nfl_team,salary,salary_basis,salary_year,tag,extensions'
      )
      // two seeded rostered players (one RFA-tagged starter, one on the
      // practice squad); every other team is empty
      lines.length.should.equal(3)

      for (const line of lines.slice(1)) {
        line.should.include('as_recorded')
        line.should.include(`,${current_season.year},`)
      }
      csv.should.include('Restricted Free Agency')
      csv.should.include('Practice Squad')
    })

    it('population-level self-sufficiency', async function () {
      const { rfa_player, ps_player } = {
        rfa_player: await knex('rosters_players')
          .where({ tid: 1, week: 0, slot: roster_slot_types.QB })
          .first(),
        ps_player: await knex('rosters_players')
          .where({ tid: 1, week: 0, slot: roster_slot_types.PS })
          .first()
      }
      const team_doc = await generate_team_context({
        db: knex,
        lid: 1,
        tid: 1,
        base_url
      })

      // (a) no bare roster pid strings survive in the rendered roster rows
      team_doc.should.not.include(rfa_player.pid)
      team_doc.should.not.include(ps_player.pid)

      // (b) no raw numeric roster-slot code leaks into the roster tables (every
      // slot mapped to a display name). Scope to the Roster section so the
      // draft "Round" / schedule "Week" numeric columns are not mis-flagged.
      const slot_codes = Object.values(roster_slot_types)
      const roster_section = team_doc.split('## Roster')[1].split('\n## ')[0]
      const roster_slot_cells = roster_section
        .split('\n')
        .filter(
          (line) =>
            line.startsWith('| ') &&
            !line.startsWith('| Slot') &&
            !line.startsWith('| ---')
        )
        .map((line) => line.split('|')[1].trim())
      for (const cell of roster_slot_cells) {
        slot_codes.should.not.include(Number(cell))
      }

      // (c) league standings row count equals team count
      const league_doc = await generate_league_context({
        db: knex,
        lid: 1,
        base_url
      })
      league_doc
        .split('\n')
        .filter((line) => /^\| \d+ \| \[Team/.test(line))
        .length.should.equal(12)
    })
  })

  describe('lifecycle states', function () {
    beforeEach(async function () {
      await league_fixture(knex, league_params)
    })

    it('no configured season for the year → 404-mapped guard error', async function () {
      let thrown
      try {
        await generate_league_context({
          db: knex,
          lid: 1,
          year: current_season.year + 5,
          base_url
        })
      } catch (err) {
        thrown = err
      }
      expect(thrown, 'guard threw').to.exist
      thrown.status.should.equal(404)
      thrown.code.should.equal('season_not_configured')
    })

    it('missing league → 404-mapped error', async function () {
      let thrown
      try {
        await generate_league_context({ db: knex, lid: 999999, base_url })
      } catch (err) {
        thrown = err
      }
      expect(thrown, 'guard threw').to.exist
      thrown.status.should.equal(404)
    })

    it('week-0 / no matchups → schedule empty-state section', async function () {
      const doc = await generate_league_schedule({ db: knex, lid: 1, base_url })
      doc.should.include('No matchups scheduled yet')
    })

    it('empty roster → empty slot groups with full-cap space', async function () {
      const doc = await generate_team_context({
        db: knex,
        lid: 1,
        tid: 5,
        base_url
      })
      doc.should.include('$200 of $200')
      doc.should.include('_Empty._')
      doc.should.include('No matchups scheduled yet')
    })
  })

  describe('routes', function () {
    beforeEach(async function () {
      await league_fixture(knex, league_params)
      await seed_full_league()
    })

    const markdown_routes = [
      '/docs.md',
      '/leagues/1.md',
      '/leagues/1/rules.md',
      '/leagues/1/schedule.md',
      '/leagues/1/rosters.md',
      '/leagues/1/teams/1.md'
    ]

    for (const route of markdown_routes) {
      it(`GET ${route} → 200 text/markdown with frontmatter`, async function () {
        const res = await chai_request.execute(server).get(route)
        res.should.have.status(200)
        res.should.have.header('content-type', /text\/markdown/)
        res.text.should.match(/^---\n/)
      })
    }

    it('GET /leagues/1/rosters.csv → 200 text/csv with a header row', async function () {
      const res = await chai_request
        .execute(server)
        .get('/leagues/1/rosters.csv')
      res.should.have.status(200)
      res.should.have.header('content-type', /text\/csv/)
      res.text.should.match(/^league_id,year,team_id,team_name,/)
    })

    it('GET /api/docs/openapi.json → 200 JSON specification', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/docs/openapi.json')
      res.should.have.status(200)
      res.should.have.header('content-type', /application\/json/)
      res.body.should.have.property('openapi')
      res.body.should.have.property('paths')
    })

    it('GET /constitution.md → 200 text/markdown (authored doc, no frontmatter)', async function () {
      const res = await chai_request.execute(server).get('/constitution.md')
      res.should.have.status(200)
      res.should.have.header('content-type', /text\/markdown/)
      res.text.should.include('# Genesis League Constitution')
    })

    it('GET a missing league → 404', async function () {
      const res = await chai_request.execute(server).get('/leagues/999999.md')
      res.should.have.status(404)
    })

    it('non-numeric league id does not match the markdown route (falls through)', async function () {
      // `/leagues/1xmd` must not match `:lid(\d+).md`; the SPA catch-all serves
      // it, so it is not a 404 from the markdown router.
      const res = await chai_request.execute(server).get('/leagues/1abc.md')
      res.should.not.have.header('content-type', /text\/markdown/)
    })
  })
})
