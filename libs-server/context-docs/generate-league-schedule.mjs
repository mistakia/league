import { current_season } from '#constants'

import { load_configured_league } from './generate-league-context.mjs'
import {
  build_frontmatter,
  section,
  heading,
  markdown_table,
  cross_link_footer,
  format_date_et,
  doc_url
} from './markdown.mjs'
import {
  build_league_calendar,
  derive_playoff_weeks,
  resolve_current_phase
} from './league-calendar.mjs'

const DEFAULT_BASE_URL = 'https://xo.football'

function render_matchups(matchups, team_name_by_tid) {
  if (!matchups.length) {
    return '_No matchups scheduled yet._'
  }

  const rows = matchups.map((matchup) => {
    const home = team_name_by_tid.get(matchup.hid) || `Team ${matchup.hid}`
    const away = team_name_by_tid.get(matchup.aid) || `Team ${matchup.aid}`
    const home_points = Number(matchup.hp)
    const away_points = Number(matchup.ap)
    const is_completed = home_points > 0 || away_points > 0

    let outcome
    if (is_completed) {
      const winner =
        home_points === away_points
          ? 'Tie'
          : home_points > away_points
            ? `${home} won`
            : `${away} won`
      outcome = `${home_points.toFixed(2)} - ${away_points.toFixed(2)} (${winner})`
    } else if (matchup.home_projection || matchup.away_projection) {
      outcome = `proj ${Number(matchup.home_projection || 0).toFixed(
        1
      )} - ${Number(matchup.away_projection || 0).toFixed(1)}`
    } else {
      outcome = 'scheduled'
    }

    return [matchup.week, home, away, outcome]
  })

  return markdown_table(['Week', 'Home', 'Away', 'Result / Projection'], rows)
}

export default async function generate_league_schedule({
  db,
  lid,
  year = current_season.year,
  base_url = DEFAULT_BASE_URL
}) {
  const league = await load_configured_league({ db, lid, year })

  const teams = await db('teams').where({ lid, year })
  const team_name_by_tid = new Map(teams.map((team) => [team.uid, team.name]))
  const matchups = await db('matchups')
    .where({ lid, year })
    .orderBy('week')
    .orderBy('uid')

  const frontmatter = build_frontmatter({
    type: 'league_schedule',
    fields: {
      canonical_url: doc_url(base_url, { lid, view: 'schedule' }),
      league_id: league.uid,
      league_name: league.name,
      year
    },
    related: {
      parent: doc_url(base_url, { lid }),
      related: [doc_url(base_url, { lid, view: 'rules' })]
    }
  })

  const phase = resolve_current_phase({ league })
  const banner = `${heading(1, `${league.name} — Schedule (${year})`)}\n\nCurrent phase: **${phase}**.`

  const calendar = build_league_calendar({ league })
  const calendar_section = section(
    'League calendar',
    calendar.length
      ? markdown_table(
          ['Date', 'Event', 'Status'],
          calendar.map((event) => [
            format_date_et(event.date_unix),
            event.label,
            event.status
          ])
        )
      : '_No calendar dates configured yet._'
  )

  // Playoffs are best-effort: the playoffs table carries no bracket/seed data,
  // so this reports only the derived week numbers.
  const { wildcard_week, championship_weeks } = derive_playoff_weeks({ league })
  const playoff_lines = []
  if (wildcard_week) {
    playoff_lines.push(`- Wildcard round: week ${wildcard_week}`)
  }
  if (championship_weeks.length) {
    playoff_lines.push(
      `- Championship round: week${
        championship_weeks.length > 1 ? 's' : ''
      } ${championship_weeks.join(', ')}`
    )
  }
  const playoffs_section = section('Playoffs', [
    playoff_lines.length
      ? playoff_lines.join('\n')
      : '_Playoff weeks not configured yet._',
    '_Bracket, seeding, and matchups are not stored; weeks are best-effort._'
  ])

  const matchups_section = section(
    'Matchups',
    render_matchups(matchups, team_name_by_tid)
  )

  const footer = cross_link_footer([
    { label: 'League index', url: doc_url(base_url, { lid }) },
    { label: 'League rules', url: doc_url(base_url, { lid, view: 'rules' }) }
  ])

  return [
    frontmatter,
    banner,
    calendar_section,
    playoffs_section,
    matchups_section,
    footer
  ].join('\n\n')
}
