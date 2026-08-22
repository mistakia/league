/**
 * Resolve the NFL team for a gamelog that exists only because the player took
 * snaps -- he recorded no counting stat, so nothing in the play-stat feed names
 * his team for that game.
 *
 * `nfl_snaps` carries only (esbid, play_id, gsis_it_player_id, season_year). There is
 * no team column on it, so the snap row cannot name the side by itself and the
 * team has to be established from something else. Two sources are available,
 * and both are properties of the GAME rather than of the player today -- which
 * is the whole point. The writer previously fell back to
 * `player.current_nfl_team`, a property of the player NOW: it resolved to 'INA'
 * for a retired player and to the wrong franchise for an active one who had
 * since changed teams.
 *
 *   R -- roster continuity. The player's other gamelogs in the same season,
 *        restricted to the two teams that played this game. Measured error
 *        0.021% (4 / 18,996) against the play-stat oracle described below.
 *
 *   S -- scrimmage possession. Join the player's snaps to `nfl_plays`, keep
 *        only PASS/RUSH plays, take the modal `offense_nfl_team` /
 *        `defense_nfl_team`, and pick the side his position group puts him on.
 *        Measured error 0.409% (72 / 17,591).
 *
 * Both were scored against `nfl_play_stats.nfl_team`, which is the feed's own
 * statement of the player's team -- a defensive player's tackle rows carry HIS
 * team, not the possession team -- and so is independent of `nfl_snaps`, of
 * `player_gamelogs`, and of this code. `player_gamelogs.nfl_team` is NOT a
 * usable oracle: it is written by the code under test, and scoring against it
 * put the apparent error rate at 4.4% almost entirely from ITS errors.
 *
 * S is the weaker source for two structural reasons, both visible in the
 * disagreements. A player listed at an offensive position who actually plays
 * defense (Tony Lippett, a 2016 WR converted to cornerback; Lawrence Thomas, a
 * listed RB playing defensive line) gets the opposing team, because the side
 * lookup is keyed on his ROSTER position rather than on how he was used. And
 * `player.gsis_it_player_id` can name an earlier player of the same name, so
 * the snaps joined may not be his at all. Where the two sources disagree, R is
 * right 68 times out of 70.
 *
 * Hence the precedence: agreement first, then R, then S, and a refusal when
 * neither source speaks. A refusal is deliberate -- a wrong team corrupts every
 * team-scoped aggregate downstream, which is strictly worse than a gamelog that
 * does not exist.
 */

import db from '#db'
import { fixTeam } from '#libs-shared'
import { get_position_group, scrimmage_play_types } from '#constants'

// A team value that cannot be one of this game's two sides is not evidence.
const UNUSABLE_TEAMS = new Set(['INA', ''])

const OFFENSE_POSITION_GROUPS = new Set(['QB', 'RB', 'WR', 'TE', 'OL'])
const DEFENSE_POSITION_GROUPS = new Set(['DL', 'LB', 'DB'])

// Only scrimmage plays carry a possession team that means "this player's side".
// On a punt or a kickoff `offense_nfl_team` is the KICKING team, so both the
// coverage unit and the return unit are on the field for a play whose
// possession says nothing about which of them a given player belongs to.
// The set itself is shared -- see libs-shared/constants/play-type-constants.mjs.

// Below this, a modal possession is one or two plays and the resolver is
// reading noise -- measured error on S falls from 0.409% to 0.185% at 3.
const MINIMUM_SCRIMMAGE_SNAPS = 3

export const is_usable_nfl_team = (nfl_team) =>
  Boolean(nfl_team) && !UNUSABLE_TEAMS.has(nfl_team)

const side_of_ball_for_position = (primary_position) => {
  let position_group
  try {
    position_group = get_position_group(primary_position)
  } catch (err) {
    // an unmapped vendor spelling is not a reason to fail the whole run; it
    // just means this source cannot speak for this player
    return null
  }
  if (!position_group) return null
  if (OFFENSE_POSITION_GROUPS.has(position_group)) return 'offense'
  if (DEFENSE_POSITION_GROUPS.has(position_group)) return 'defense'
  // K / P / LS / DST play only on units whose possession does not name a side
  return null
}

const modal_value = ({ rows, value_field, weight_field }) => {
  if (!rows || !rows.length) return null
  const weight_by_value = new Map()
  let total_weight = 0
  for (const row of rows) {
    const value = row[value_field]
    const weight = Number(row[weight_field])
    weight_by_value.set(value, (weight_by_value.get(value) || 0) + weight)
    total_weight += weight
  }
  const ranked = [...weight_by_value.entries()].sort((a, b) => b[1] - a[1])
  return { value: ranked[0][0], weight: ranked[0][1], total_weight }
}

/**
 * Build a resolver over a fixed candidate set. The candidates are read up front
 * so the three supporting queries run once per invocation rather than per row.
 *
 * Each candidate needs `pid`, `esbid`, `gsis_it_player_id` and
 * `primary_position`.
 */
