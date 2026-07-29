import {
  current_season,
  roster_slot_types,
  roster_slot_display_names,
  starting_lineup_slots,
  practice_squad_slots,
  reserve_slots,
  player_tag_display_names,
  player_tag_types,
  transaction_type_display_names
} from '#constants'
import Roster from '#libs-shared/roster.mjs'
import is_before_extension_deadline from '#libs-shared/is-before-extension-deadline.mjs'

import getRoster from '../get-roster.mjs'
import { load_configured_league } from './generate-league-context.mjs'
import get_team_managers from './get-team-managers.mjs'
import get_players from './get-players.mjs'
import { ContextDocError } from './errors.mjs'
import {
  build_frontmatter,
  section,
  heading,
  markdown_table,
  cross_link_footer,
  format_date_et,
  doc_url
} from './markdown.mjs'

const DEFAULT_BASE_URL = 'https://xo.football'

const slot_groups = [
  { title: 'Starters', slots: starting_lineup_slots },
  { title: 'Bench', slots: [roster_slot_types.BENCH] },
  { title: 'Practice Squad', slots: practice_squad_slots },
  { title: 'Injured Reserve', slots: reserve_slots }
]

/**
 * Load the team's week-0 roster (the branch that populates RFA `bid`) so the
 * cap is computed from a bid-aware source. A team with no roster row yet (new
 * team, pre-draft) yields an empty roster rather than an error.
 */
async function load_team_roster({ tid, year, lid, league }) {
  let roster_row
  try {
    roster_row = await getRoster({ tid, week: 0, year })
  } catch (err) {
    if (/No roster found/.test(err.message)) {
      roster_row = { uid: null, tid, week: 0, year, lid, players: [] }
    } else {
      throw err
    }
  }
  return new Roster({ roster: roster_row, league })
}

/**
 * Resolve which salary basis the doc is reporting, so the number a reader sees
 * is never ambiguous about the extension deadline. `Roster` prices every row on
 * the post-extension basis while the extension window is open and on the
 * as-recorded basis once it closes; this mirrors that single decision into a
 * column label, a prose note, and a machine-readable frontmatter field.
 */
function resolve_salary_basis({ league, year }) {
  const before_deadline = is_before_extension_deadline({ league })
  const deadline = league.ext_date
    ? format_date_et(league.ext_date)
    : 'not configured'

  return {
    before_deadline,
    frontmatter_value: before_deadline ? 'post_extension' : 'as_recorded',
    column_label: before_deadline
      ? `${year} Salary (post-extension)`
      : `${year} Salary`,
    note: before_deadline
      ? `Salary basis: **post-extension ${year}**. The extension deadline (${deadline}) has not passed, so every salary below is what the contract will carry in ${year} once extensions and tags are applied — each extension adds $5 over the prior season, a franchise tag is repriced to the position's franchise amount, and a restricted-free-agency tag is priced at its winning bid. Practice-squad contracts are not extended and show their recorded salary. These figures differ from the pre-extension salary currently recorded on the contract, and cap space below is computed on the same post-extension basis.`
      : `Salary basis: **${year} as recorded**. The extension deadline (${deadline}) has passed, so every salary below is the contract's current ${year} salary with extensions and tags already applied. Cap space below is computed on the same basis.`
  }
}

