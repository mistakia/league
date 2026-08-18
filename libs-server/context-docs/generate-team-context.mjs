import { current_season, transaction_type_display_names } from '#constants'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'

import where_outstanding_draft_pick from '../where-outstanding-draft-pick.mjs'

import { load_configured_league } from './generate-league-context.mjs'
import get_team_managers from './get-team-managers.mjs'
import get_players from './get-players.mjs'
import { slot_groups, load_team_roster, build_roster_rows } from './rosters.mjs'
import { resolve_salary_basis } from './salary-basis.mjs'
import { ContextDocError } from './errors.mjs'
import {
  build_frontmatter,
  section,
  heading,
  markdown_table,
  cross_link_footer,
  format_date_et,
  doc_url,
  docs_index_url
} from './markdown.mjs'

const DEFAULT_BASE_URL = 'https://xo.football'

export function render_roster_groups(roster_rows, salary_basis) {
  return slot_groups
    .map((group) => {
      const rows = roster_rows
        .filter((roster_row) => roster_row.group === group.title)
        .map((roster_row) => [
          roster_row.slot,
          roster_row.name,
          roster_row.pos,
          roster_row.nfl_team || '—',
          `$${roster_row.salary}`,
          roster_row.tag ||
            (roster_row.extensions ? `Ext x${roster_row.extensions}` : '')
        ])
      const body = rows.length
        ? markdown_table(
            ['Slot', 'Player', 'Pos', 'NFL', salary_basis.column_label, 'Tag'],
            rows
          )
        : '_Empty._'
      return `${heading(3, group.title)}\n\n${body}`
    })
    .join('\n\n')
}

