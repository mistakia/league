import { current_season, transaction_type_display_names } from '#constants'

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
      wins: log.wins || 0,
      losses: log.losses || 0,
      ties: log.ties || 0,
      pf: Number(log.pf || 0),
      pa: Number(log.pa || 0),
      division:
        league[`division_${team.div}_name`] ||
        (team.div ? `Division ${team.div}` : '—')
    }
  })

  rows.sort((a, b) => b.wins - a.wins || b.pf - a.pf)
  return rows
}

export default async function generate_league_context({
  db,
  lid,
  year = current_season.year,
  base_url = DEFAULT_BASE_URL
}) {
  const league = await load_configured_league({ db, lid, year })

  const teams = await db('teams').where({ lid, year }).orderBy('uid')
  const seasonlogs = await db('league_team_seasonlogs').where({ lid, year })
  const managers = await get_team_managers({ db, lid, year })

  const recent_transactions = await db('transactions')
    .where({ lid, year })
    .orderBy('timestamp', 'desc')
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
      num_teams: teams.length
    },
    related: {
      children: teams.map((team) => doc_url(base_url, { lid, tid: team.uid })),
      related: [
        doc_url(base_url, { lid, view: 'rules' }),
        doc_url(base_url, { lid, view: 'schedule' })
      ]
    }
  })

  const identity = [
    heading(1, `${league.name} — League Context`),
    `League ${league.uid} · ${year} season · ${teams.length} teams`,
    `Format: ${league.num_teams || teams.length}-team, $${league.cap} cap auction. See [rules](${doc_url(
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
        row.pf.toFixed(2),
        row.pa.toFixed(2),
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

  const transactions_section = section(
    'Recent transactions',
    recent_transactions.length
      ? markdown_table(
          ['Date', 'Team', 'Action', 'Player', 'Value'],
          recent_transactions.map((t) => [
            format_date_et(t.timestamp),
            team_name_by_tid.get(t.tid) || `Team ${t.tid}`,
            transaction_type_display_names[t.type] || `Type ${t.type}`,
            t.pid ? transaction_players[t.pid]?.name || t.pid : '—',
            `$${t.value}`
          ])
        )
      : '_No transactions yet._'
  )

  const footer = cross_link_footer([
    { label: 'League rules', url: doc_url(base_url, { lid, view: 'rules' }) },
    {
      label: 'League schedule',
      url: doc_url(base_url, { lid, view: 'schedule' })
    },
    lid === CONSTITUTION_LEAGUE_ID && {
      label: 'League constitution',
      url: constitution_url(base_url)
    },
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
    footer
  ].join('\n\n')
}