function render_roster_groups(roster, players, salary_basis) {
  const all = roster.all
  return slot_groups
    .map((group) => {
      const rows = all
        .filter((roster_entry) => group.slots.includes(roster_entry.slot))
        .map((roster_entry) => {
          const info = players[roster_entry.pid] || {}
          const tag =
            roster_entry.tag && roster_entry.tag !== player_tag_types.REGULAR
              ? player_tag_display_names[roster_entry.tag]
              : roster_entry.extensions
                ? `Ext x${roster_entry.extensions}`
                : ''
          return [
            roster_slot_display_names[roster_entry.slot] || roster_entry.slot,
            info.name || roster_entry.pid,
            info.primary_position || roster_entry.pos,
            info.nfl_team || '—',
            `$${roster_entry.value}`,
            tag
          ]
        })
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

  const team = await db('teams').where({ uid: tid, lid, year }).first()
  if (!team) {
    throw new ContextDocError(`team ${tid} not found in league ${lid}`, {
      status: 404,
      code: 'team_not_found'
    })
  }

  const managers = await get_team_managers({ db, lid, year })
  const seasonlog = await db('league_team_seasonlogs')
    .where({ lid, tid, year })
    .first()
  const roster = await load_team_roster({ tid, year, lid, league })

  // Resolve player display attributes for the roster and recent transactions.
  const roster_pids = roster.all.map((player) => player.pid)
  const recent_transactions = await db('transactions')
    .where({ lid, tid, year })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(10)
  const players = await get_players({
    db,
    pids: [...roster_pids, ...recent_transactions.map((t) => t.pid)]
  })

  const draft_picks = await db('draft')
    .where({ tid, lid, year })
    .whereNull('pid')
    .orderBy('round')
    .orderBy('pick')

  const matchups = await db('matchups')
    .where({ lid, year })
    .where(function () {
      this.where('hid', tid).orWhere('aid', tid)
    })
    .orderBy('week')
  const other_teams = await db('teams')
    .where({ lid, year })
    .whereNot('uid', tid)
  const team_name_by_tid = new Map([
    [team.uid, team.name],
    ...other_teams.map((t) => [t.uid, t.name])
  ])

  const salary_basis = resolve_salary_basis({ league, year })

  const frontmatter = build_frontmatter({
    type: 'team_context',
    fields: {
      canonical_url: doc_url(base_url, { lid, tid }),
      league_id: league.uid,
      team_id: team.uid,
      team_name: team.name,
      year,
      salary_basis: salary_basis.frontmatter_value,
      salary_year: year,
      extension_deadline: league.ext_date
        ? new Date(Number(league.ext_date) * 1000).toISOString()
        : null
    },
    related: {
      parent: doc_url(base_url, { lid }),
      related: [
        doc_url(base_url, { lid, view: 'rules' }),
        doc_url(base_url, { lid, view: 'schedule' })
      ]
    }
  })

  const manager = (managers[team.uid] || []).join(', ') || '—'
  const division =
    league[`division_${team.div}_name`] ||
    (team.div ? `Division ${team.div}` : '—')
  const record = seasonlog
    ? `${seasonlog.wins || 0}-${seasonlog.losses || 0}-${seasonlog.ties || 0}`
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
          `$${roster.availableCap} of $${league.cap}`
        ],
        ['FAAB remaining', `$${team.faab}`]
      ]
    )
  ])

  const roster_section = section('Roster', [
    salary_basis.note,
    render_roster_groups(roster, players, salary_basis)
  ])

  const picks_section = section(
    'Unused draft picks',
    draft_picks.length
      ? markdown_table(
          ['Round', 'Pick'],
          draft_picks.map((pick) => [
            pick.round,
            pick.pick_str || pick.pick || '—'
          ])
        )
      : '_No unused draft picks._'
  )

  const schedule_rows = matchups.map((matchup) => {
    const is_home = matchup.hid === tid
    const opponent_tid = is_home ? matchup.aid : matchup.hid
    const opponent =
      team_name_by_tid.get(opponent_tid) || `Team ${opponent_tid}`
    const own_points = Number(is_home ? matchup.hp : matchup.ap)
    const opp_points = Number(is_home ? matchup.ap : matchup.hp)
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
            format_date_et(t.timestamp),
            transaction_type_display_names[t.type] || `Type ${t.type}`,
            t.pid ? players[t.pid]?.name || t.pid : '—',
            `$${t.value}`
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
    ...other_teams.map((t) => ({
      label: `Team: ${t.name}`,
      url: doc_url(base_url, { lid, tid: t.uid })
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