export default async function generate_team_context({
  db,
  lid,
  tid,
  year = current_season.year,
  base_url = DEFAULT_BASE_URL
}) {
  const league = await load_configured_league({ db, lid, year })

  const team = await db('teams')
    .where({ team_id: tid, lid, season_year: year })
    .first()
  if (!team) {
    throw new ContextDocError(`team ${tid} not found in league ${lid}`, {
      status: 404,
      code: 'team_not_found'
    })
  }

  const managers = await get_team_managers({ db, lid, year })
  const seasonlog = await db('league_team_seasonlogs')
    .where({ lid, tid, season_year: year })
    .first()
  const roster = await load_team_roster({ tid, year, lid, league })

  // Resolve player display attributes for the roster and recent transactions.
  const roster_pids = roster.all.map((player) => player.pid)
  const recent_transactions = await db('transactions')
    .where({ lid, tid, season_year: year })
    .orderBy('occurred_at', 'desc')
    .orderBy('transaction_id', 'desc')
    .limit(10)
  const players = await get_players({
    db,
    pids: [...roster_pids, ...recent_transactions.map((t) => t.pid)]
  })

  const draft_picks = await db('draft')
    .where({ tid, lid, season_year: year })
    .modify(where_outstanding_draft_pick)
    .orderBy('round')
    .orderBy('pick')

  const matchups = await db('matchups')
    .where({ lid, season_year: year })
    .where(function () {
      this.where('home_team_id', tid).orWhere('away_team_id', tid)
    })
    .orderBy('week')
  const other_teams = await db('teams')
    .where({ lid, season_year: year })
    .whereNot('team_id', tid)
  const team_name_by_tid = new Map([
    [team.team_id, team.name],
    ...other_teams.map((t) => [t.team_id, t.name])
  ])

  const salary_basis = resolve_salary_basis({ league, year })

  const frontmatter = build_frontmatter({
    type: 'team_context',
    fields: {
      canonical_url: doc_url(base_url, { lid, tid }),
      league_id: league.league_id,
      team_id: team.team_id,
      team_name: team.name,
      year,
      salary_basis: salary_basis.frontmatter_value,
      salary_year: year,
      extension_deadline: league.extension_deadline_at
        ? new Date(league.extension_deadline_at).toISOString()
        : null
    },
    related: {
      parent: doc_url(base_url, { lid }),
      related: [
        doc_url(base_url, { lid, view: 'rules' }),
        doc_url(base_url, { lid, view: 'schedule' }),
        doc_url(base_url, { lid, view: 'rosters' })
      ]
    }
  })

  const manager = (managers[team.team_id] || []).join(', ') || '—'
  const division =
    league[`division_${team.division}_name`] ||
    (team.division ? `Division ${team.division}` : '—')
  const record = seasonlog
    ? `${seasonlog.regular_season_wins || 0}-${seasonlog.regular_season_losses || 0}-${seasonlog.regular_season_ties || 0}`
    : '0-0-0'
  const finish =
    seasonlog && seasonlog.overall_finish
      ? `#${seasonlog.overall_finish}`
      : 'TBD'

  const identity = section('Overview', [
    heading(1, `${team.name} — Team Context (${year})`),
    markdown_table(
      ['Field', 'Value'],
      [
        ['Manager', manager],
        ['Division', division],
        ['Record (W-L-T)', record],
        ['Overall finish', finish],
        [
          salary_basis.before_deadline
            ? `Cap space (post-extension ${year})`
            : `Cap space (${year})`,
          `$${roster.availableCap} of $${league.salary_cap}`
        ],
        ['FAAB remaining', `$${team.free_agent_acquisition_budget_balance}`]
      ]
    )
  ])

  const roster_rows = build_roster_rows({ team, roster, players })
  const roster_section = section('Roster', [
    salary_basis.note,
    `Every team's roster in one document: [league rosters](${doc_url(base_url, {
      lid,
      view: 'rosters'
    })}) (machine-readable: [rosters.csv](${doc_url(base_url, {
      lid,
      view: 'rosters',
      format: 'csv'
    })})).`,
    render_roster_groups(roster_rows, salary_basis)
  ])

  const picks_section = section(
    'Unused draft picks',
    draft_picks.length
      ? markdown_table(
          ['Round', 'Pick'],
          draft_picks.map((pick) => [
            pick.round,
            pick.pick_string || pick.pick || '—'
          ])
        )
      : '_No unused draft picks._'
  )

  const schedule_rows = matchups.map((matchup) => {
    const is_home = matchup.home_team_id === tid
    const opponent_tid = is_home ? matchup.away_team_id : matchup.home_team_id
    const opponent =
      team_name_by_tid.get(opponent_tid) || `Team ${opponent_tid}`
    const own_points = Number(
      is_home ? matchup.home_points : matchup.away_points
    )
    const opp_points = Number(
      is_home ? matchup.away_points : matchup.home_points
    )
    const outcome =
      own_points > 0 || opp_points > 0
        ? `${own_points.toFixed(2)} - ${opp_points.toFixed(2)}`
        : 'scheduled'
    return [matchup.week, is_home ? 'vs' : '@', opponent, outcome]
  })
  const schedule_section = section(
    'Schedule and results',
    matchups.length
      ? markdown_table(['Week', 'H/A', 'Opponent', 'Result'], schedule_rows)
      : '_No matchups scheduled yet._'
  )

  const transactions_section = section('Recent transactions', [
    recent_transactions.length
      ? 'Amounts are the salary recorded by each transaction, not the current contract salary.'
      : null,
    recent_transactions.length
      ? markdown_table(
          ['Date', 'Action', 'Player', 'Amount'],
          recent_transactions.map((t) => [
            format_date_et(timestamptz_to_epoch(t.occurred_at)),
            transaction_type_display_names[t.type] || `Type ${t.type}`,
            t.pid ? players[t.pid]?.name || t.pid : '—',
            `$${t.player_salary}`
          ])
        )
      : '_No transactions yet._'
  ])

  const footer = cross_link_footer([
    { label: 'League index', url: doc_url(base_url, { lid }) },
    { label: 'League rules', url: doc_url(base_url, { lid, view: 'rules' }) },
    {
      label: 'League schedule',
      url: doc_url(base_url, { lid, view: 'schedule' })
    },
    {
      label: 'League rosters',
      url: doc_url(base_url, { lid, view: 'rosters' })
    },
    { label: 'Documentation index', url: docs_index_url(base_url) },
    ...other_teams.map((t) => ({
      label: `Team: ${t.name}`,
      url: doc_url(base_url, { lid, tid: t.team_id })
    }))
  ])

  return [
    frontmatter,
    identity,
    roster_section,
    picks_section,
    schedule_section,
    transactions_section,
    footer
  ].join('\n\n')
}
