import { current_season, transaction_type_display_names } from '#constants'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'

import getLeague from '../get-league.mjs'
import get_team_managers from './get-team-managers.mjs'
import get_players from './get-players.mjs'
import { ContextDocError, season_not_configured_error } from './errors.mjs'
import {
  build_frontmatter,
  section,
  heading,
  markdown_table,
  cross_link_footer,
  format_date_et,
  doc_url,
  constitution_url,
  docs_index_url,
  docs_file_url,
  api_explorer_url,
  openapi_url,
  CONSTITUTION_LEAGUE_ID
} from './markdown.mjs'
import {
  build_league_calendar,
  resolve_current_phase
} from './league-calendar.mjs'

const DEFAULT_BASE_URL = 'https://xo.football'

/**
 * Load the league and enforce the lifecycle guards shared by every generator:
 * a missing league is a 404, and a league with no configured season for the
 * year (no `scoring_format_id`) is a 404 rather than a degenerate doc.
 */
export async function load_configured_league({ db, lid, year }) {
  const league = await getLeague({ lid, year })
  if (!league || !league.uid) {
    throw new ContextDocError(`league ${lid} not found`, {
      status: 404,
      code: 'league_not_found'
    })
  }
  if (!league.scoring_format_id) {
    throw season_not_configured_error(lid, year)
  }
  return league
}

function build_standings({ teams, seasonlogs, managers, league }) {
  const seasonlog_by_tid = new Map(seasonlogs.map((row) => [row.tid, row]))

  const rows = teams.map((team) => {
    const log = seasonlog_by_tid.get(team.uid) || {}
    return {
      tid: team.uid,
      name: team.name,
      manager: (managers[team.uid] || []).join(', ') || '—',
      wins: log.regular_season_wins || 0,
      losses: log.regular_season_losses || 0,
      ties: log.regular_season_ties || 0,
      points_for: Number(log.points_for || 0),
      points_against: Number(log.points_against || 0),
      division:
        league[`division_${team.division}_name`] ||
        (team.division ? `Division ${team.division}` : '—')
    }
  })

  rows.sort((a, b) => b.wins - a.wins || b.points_for - a.points_for)
  return rows
}

