import { current_season } from '#constants'

import { load_configured_league } from './generate-league-context.mjs'
import load_league_rosters from './rosters.mjs'
import { resolve_salary_basis } from './salary-basis.mjs'
import {
  build_frontmatter,
  section,
  heading,
  markdown_table,
  cross_link_footer,
  doc_url,
  constitution_url,
  docs_index_url,
  CONSTITUTION_LEAGUE_ID
} from './markdown.mjs'

const DEFAULT_BASE_URL = 'https://xo.football'

/**
 * League-wide rosters in one fetch. The team doc answers "what does this team
 * have"; this doc answers the cross-team questions (who holds a position, where
 * the cap room is, which contracts are tagged) that otherwise cost one fetch per
 * team. Salaries carry the same basis as every other doc — see `salary-basis`.
 */
export default async function generate_league_rosters({
  db,
  lid,
  year = current_season.year,
  base_url = DEFAULT_BASE_URL
}) {
  const league = await load_configured_league({ db, lid, year })
  const team_rosters = await load_league_rosters({ db, lid, year, league })
  const salary_basis = resolve_salary_basis({ league, year })

  const csv_url = doc_url(base_url, { lid, view: 'rosters', format: 'csv' })

  const frontmatter = build_frontmatter({
    type: 'league_rosters',
    fields: {
      canonical_url: doc_url(base_url, { lid, view: 'rosters' }),
      csv_url,
      league_id: league.uid,
      league_name: league.name,
      year,
      number_teams: team_rosters.length,
      num_rostered_players: team_rosters.reduce(
        (sum, { rows }) => sum + rows.length,
        0
      ),
      salary_basis: salary_basis.frontmatter_value,
      salary_year: year,
      // seasons.extension_deadline_at is timestamptz, so it is already an instant; Number()
      // on it would have yielded milliseconds and landed in the year 55000.
      extension_deadline: league.extension_deadline_at
        ? new Date(league.extension_deadline_at).toISOString()
        : null
    },
    related: {
      parent: doc_url(base_url, { lid }),
      children: team_rosters.map(({ team }) =>
        doc_url(base_url, { lid, tid: team.team_id })
      ),
      related: [
        doc_url(base_url, { lid, view: 'rules' }),
        doc_url(base_url, { lid, view: 'schedule' })
      ]
    }
  })

  const identity = [
    heading(1, `${league.name} — Rosters (${year})`),
    salary_basis.note,
    `Every roster in the league, as one document. The same rows are published as CSV at [rosters.csv](${csv_url}) for filtering and aggregation; per-team detail (draft picks, schedule, transactions) lives in each team doc.`
  ].join('\n\n')

  // Lead with the cross-team comparison: cap committed and room per team is the
  // question this doc exists to answer without twelve fetches.
  const cap_rows = team_rosters
    .map(({ team, roster }) => ({
      name: team.name,
      committed: league.salary_cap - roster.availableCap,
      space: roster.availableCap,
      active: roster.active.length,
      practice_squad: roster.practice.length,
      reserve: roster.reserve.length,
      tid: team.team_id
    }))
    .sort((a, b) => a.space - b.space)

  const cap_section = section('Cap summary', [
    markdown_table(
      [
        'Team',
        `${year} Salary committed`,
        'Cap space',
        'Active',
        'Practice squad',
        'Reserve'
      ],
      cap_rows.map((row) => [
        `[${row.name}](${doc_url(base_url, { lid, tid: row.tid })})`,
        `$${row.committed}`,
        `$${row.space}`,
        row.active,
        row.practice_squad,
        row.reserve
      ])
    ),
    `Cap: $${league.salary_cap} per team. Committed is the sum of active-roster salaries on the basis stated above; practice-squad and reserve contracts do not count against it.`
  ])

  const roster_sections = team_rosters.map(({ team, rows }) =>
    section(
      `${team.name} (team ${team.team_id})`,
      rows.length
        ? markdown_table(
            [
              'Group',
              'Slot',
              'Player',
              'Pos',
              'NFL',
              salary_basis.column_label,
              'Tag'
            ],
            rows.map((row) => [
              row.group,
              row.slot,
              row.name,
              row.pos,
              row.nfl_team || '—',
              `$${row.salary}`,
              row.tag || (row.extensions ? `Ext x${row.extensions}` : '')
            ])
          )
        : '_Empty._',
      { level: 3 }
    )
  )

  const rosters_section = [
    heading(2, 'Rosters by team'),
    ...roster_sections
  ].join('\n\n')

  const footer = cross_link_footer([
    { label: 'League index', url: doc_url(base_url, { lid }) },
    { label: 'League rules', url: doc_url(base_url, { lid, view: 'rules' }) },
    {
      label: 'League schedule',
      url: doc_url(base_url, { lid, view: 'schedule' })
    },
    { label: 'Rosters (CSV)', url: csv_url },
    lid === CONSTITUTION_LEAGUE_ID && {
      label: 'League constitution',
      url: constitution_url(base_url)
    },
    { label: 'Documentation index', url: docs_index_url(base_url) },
    ...team_rosters.map(({ team }) => ({
      label: `Team: ${team.name}`,
      url: doc_url(base_url, { lid, tid: team.team_id })
    }))
  ])

  return [frontmatter, identity, cap_section, rosters_section, footer].join(
    '\n\n'
  )
}
