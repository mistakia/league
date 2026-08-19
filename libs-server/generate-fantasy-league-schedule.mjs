import { current_season } from '#constants'

// Build a Qualifying Season schedule from an ORDERED list of teams.
//
// This function contains no randomness. That is the point of it: the draw
// happens outside, against a predetermined future Ethereum block, and its whole
// output is the ORDER of the list handed in here. Anyone holding the published
// block hash and the published input order can reproduce this schedule exactly,
// which they could not do while the shuffle lived in here behind a private seed.
//
// Two structures are lawful, and they are the two Article V Section 13 prescribes:
//
//   NO DIVISIONS (ten teams). Every team plays every other once by the circle
//   method -- nine weeks -- and the season is filled out by replaying the first
//   weeks of that round robin. At fourteen weeks that replays five, so every
//   team ends with nine opponents once and five of them twice, and the doubled
//   pairing is symmetric because it is literally the same week again.
//
//   FOUR DIVISIONS (twelve teams). Retained for the twelve-team case Section
//   13(b) prescribes. Note this construction predates Amendment XL and does not
//   yet implement 13(f)'s twelve-team split (each divisional opponent twice,
//   each of the nine others once, one of them twice); it needs rebuilding before
//   the league next expands.
//
// A team's `division` is null when the league has no Divisions. Anything else --
// two divisions, a mixed population, an odd team count -- throws rather than
// emitting a partial season, because a schedule the constitution does not
// describe is worse than no schedule.

// Round-robin pairing by the circle method: one team is fixed and the rest
// rotate, producing n-1 weeks in which every team plays every other exactly
// once.
const get_round_robin_sched = (teams) => {
  const rotation = [...teams]
  const weeks = []

  for (let week_num = 0; week_num < rotation.length - 1; week_num++) {
    const week = []

    for (let i = 0; i < rotation.length / 2; i++) {
      const team_a = rotation[i]
      const team_b = rotation[rotation.length - 1 - i]

      // alternate home and away by week so the split stays even
      week.push(
        week_num % 2 === 0
          ? { home: team_a, away: team_b }
          : { home: team_b, away: team_a }
      )
    }

    weeks.push(week)
    rotation.splice(1, 0, rotation.pop())
  }

  return weeks
}

const get_inter_sched = (div1, div2, div_offsets) => {
  const div_size = div1.length
  const weeks = Array.from({ length: div_offsets.length }, () => [])

  for (let week_num = 0; week_num < div_offsets.length; week_num++) {
    const offset = div_offsets[week_num]

    for (let i = 0; i < div_size; i++) {
      weeks[week_num].push({
        home: div1[i],
        away: div2[(i + offset) % div_size]
      })
    }
  }

  return weeks
}

const get_intra_sched = (div1, div2, div_offset = 1) => {
  const div_size = div1.length
  const weeks = Array.from({ length: div_size }, () => [])

  for (let week_num = 0; week_num < div_size; week_num++) {
    for (let x1 = 0; x1 < div_size; x1++) {
      let y1 = (week_num - x1) % div_size
      y1 = y1 < 0 ? div_size + y1 : y1 // handle negative index
      const x2 = (x1 + div_offset) % div_size
      let y2 = (week_num - x1 + div_offset) % div_size
      y2 = y2 < 0 ? div_size + y2 : y2 // handle negative index

      if (x1 === y1) {
        weeks[week_num].push({ home: div1[x1], away: div2[x2] })
      } else {
        if (x1 > y1) {
          weeks[week_num].push({ home: div1[x1], away: div1[y1] })
        }

        if (x2 > y2) {
          weeks[week_num].push({ home: div2[x2], away: div2[y2] })
        }
      }
    }
  }

  return weeks
}