export const create_snap_gamelog_team_resolver = async ({
  candidates,
  season_year
}) => {
  const esbids = [...new Set(candidates.map((c) => c.esbid))]
  const pids = [...new Set(candidates.map((c) => c.pid))]

  if (!esbids.length) {
    return () => ({ nfl_team: null, method: null, reason: 'no_candidates' })
  }

  const games = await db('nfl_games')
    .select('esbid', 'home_nfl_team', 'away_nfl_team')
    .whereIn('esbid', esbids)
  // `nfl_games` keeps the abbreviation the franchise carried at the time (SD,
  // STL, OAK) while `player_gamelogs` stores the conformed one, so every
  // comparison here has to be on the fixTeam'd value or a Chargers game looks
  // like it has no team in common with its own gamelogs.
  const game_by_esbid = new Map(
    games.map((game) => [
      game.esbid,
      {
        home_nfl_team: fixTeam(game.home_nfl_team),
        away_nfl_team: fixTeam(game.away_nfl_team)
      }
    ])
  )

  const scrimmage_possession_rows = await db('nfl_snaps')
    .select(
      'nfl_snaps.esbid',
      'nfl_snaps.gsis_it_player_id',
      'nfl_plays.offense_nfl_team',
      'nfl_plays.defense_nfl_team'
    )
    .count('* as snaps')
    .join('nfl_plays', function () {
      this.on('nfl_plays.esbid', 'nfl_snaps.esbid').andOn(
        'nfl_plays.play_id',
        'nfl_snaps.play_id'
      )
    })
    .whereIn('nfl_snaps.esbid', esbids)
    .where('nfl_snaps.season_year', season_year)
    .whereIn('nfl_plays.play_type', scrimmage_play_types)
    .whereNotNull('nfl_plays.offense_nfl_team')
    .whereNotNull('nfl_plays.defense_nfl_team')
    .groupBy(
      'nfl_snaps.esbid',
      'nfl_snaps.gsis_it_player_id',
      'nfl_plays.offense_nfl_team',
      'nfl_plays.defense_nfl_team'
    )

  const scrimmage_possession_index = new Map()
  for (const row of scrimmage_possession_rows) {
    const key = `${row.esbid}_${row.gsis_it_player_id}`
    if (!scrimmage_possession_index.has(key)) {
      scrimmage_possession_index.set(key, [])
    }
    scrimmage_possession_index.get(key).push({
      ...row,
      offense_nfl_team: fixTeam(row.offense_nfl_team),
      defense_nfl_team: fixTeam(row.defense_nfl_team)
    })
  }

  const continuity_rows = await db('player_gamelogs')
    .select('pid', 'esbid', 'nfl_team')
    .whereIn('pid', pids)
    .where('season_year', season_year)
    .whereNotNull('nfl_team')
    .whereNotIn('nfl_team', [...UNUSABLE_TEAMS])
  const continuity_index = new Map()
  for (const row of continuity_rows) {
    if (!continuity_index.has(row.pid)) continuity_index.set(row.pid, [])
    continuity_index.get(row.pid).push(row)
  }

  return ({ pid, esbid, gsis_it_player_id, primary_position }) => {
    const game = game_by_esbid.get(esbid)
    if (!game) {
      return { nfl_team: null, method: null, reason: 'game_not_found' }
    }

    const is_in_game = (nfl_team) =>
      Boolean(nfl_team) &&
      (fixTeam(nfl_team) === game.home_nfl_team ||
        fixTeam(nfl_team) === game.away_nfl_team)

    // --- R: roster continuity -------------------------------------------
    // The player's OTHER gamelogs this season. A player who appears in this
    // game is on one of these two rosters, so his team in any other week of
    // the same season settles it -- unless he played for both sides of this
    // matchup during the season, which is the one case this must not guess.
    let continuity_nfl_team = null
    let continuity_support = 0
    const other_gamelogs = (continuity_index.get(pid) || []).filter(
      (row) => row.esbid !== esbid && is_in_game(row.nfl_team)
    )
    if (other_gamelogs.length) {
      const distinct = new Set(
        other_gamelogs.map((row) => fixTeam(row.nfl_team))
      )
      if (distinct.size === 1) {
        continuity_nfl_team = fixTeam(other_gamelogs[0].nfl_team)
        continuity_support = other_gamelogs.length
      }
    }

    // --- S: scrimmage possession ----------------------------------------
    let scrimmage_nfl_team = null
    let scrimmage_snaps = 0
    const side_of_ball = side_of_ball_for_position(primary_position)
    if (side_of_ball) {
      const value_field =
        side_of_ball === 'offense' ? 'offense_nfl_team' : 'defense_nfl_team'
      const modal = modal_value({
        rows: scrimmage_possession_index.get(`${esbid}_${gsis_it_player_id}`),
        value_field,
        weight_field: 'snaps'
      })
      if (
        modal &&
        modal.total_weight >= MINIMUM_SCRIMMAGE_SNAPS &&
        is_in_game(modal.value)
      ) {
        scrimmage_nfl_team = modal.value
        scrimmage_snaps = modal.total_weight
      }
    }

    if (
      continuity_nfl_team &&
      scrimmage_nfl_team &&
      continuity_nfl_team === scrimmage_nfl_team
    ) {
      return {
        nfl_team: continuity_nfl_team,
        method: 'continuity_and_scrimmage',
        continuity_support,
        scrimmage_snaps
      }
    }

    if (continuity_nfl_team) {
      return {
        nfl_team: continuity_nfl_team,
        // a disagreement is recorded rather than hidden: S loses on purpose
        method: scrimmage_nfl_team ? 'continuity_over_scrimmage' : 'continuity',
        continuity_support,
        scrimmage_snaps
      }
    }

    if (scrimmage_nfl_team) {
      return {
        nfl_team: scrimmage_nfl_team,
        method: 'scrimmage',
        continuity_support,
        scrimmage_snaps
      }
    }

    return {
      nfl_team: null,
      method: null,
      reason: side_of_ball
        ? 'no_evidence'
        : 'no_continuity_and_position_not_sided'
    }
  }
}
