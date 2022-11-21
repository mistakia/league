// fully random by @BetonMAN
const shuffleArray = (arr) =>
  arr
    .map((a) => [Math.random(), a])
    .sort((a, b) => a[0] - b[0])
    .map((a) => a[1])

const getSchedule = (teams) => {
  const divs = {}
  for (const team of teams) {
    if (!divs[team.div]) divs[team.div] = []
    divs[team.div].push(team)
  }

  const divisions = []

  for (const div of Object.keys(divs)) {
    const teams = divs[div]
    const shuffled = shuffleArray(teams)
    divisions.push(shuffled)
  }

  const team1 = divisions[0][0]
  const team2 = divisions[0][1]
  const team3 = divisions[0][2]
  const team4 = divisions[1][0]
  const team5 = divisions[1][1]
  const team6 = divisions[1][2]
  const team7 = divisions[2][0]
  const team8 = divisions[2][1]
  const team9 = divisions[2][2]
  const team10 = divisions[3][0]
  const team11 = divisions[3][1]
  const team12 = divisions[3][2]

  const weeks = []

  weeks.push([
    { away: team2, home: team1 },
    { away: team8, home: team3 },
    { away: team5, home: team4 },
    { away: team11, home: team6 },
    { away: team9, home: team7 },
    { away: team12, home: team10 }
  ])

  weeks.push([
    { away: team3, home: team1 },
    { away: team5, home: team2 },
    { away: team4, home: team6 },
    { away: team8, home: team9 },
    { away: team7, home: team10 },
    { away: team11, home: team12 }
  ])

  weeks.push([
    { away: team2, home: team3 },
    { away: team1, home: team4 },
    { away: team6, home: team5 },
    { away: team12, home: team7 },
    { away: team10, home: team8 },
    { away: team9, home: team11 }
  ])

  weeks.push([
    { away: team5, home: team1 },
    { away: team4, home: team2 },
    { away: team3, home: team6 },
    { away: team11, home: team7 },
    { away: team10, home: team9 },
    { away: team8, home: team12 }
  ])

  weeks.push([
    { away: team3, home: team2 },
    { away: team6, home: team4 },
    { away: team7, home: team5 },
    { away: team9, home: team8 },
    { away: team10, home: team11 },
    { away: team1, home: team12 }
  ])

  weeks.push([
    { away: team6, home: team1 },
    { away: team4, home: team3 },
    { away: team10, home: team5 },
    { away: team2, home: team7 },
    { away: team8, home: team11 },
    { away: team9, home: team12 }
  ])

  weeks.push([
    { away: team9, home: team3 },
    { away: team11, home: team4 },
    { away: team1, home: team7 },
    { away: team5, home: team8 },
    { away: team6, home: team10 },
    { away: team2, home: team12 }
  ])

  weeks.push([
    { away: team11, home: team1 },
    { away: team6, home: team2 },
    { away: team3, home: team5 },
    { away: team7, home: team8 },
    { away: team4, home: team9 },
    { away: team10, home: team12 }
  ])

  weeks.push([
    { away: team7, home: team4 },
    { away: team9, home: team5 },
    { away: team12, home: team6 },
    { away: team1, home: team8 },
    { away: team3, home: team10 },
    { away: team2, home: team11 }
  ])

  weeks.push([
    { away: team9, home: team1 },
    { away: team10, home: team2 },
    { away: team7, home: team3 },
    { away: team12, home: team4 },
    { away: team6, home: team8 },
    { away: team5, home: team11 }
  ])

  weeks.push([
    { away: team12, home: team5 },
    { away: team7, home: team6 },
    { away: team4, home: team8 },
    { away: team2, home: team9 },
    { away: team1, home: team10 },
    { away: team3, home: team11 }
  ])

  weeks.push([
    { away: team1, home: team2 },
    { away: team4, home: team5 },
    { away: team8, home: team7 },
    { away: team6, home: team9 },
    { away: team11, home: team10 },
    { away: team3, home: team12 }
  ])

  weeks.push([
    { away: team8, home: team2 },
    { away: team1, home: team3 },
    { away: team10, home: team4 },
    { away: team5, home: team6 },
    { away: team7, home: team9 },
    { away: team12, home: team11 }
  ])

  weeks.push([
    { away: team7, home: team1 },
    { away: team8, home: team2 },
    { away: team9, home: team3 },
    { away: team10, home: team4 },
    { away: team11, home: team5 },
    { away: team12, home: team6 }
  ])

  return shuffleArray(weeks)
}

export default getSchedule
