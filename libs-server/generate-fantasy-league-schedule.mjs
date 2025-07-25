import ed25519 from '@trashman/ed25519-blake2b'

import { constants } from '#libs-shared'

// fully random by @BetonMAN
// random_seed = ethereum_block_timestsamp + ethereum_block_reward
const shuffleArray = (arr, random_seed = Math.random() * 1000000) =>
  arr
    .map((a, index) => [
      ed25519.hash(`${random_seed}${index}`).toString('hex'),
      a
    ])
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((a) => a[1])

const getInterSched = (div1, div2, divOffsets) => {
  const divSize = div1.length
  const weeks = Array.from({ length: divOffsets.length }, () => [])

  for (let weekNum = 0; weekNum < divOffsets.length; weekNum++) {
    const offset = divOffsets[weekNum]

    for (let i = 0; i < divSize; i++) {
      const n1 = i
      const n2 = (i + offset) % divSize

      weeks[weekNum].push({ home: div1[n1], away: div2[n2] })
    }
  }

  return weeks
}

const getIntraSched = (div1, div2, divOffset = 1) => {
  const divSize = div1.length
  const weeks = Array.from({ length: divSize }, () => [])

  for (let weekNum = 0; weekNum < divSize; weekNum++) {
    for (let x1 = 0; x1 < divSize; x1++) {
      let y1 = (weekNum - x1) % divSize
      y1 = y1 < 0 ? divSize + y1 : y1 // handle negative index
      const x2 = (x1 + divOffset) % divSize
      let y2 = (weekNum - x1 + divOffset) % divSize
      y2 = y2 < 0 ? divSize + y2 : y2 // handle negative index

      if (x1 === y1) {
        weeks[weekNum].push({ home: div1[x1], away: div2[x2] })
      } else {
        if (x1 > y1) {
          weeks[weekNum].push({ home: div1[x1], away: div1[y1] })
        }

        if (x2 > y2) {
          weeks[weekNum].push({ home: div2[x2], away: div2[y2] })
        }
      }
    }
  }

  return weeks
}

// teams should be an array of objects with a uid and div property, it can be of length 10 or 12
// num_divisions should be 2 or 4
// teams in the same division should play each other exactly twice
// teams in different divisions should play each other either once or twice
// should return an array of 14 arrays of matchup objects with home and away properties
// each week there should be teams.length / 2 matchups

const has_duplicate_consecutive_weeks = (schedule) => {
  for (let i = 0; i < schedule.length - 1; i++) {
    const week1 = schedule[i]
    const week2 = schedule[i + 1]

    if (week1.length !== week2.length) continue

    const week1_matches = new Set(
      week1.map((match) => `${match.home.uid}-${match.away.uid}`)
    )
    const week2_matches = new Set(
      week2.map((match) => `${match.home.uid}-${match.away.uid}`)
    )

    if (
      week1_matches.size === week2_matches.size &&
      [...week1_matches].every((match) => week2_matches.has(match))
    ) {
      return true
    }
  }
  return false
}

const generate_fantasy_league_schedule = (teams, random_seed) => {
  const num_weeks = constants.season.regularSeasonFinalWeek

  const divisions = {}
  for (const team of teams) {
    if (!divisions[team.div]) divisions[team.div] = []
    divisions[team.div].push(team)
  }

  // shuffle each division
  for (const div of Object.keys(divisions)) {
    divisions[div] = shuffleArray(divisions[div], random_seed)
  }

  const num_divisions = Object.keys(divisions).length
  const divKeys = Object.keys(divisions)
  let schedule = []

  if (num_divisions === 2) {
    const div1 = divisions[divKeys[0]]
    const div2 = divisions[divKeys[1]]

    // two sets of intra division matchups
    const intraDiv1 = getIntraSched(div1, div2)
    intraDiv1.forEach((week) => schedule.push(week))

    const intraDiv2 = getIntraSched(div1, div2)
    intraDiv2.forEach((week) => schedule.push(week))

    // one set of inter division matchups
    const interDiv = getInterSched(div1, div2, [2, 3, 4, 5, 1])
    while (schedule.length < num_weeks) {
      const week = interDiv.shift()
      schedule.push(week)
    }
  } else if (num_divisions === 4) {
    const div1 = divisions[divKeys[0]]
    const div2 = divisions[divKeys[1]]
    const div3 = divisions[divKeys[2]]
    const div4 = divisions[divKeys[3]]

    // two sets of intra division matchups for each division
    const intraDiv1 = getIntraSched(div1, div2)
    const intraDiv2 = getIntraSched(div3, div4)

    for (let i = 0; i < intraDiv1.length; i++) {
      const week = []
      week.push(...intraDiv1[i])
      week.push(...intraDiv2[i])
      schedule.push(week)
    }

    const intraDiv3 = getIntraSched(div1, div3)
    const intraDiv4 = getIntraSched(div2, div4)

    for (let i = 0; i < intraDiv3.length; i++) {
      const week = []
      week.push(...intraDiv3[i])
      week.push(...intraDiv4[i])
      schedule.push(week)
    }

    // one set of inter division matchups for each division
    const interDiv1 = getInterSched(div1, div2, [1, 2, 3])
    const interDiv2 = getInterSched(div3, div4, [1, 2, 3])

    for (let i = 0; i < interDiv1.length; i++) {
      const week = []
      week.push(...interDiv1[i])
      week.push(...interDiv2[i])
      schedule.push(week)
    }

    const interDiv3 = getInterSched(div1, div3, [1, 2, 3])
    const interDiv4 = getInterSched(div2, div4, [1, 2, 3])

    for (let i = 0; i < interDiv3.length; i++) {
      const week = []
      week.push(...interDiv3[i])
      week.push(...interDiv4[i])
      schedule.push(week)
    }

    const interDiv5 = getInterSched(div1, div4, [1, 2, 3])
    const interDiv6 = getInterSched(div2, div3, [1, 2, 3])

    while (schedule.length < num_weeks) {
      const week = []
      week.push(...interDiv5.shift())
      week.push(...interDiv6.shift())
      schedule.push(week)
    }
  }

  // Final shuffle to avoid consecutive duplicate weeks
  let attempts = 0
  const max_attempts = 10

  do {
    schedule = shuffleArray(schedule, random_seed + attempts)
    attempts++
  } while (has_duplicate_consecutive_weeks(schedule) && attempts < max_attempts)

  return schedule
}

export default generate_fantasy_league_schedule
