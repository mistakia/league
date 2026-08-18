import {
  roster_slot_types,
  roster_slot_display_names,
  starting_lineup_slots,
  practice_squad_slots,
  reserve_slots,
  player_tag_display_names,
  player_tag_types
} from '#constants'
import Roster from '#libs-shared/roster.mjs'

import getRoster from '../get-roster.mjs'
import get_players from './get-players.mjs'

// Roster presentation groups, in the order every doc renders them. The team doc
// renders one table per group; the rosters page and CSV carry the group as a
// column so a reader can separate the active roster from the practice squad
// without knowing the numeric slot codes.
export const slot_groups = [
  { title: 'Starters', slots: starting_lineup_slots },
  { title: 'Bench', slots: [roster_slot_types.BENCH] },
  { title: 'Practice Squad', slots: practice_squad_slots },
  { title: 'Injured Reserve', slots: reserve_slots }
]

const group_title_for_slot = (slot) => {
  const group = slot_groups.find((candidate) => candidate.slots.includes(slot))
  return group ? group.title : 'Other'
}

/**
 * Load one team's week-0 roster (the branch that populates the
 * restricted-free-agency `bid`, which pricing depends on) as a priced `Roster`.
 * A team with no roster row yet (new team, pre-draft) yields an empty roster
 * rather than an error.
 */
export async function load_team_roster({ tid, year, lid, league }) {
  let roster_row
  try {
    roster_row = await getRoster({ tid, week: 0, year })
  } catch (err) {
    if (/No roster found/.test(err.message)) {
      roster_row = {
        uid: null,
        tid,
        week: 0,
        season_year: year,
        lid,
        players: []
      }
    } else {
      throw err
    }
  }
  return new Roster({ roster: roster_row, league })
}

/**
 * Flatten a priced roster into display rows: slot and tag resolved to their
 * display names, pid resolved to a player name, salary carrying whichever basis
 * `Roster` applied. Rows are ordered by presentation group so every rendering
 * of a roster reads in the same order.
 */
export function build_roster_rows({ team, roster, players }) {
  return roster.all
    .map((roster_entry) => {
      const info = players[roster_entry.pid] || {}
      const is_tagged =
        roster_entry.tag && roster_entry.tag !== player_tag_types.REGULAR
      return {
        tid: team.team_id,
        team_name: team.name,
        group: group_title_for_slot(roster_entry.slot),
        slot: roster_slot_display_names[roster_entry.slot] || roster_entry.slot,
        pid: roster_entry.pid,
        name: info.name || roster_entry.pid,
        pos: info.primary_position || roster_entry.pos,
        nfl_team: info.nfl_team || null,
        salary: roster_entry.player_salary,
        tag: is_tagged ? player_tag_display_names[roster_entry.tag] : null,
        extensions: roster_entry.extensions || 0
      }
    })
    .sort(
      (a, b) =>
        slot_groups.findIndex((group) => group.title === a.group) -
          slot_groups.findIndex((group) => group.title === b.group) ||
        b.salary - a.salary
    )
}

/**
 * Load every team's roster for a league in one pass, priced and flattened. The
 * rosters page and the rosters CSV both render from this, so a reader comparing
 * the two never sees two different roster states.
 */
export default async function load_league_rosters({ db, lid, year, league }) {
  const teams = await db('teams')
    .where({ lid, season_year: year })
    .orderBy('team_id')

  const rosters = await Promise.all(
    teams.map(async (team) => ({
      team,
      roster: await load_team_roster({ tid: team.team_id, year, lid, league })
    }))
  )

  const players = await get_players({
    db,
    pids: rosters.flatMap(({ roster }) =>
      roster.all.map((roster_entry) => roster_entry.pid)
    )
  })

  return rosters.map(({ team, roster }) => ({
    team,
    roster,
    rows: build_roster_rows({ team, roster, players })
  }))
}