export default async function generate_league_context({
  db,
  lid,
  year = current_season.year,
  base_url = DEFAULT_BASE_URL
}) {
  const league = await load_configured_league({ db, lid, year })

  const teams = await db('teams')
    .where({ lid, season_year: year })
    .orderBy('uid')
  const seasonlogs = await db('league_team_seasonlogs').where({
    lid,
    season_year: year
  })
  const managers = await get_team_managers({ db, lid, year })

  const recent_transactions = await db('transactions')
    .where({ lid, season_year: year })
    .orderBy('occurred_at', 'desc')
    .orderBy('uid', 'desc')
    .limit(10)
  const transaction_players = await get_players({
    db,
    pids: recent_transactions.map((t) => t.pid)
  })
  const team_name_by_tid = new Map(teams.map((team) => [team.uid, team.name]))

  const standings = build_standings({ teams, seasonlogs, managers, league })

  // Frontmatter: the league index is the root; its children are the team docs.
  const frontmatter = build_frontmatter({
    type: 'league_context',
    fields: {
      canonical_url: doc_url(base_url, { lid }),
      league_id: league.uid,
      league_name: league.name,
      year,
      number_teams: teams.length
    },
    related: {
      children: teams.map((team) => doc_url(base_url, { lid, tid: team.uid })),
      related: [
        doc_url(base_url, { lid, view: 'rules' }),
        doc_url(base_url, { lid, view: 'schedule' }),
        doc_url(base_url, { lid, view: 'rosters' }),
        docs_index_url(base_url),
        openapi_url(base_url)
      ]
    }
  })

  const identity = [
    heading(1, `${league.name} — League Context`),
    `League ${league.uid} · ${year} season · ${teams.length} teams`,
    `Format: ${league.number_teams || teams.length}-team, $${league.salary_cap} cap auction. See [rules](${doc_url(
      base_url,
      { lid, view: 'rules' }
    )}) for full scoring and roster construction.`
  ].join('\n\n')

  const standings_section = section(
    'Standings',
    markdown_table(
      ['Rank', 'Team', 'Manager', 'W-L-T', 'PF', 'PA', 'Division'],
      standings.map((row, index) => [
        index + 1,
        `[${row.name}](${doc_url(base_url, { lid, tid: row.tid })})`,
        row.manager,
        `${row.wins}-${row.losses}-${row.ties}`,
        row.points_for.toFixed(2),
        row.points_against.toFixed(2),
        row.division
      ])
    )
  )

  const calendar = build_league_calendar({ league })
  const upcoming = calendar.filter((e) => e.status === 'upcoming').slice(0, 4)
  const phase = resolve_current_phase({ league })
  const calendar_section = section('Current phase and upcoming dates', [
    `Current phase: **${phase}**.`,
    upcoming.length
      ? markdown_table(
          ['Date', 'Event'],
          upcoming.map((e) => [format_date_et(e.date_unix), e.label])
        )
      : '_No upcoming scheduled dates._',
    `Full league calendar: [schedule](${doc_url(base_url, {
      lid,
      view: 'schedule'
    })}).`
  ])

  const transactions_section = section('Recent transactions', [
    recent_transactions.length
      ? 'Amounts are the salary recorded by each transaction, not the current contract salary. Per-team docs carry current salaries.'
      : null,
    recent_transactions.length
      ? markdown_table(
          ['Date', 'Team', 'Action', 'Player', 'Amount'],
          recent_transactions.map((t) => [
            format_date_et(timestamptz_to_epoch(t.occurred_at)),
            team_name_by_tid.get(t.tid) || `Team ${t.tid}`,
            transaction_type_display_names[t.type] || `Type ${t.type}`,
            t.pid ? transaction_players[t.pid]?.name || t.pid : '—',
            `$${t.player_salary}`
          ])
        )
      : '_No transactions yet._'
  ])

  // The root entry point also has to answer "what else can I read, and how do I
  // query this platform" — otherwise an agent that starts here never learns the
  // API or the data-view surface exists.
  const documentation_section = section('Documentation and API', [
    markdown_table(
      ['Resource', 'Covers'],
      [
        [
          `[Documentation index](${docs_index_url(base_url)})`,
          'Every published reference document, grouped and described — start here'
        ],
        [
          `[API explorer](${api_explorer_url(base_url)})`,
          'Interactive Swagger UI over every endpoint (browser UI)'
        ],
        [
          `[OpenAPI document](${openapi_url(base_url)})`,
          'The same specification as fetchable JSON, for programmatic readers'
        ],
        [
          `[Data view link workflow](${docs_file_url(
            base_url,
            'workflow-create-data-view-link.md'
          )})`,
          'How to build a valid data view link — the platform query surface'
        ],
        [
          `[Data views system](${docs_file_url(
            base_url,
            'data-views-system.md'
          )})`,
          'Column definitions, filters, and how a view resolves to SQL'
        ],
        [
          `[Glossary](${docs_file_url(base_url, 'glossary.md')})`,
          'Fantasy football terminology and stat abbreviations'
        ]
      ]
    ),
    'League read data is public and needs no token; only mutations are authenticated.'
  ])

  const footer = cross_link_footer([
    { label: 'League rules', url: doc_url(base_url, { lid, view: 'rules' }) },
    {
      label: 'League rosters',
      url: doc_url(base_url, { lid, view: 'rosters' })
    },
    {
      label: 'League rosters (CSV)',
      url: doc_url(base_url, { lid, view: 'rosters', format: 'csv' })
    },
    {
      label: 'League schedule',
      url: doc_url(base_url, { lid, view: 'schedule' })
    },
    lid === CONSTITUTION_LEAGUE_ID && {
      label: 'League constitution',
      url: constitution_url(base_url)
    },
    { label: 'Documentation index', url: docs_index_url(base_url) },
    ...teams.map((team) => ({
      label: `Team: ${team.name}`,
      url: doc_url(base_url, { lid, tid: team.uid })
    }))
  ])

  return [
    frontmatter,
    identity,
    standings_section,
    calendar_section,
    transactions_section,
    documentation_section,
    footer
  ].join('\n\n')
}