const group_by_division = (teams) => {
  const undivided = teams.filter(
    (team) => team.division === null || team.division === undefined
  )

  if (undivided.length === teams.length) return null

  if (undivided.length) {
    throw new Error(
      `${undivided.length} of ${teams.length} teams carry no division; a league either ` +
        'has Divisions or it does not'
    )
  }

  const divisions = new Map()
  for (const team of teams) {
    if (!divisions.has(team.division)) divisions.set(team.division, [])
    divisions.get(team.division).push(team)
  }

  return divisions
}

/**
 * @param {object[]} teams - ordered array of { uid, division }; the order is the
 *   draw result and fully determines the schedule
 * @returns {Array<Array<{ home: Object, away: Object }>>} one entry per
 *   Qualifying Season week
 */
const generate_fantasy_league_schedule = (teams) => {
  const num_weeks = current_season.regularSeasonFinalWeek

  if (teams.length % 2 !== 0) {
    throw new Error(
      `cannot schedule an odd number of teams (${teams.length}) -- a week would leave one unpaired`
    )
  }

  const divisions = group_by_division(teams)

  if (divisions === null) {
    // Replay the round robin from its start until the season is covered. Every
    // team meets every other once before any opponent is repeated. The replay
    // reverses home and away, so a pairing played twice is hosted once by each
    // side -- and the round robin's own home/away split is not compounded.
    const round_robin = get_round_robin_sched(teams)
    const schedule = []
    while (schedule.length < num_weeks) {
      const lap = Math.floor(schedule.length / round_robin.length)
      const week = round_robin[schedule.length % round_robin.length]
      schedule.push(
        lap % 2 === 0
          ? week
          : week.map((matchup) => ({ home: matchup.away, away: matchup.home }))
      )
    }
    return schedule
  }

  if (divisions.size !== 4) {
    throw new Error(
      `unsupported division count: ${divisions.size}. Article V Section 13 prescribes no ` +
        'Divisions at ten teams and four at twelve; nothing else is scheduled here.'
    )
  }

  const div_keys = [...divisions.keys()].sort((a, b) => a - b)
  const [div1, div2, div3, div4] = div_keys.map((key) => divisions.get(key))

  const sizes = new Set([div1.length, div2.length, div3.length, div4.length])
  if (sizes.size !== 1) {
    throw new Error(
      `divisions are uneven (${div_keys.map((key) => divisions.get(key).length).join('/')})`
    )
  }

  const schedule = []

  // two sets of intra division matchups for each division
  const intra_div1 = get_intra_sched(div1, div2)
  const intra_div2 = get_intra_sched(div3, div4)
  for (let i = 0; i < intra_div1.length; i++) {
    schedule.push([...intra_div1[i], ...intra_div2[i]])
  }

  const intra_div3 = get_intra_sched(div1, div3)
  const intra_div4 = get_intra_sched(div2, div4)
  for (let i = 0; i < intra_div3.length; i++) {
    schedule.push([...intra_div3[i], ...intra_div4[i]])
  }

  // one set of inter division matchups for each division
  const inter_div1 = get_inter_sched(div1, div2, [1, 2, 3])
  const inter_div2 = get_inter_sched(div3, div4, [1, 2, 3])
  for (let i = 0; i < inter_div1.length; i++) {
    schedule.push([...inter_div1[i], ...inter_div2[i]])
  }

  const inter_div3 = get_inter_sched(div1, div3, [1, 2, 3])
  const inter_div4 = get_inter_sched(div2, div4, [1, 2, 3])
  for (let i = 0; i < inter_div3.length; i++) {
    schedule.push([...inter_div3[i], ...inter_div4[i]])
  }

  const inter_div5 = get_inter_sched(div1, div4, [1, 2, 3])
  const inter_div6 = get_inter_sched(div2, div3, [1, 2, 3])
  while (schedule.length < num_weeks) {
    schedule.push([...inter_div5.shift(), ...inter_div6.shift()])
  }

  return schedule.slice(0, num_weeks)
}

export default generate_fantasy_league_schedule
