import { current_season } from '#constants'
import {
  scoring_field_labels,
  starting_lineup_labels,
  roster_limit_labels
} from '#libs-shared/constants/league-settings-labels.mjs'

import { load_configured_league } from './generate-league-context.mjs'
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

const DEFAULT_BASE_URL = 'https://xo.football'

// Human descriptions of the salary-attribution rule, derived from the
// SALARY_ATTRIBUTION_RULE enum in libs-server/roster-asset-lineage/constants.mjs.
const salary_attribution_labels = {
  0: 'No salary cap',
  1: 'Auction budget only',
  2: 'Starting team bears the salary through the season',
  3: 'Salary follows the player to the acquiring team'
}

function render_scoring_section(league) {
  const blocks = []
  for (const [group, labels] of Object.entries(scoring_field_labels)) {
    const rows = Object.entries(labels)
      .filter(
        ([field]) => league[field] !== undefined && league[field] !== null
      )
      .map(([field, label]) => {
        const raw = league[field]
        const value = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : raw
        return [label, value]
      })
    if (rows.length) {
      const title = group.charAt(0).toUpperCase() + group.slice(1)
      blocks.push(
        `${heading(3, title)}\n\n${markdown_table(['Stat', 'Points'], rows)}`
      )
    }
  }
  return blocks.join('\n\n')
}

export default async function generate_league_rules({
  db,
  lid,
  year = current_season.year,
  base_url = DEFAULT_BASE_URL
}) {
  const league = await load_configured_league({ db, lid, year })

  const frontmatter = build_frontmatter({
    type: 'league_rules',
    fields: {
      canonical_url: doc_url(base_url, { lid, view: 'rules' }),
      league_id: league.uid,
      league_name: league.name,
      year
    },
    related: {
      parent: doc_url(base_url, { lid }),
      related: [doc_url(base_url, { lid, view: 'schedule' })]
    }
  })

  const identity = [
    heading(1, `${league.name} — Rules (${year})`),
    lid === CONSTITUTION_LEAGUE_ID &&
      `These are the league's configured format settings. The full governance rules, definitions, and amendment history are in the [League Constitution](${constitution_url(
        base_url
      )}).`
  ]
    .filter(Boolean)
    .join('\n\n')

  // Roster construction: starting slots + bench/PS/IR, then position limits.
  const starting_rows = Object.entries(starting_lineup_labels)
    .filter(([field]) => league[field] !== undefined && league[field] !== null)
    .map(([field, label]) => [label, league[field]])
  const limit_rows = Object.entries(roster_limit_labels)
    .filter(([field]) => league[field] !== undefined && league[field] !== null)
    .map(([field, label]) => [label, league[field]])

  const roster_section = section('Roster construction', [
    `${heading(3, 'Starting lineup')}\n\n${markdown_table(
      ['Slot', 'Count'],
      starting_rows
    )}`,
    `${heading(3, 'Position limits and bench')}\n\n${markdown_table(
      ['Slot', 'Limit'],
      limit_rows
    )}`
  ])

  const scoring_section = section('Scoring', render_scoring_section(league))

  const cap_section = section('Salary cap and free agency budget', [
    markdown_table(
      ['Setting', 'Value'],
      [
        ['Salary cap', `$${league.cap}`],
        ['Free agency budget (FAAB)', `$${league.faab}`],
        ['Minimum bid', `$${league.min_bid}`],
        [
          'Salary attribution rule',
          salary_attribution_labels[league.salary_attribution_rule] ||
            `Rule ${league.salary_attribution_rule}`
        ]
      ]
    )
  ])

  const franchise_section = section('Franchise tag salaries', [
    markdown_table(
      ['Position', 'Salary'],
      [
        ['QB', `$${league.fqb}`],
        ['RB', `$${league.frb}`],
        ['WR', `$${league.fwr}`],
        ['TE', `$${league.fte}`]
      ]
    ),
    `Restricted free agency window: ${format_date_et(
      league.tran_start
    )} to ${format_date_et(
      league.tran_end
    )} (announcement hour ${league.restricted_free_agency_announcement_hour} ET, processing hour ${league.restricted_free_agency_processing_hour} ET).`
  ])

  const footer = cross_link_footer([
    { label: 'League index', url: doc_url(base_url, { lid }) },
    {
      label: 'League schedule',
      url: doc_url(base_url, { lid, view: 'schedule' })
    },
    lid === CONSTITUTION_LEAGUE_ID && {
      label: 'League constitution',
      url: constitution_url(base_url)
    }
  ])

  return [
    frontmatter,
    identity,
    roster_section,
    scoring_section,
    cap_section,
    franchise_section,
    footer
  ].join('\n\n')
}
