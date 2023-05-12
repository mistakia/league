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

  const div_north_team_1 = divisions[0][0]
  const div_north_team_2 = divisions[0][1]
  const div_north_team_3 = divisions[0][2]
  const div_east_team_1 = divisions[1][0]
  const div_east_team_2 = divisions[1][1]
  const div_east_team_3 = divisions[1][2]
  const div_south_team_1 = divisions[2][0]
  const div_south_team_2 = divisions[2][1]
  const div_south_team_3 = divisions[2][2]
  const div_west_team_1 = divisions[3][0]
  const div_west_team_2 = divisions[3][1]
  const div_west_team_3 = divisions[3][2]

  const weeks = []

  // week 1
  weeks.push([
    { away: div_north_team_2, home: div_north_team_1 },
    { away: div_south_team_2, home: div_north_team_3 },
    { away: div_east_team_2, home: div_east_team_1 },
    { away: div_west_team_2, home: div_east_team_3 },
    { away: div_south_team_3, home: div_south_team_1 },
    { away: div_west_team_3, home: div_west_team_1 }
  ])

  // week 2
  weeks.push([
    { away: div_north_team_3, home: div_north_team_1 },
    { away: div_east_team_2, home: div_north_team_2 },
    { away: div_east_team_1, home: div_east_team_3 },
    { away: div_south_team_2, home: div_south_team_3 },
    { away: div_south_team_1, home: div_west_team_1 },
    { away: div_west_team_2, home: div_west_team_3 }
  ])

  // week 3
  weeks.push([
    { away: div_north_team_2, home: div_north_team_3 },
    { away: div_north_team_1, home: div_east_team_1 },
    { away: div_east_team_3, home: div_east_team_2 },
    { away: div_west_team_3, home: div_south_team_1 },
    { away: div_west_team_1, home: div_south_team_2 },
    { away: div_south_team_3, home: div_west_team_2 }
  ])

  // week 4
  weeks.push([
    { away: div_east_team_2, home: div_north_team_1 },
    { away: div_east_team_1, home: div_north_team_2 },
    { away: div_north_team_3, home: div_east_team_3 },
    { away: div_west_team_2, home: div_south_team_1 },
    { away: div_west_team_1, home: div_south_team_3 },
    { away: div_south_team_2, home: div_west_team_3 }
  ])

  // week 5
  weeks.push([
    { away: div_north_team_3, home: div_north_team_2 },
    { away: div_east_team_3, home: div_east_team_1 },
    { away: div_south_team_1, home: div_east_team_2 },
    { away: div_south_team_3, home: div_south_team_2 },
    { away: div_west_team_1, home: div_west_team_2 },
    { away: div_north_team_1, home: div_west_team_3 }
  ])

  // week 6
  weeks.push([
    { away: div_east_team_3, home: div_north_team_1 },
    { away: div_east_team_1, home: div_north_team_3 },
    { away: div_west_team_1, home: div_east_team_2 },
    { away: div_north_team_2, home: div_south_team_1 },
    { away: div_south_team_2, home: div_west_team_2 },
    { away: div_south_team_3, home: div_west_team_3 }
  ])

  // week 7
  weeks.push([
    { away: div_south_team_3, home: div_north_team_3 }, // BYE WEEK
    { away: div_west_team_2, home: div_east_team_1 },
    { away: div_north_team_1, home: div_south_team_1 }, // BYE WEEK
    { away: div_east_team_2, home: div_south_team_2 },
    { away: div_east_team_3, home: div_west_team_1 },
    { away: div_north_team_2, home: div_west_team_3 }
  ])

  // week 8
  weeks.push([
    { away: div_west_team_2, home: div_north_team_1 },
    { away: div_east_team_3, home: div_north_team_2 },
    { away: div_north_team_3, home: div_east_team_2 },
    { away: div_south_team_1, home: div_south_team_2 },
    { away: div_east_team_1, home: div_south_team_3 },
    { away: div_west_team_1, home: div_west_team_3 }
  ])

  // week 9
  weeks.push([
    { away: div_south_team_1, home: div_east_team_1 },
    { away: div_south_team_3, home: div_east_team_2 },
    { away: div_west_team_3, home: div_east_team_3 }, // BYE WEEK
    { away: div_north_team_1, home: div_south_team_2 },
    { away: div_north_team_3, home: div_west_team_1 },
    { away: div_north_team_2, home: div_west_team_2 }
  ])

  // week 10
  weeks.push([
    { away: div_south_team_3, home: div_north_team_1 },
    { away: div_west_team_1, home: div_north_team_2 },
    { away: div_south_team_1, home: div_north_team_3 },
    { away: div_west_team_3, home: div_east_team_1 },
    { away: div_east_team_3, home: div_south_team_2 },
    { away: div_east_team_2, home: div_west_team_2 } // BYE WEEK
  ])

  // week 11
  weeks.push([
    { away: div_west_team_3, home: div_east_team_2 },
    { away: div_south_team_1, home: div_east_team_3 },
    { away: div_east_team_1, home: div_south_team_2 },
    { away: div_north_team_2, home: div_south_team_3 },
    { away: div_north_team_1, home: div_west_team_1 },
    { away: div_north_team_3, home: div_west_team_2 }
  ])

  // week 12
  weeks.push([
    { away: div_north_team_1, home: div_north_team_2 },
    { away: div_east_team_1, home: div_east_team_2 },
    { away: div_south_team_2, home: div_south_team_1 },
    { away: div_east_team_3, home: div_south_team_3 },
    { away: div_west_team_2, home: div_west_team_1 },
    { away: div_north_team_3, home: div_west_team_3 }
  ])

  // week 13
  weeks.push([
    { away: div_south_team_2, home: div_north_team_2 },
    { away: div_north_team_1, home: div_north_team_3 },
    { away: div_west_team_1, home: div_east_team_1 }, // BYE WEEK
    { away: div_east_team_2, home: div_east_team_3 },
    { away: div_south_team_1, home: div_south_team_3 },
    { away: div_west_team_3, home: div_west_team_2 }
  ])

  // week 14
  weeks.push([
    { away: div_south_team_1, home: div_north_team_1 },
    { away: div_south_team_2, home: div_north_team_2 },
    { away: div_south_team_3, home: div_north_team_3 }, // BYE WEEK
    { away: div_west_team_1, home: div_east_team_1 },
    { away: div_west_team_2, home: div_east_team_2 },
    { away: div_west_team_3, home: div_east_team_3 }
  ])

  return shuffleArray(weeks)
}

export default getSchedule
