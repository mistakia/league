import fetchCheerioObject from 'fetch-cheerio-object'
import { Map } from 'immutable'
import debug from 'debug'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import { isMain } from '#libs-server'

const log = debug('import:footballoutsiders')
debug.enable('import:footballoutsiders')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const urls = [
  {
    type: 'TEAMOFF',
    url: `https://www.footballoutsiders.com/stats/nfl/team-offense/${constants.season.year}`
  },
  {
    type: 'TEAMDEF',
    url: `https://www.footballoutsiders.com/stats/nfl/team-defense/${constants.season.year}`
  },
  {
    type: 'OL',
    url: `https://www.footballoutsiders.com/stats/nfl/offensive-line/${constants.season.year}`
  },
  {
    type: 'DL',
    url: `https://www.footballoutsiders.com/stats/nfl/defensive-line/${constants.season.year}`
  },
  {
    type: 'DRVOFF',
    url: `https://www.footballoutsiders.com/stats/nfl/overall-drive-statsoff/${constants.season.year}`
  },
  {
    type: 'DRVDEF',
    url: `https://www.footballoutsiders.com/stats/nfl/overall-drive-statsdef/${constants.season.year}`
  }
]

const cleanStr = (str) => str.replace(/\n/g, '').replace(/\t/g, '')
let teams = new Map()
const update = (type, data) => {
  switch (type) {
    case 'TEAMOFF': {
      teams = teams.mergeIn([data.TEAM_1], {
        ork: data.RK_0,
        odvoa: data.OFFENSEDVOA_2,
        olw: data.LASTWEEK_3,
        odave: data.OFFENSEDAVE_4,
        opass: data.PASSOFF_6,
        orun: data.RUSHOFF_8
      })
      break
    }

    case 'TEAMDEF': {
      teams = teams.mergeIn([data.TEAM_1], {
        drk: data.RK_0,
        ddvoa: data.DEFENSEDVOA_2,
        dlw: data.LASTWEEK_3,
        ddave: data.DEFENSEDAVE_4,
        dpass: data.PASSDEF_6,
        drun: data.RUSHDEF_8
      })
      break
    }

    case 'OL': {
      const props = Object.keys(data)
      if (props.includes('ALY_10')) {
        teams = teams.mergeIn([data.TEAM_1], {
          olrunley: data.ALY_2,
          olrunlty: data.ALY_4,
          olrunmgy: data.ALY_6,
          olrunrty: data.ALY_8,
          olrunrey: data.ALY_10
        })
      } else if (props.includes('Team_12')) {
        teams = teams.mergeIn([data.Team_1], {
          olrunaly: data['Adj. LineYards_2'],
          olrby: data.RBYards_3,
          olpwr: data.PowerSuccess_4,
          olstf: data.Stuffed_6,
          olrun2y: data['2nd LevelYards_8'],
          olrunofy: data['Open FieldYards_10']
        })

        teams = teams.mergeIn([data.Team_12], {
          olpassrk: data.Rank_13,
          olskrk: data.Sacks_14,
          olskrt: data['AdjustedSack Rate_15']
        })
      }
      break
    }

    case 'DL': {
      const props = Object.keys(data)
      if (props.includes('ALY_10')) {
        teams = teams.mergeIn([data.TEAM_1], {
          dlrunley: data.ALY_2,
          dlrunlty: data.ALY_4,
          dlrunmgy: data.ALY_6,
          dlrunrty: data.ALY_8,
          dlrunrey: data.ALY_10
        })
      } else if (props.includes('Team_12')) {
        teams = teams.mergeIn([data.Team_1], {
          dlrunaly: data['Adj. LineYards_2'],
          dlrby: data.RBYards_3,
          dlpwr: data.PowerSuccess_4,
          dlstf: data.Stuffed_6,
          dlrun2y: data['2nd LevelYards_8'],
          dlrunofy: data['Open FieldYards_10']
        })

        teams = teams.mergeIn([data.Team_12], {
          dlpassrk: data.Rank_13,
          dlskrk: data.Sacks_14,
          dlskrt: data['AdjustedSack Rate_15']
        })
      }
      break
    }

    case 'DRVDEF': {
      const props = Object.keys(data)
      if (props.includes('Avg. Lead_18')) {
        teams = teams.mergeIn([data.Team_0], {
          ddrv: data.Drives_1,
          dtdpdrv: data['TDs/Dr_2'],
          dfgpdrv: data['FG/Dr_4'],
          dpntpdrv: data['Punts/Dr_6'],
          d3opdrv: data['3Outs/Dr_8'],
          dlosko: data['LOS/KO_10'],
          dtdfg: data['TD/FG_12'],
          dptsprz: data['Pts/RZ_14'],
          dtdprz: data['TDs/RZ_16'],
          davgld: data['Avg. Lead_18']
        })
      } else if (props.includes('TOP/Dr_16')) {
        teams = teams.mergeIn([data.Team_0], {
          ddrv: data.Drives_1,
          dypdrv: data['Yds/Dr_2'],
          dptspdrv: data['Pts/Dr_4'],
          dtopdrv: data['TO/Dr_6'],
          dintpdrv: data['INT/Dr_8'],
          dfumpdrv: data['FUM/Dr_10'],
          dlospdrv: data['LOS/Dr_12'],
          dplypdrv: data['Plays/Dr_14'],
          dtoppdrv: data['TOP/Dr_16'],
          ddrvsucc: data.DSR_18
        })
      }
      break
    }

    case 'DRVOFF': {
      const props = Object.keys(data)
      if (props.includes('Avg. Lead_18')) {
        teams = teams.mergeIn([data.Team_0], {
          odrv: data.Drives_1,
          otdpdrv: data['TDs/Dr_2'],
          ofgpdrv: data['FG/Dr_4'],
          opntpdrv: data['Punts/Dr_6'],
          o3opdrv: data['3Outs/Dr_8'],
          olosko: data['LOS/KO_10'],
          otdfg: data['TD/FG_12'],
          optsprz: data['Pts/RZ_14'],
          otdprz: data['TDs/RZ_16'],
          oavgld: data['Avg. Lead_18']
        })
      } else if (props.includes('TOP/Dr_16')) {
        teams = teams.mergeIn([data.Team_0], {
          odrv: data.Drives_1,
          oypdrv: data['Yds/Dr_2'],
          optspdrv: data['Pts/Dr_4'],
          otopdrv: data['TO/Dr_6'],
          ointpdrv: data['INT/Dr_8'],
          ofumpdrv: data['FUM/Dr_10'],
          olospdrv: data['LOS/Dr_12'],
          oplypdrv: data['Plays/Dr_14'],
          otoppdrv: data['TOP/Dr_16'],
          odrvsucc: data.DSR_18
        })
      }
      break
    }

    default:
      log(`invalid type: ${type}`)
  }
}

const runOne = async ({ type, url }) => {
  log(url)
  const $ = await fetchCheerioObject(url)

  $('table.sticky-headers.sortable').each(function (i, el) {
    const headers = []
    $('thead tr:last-child th', el).each((i, el) => {
      const value = cleanStr($(el).text().trim())
      headers.push(`${value}_${i}`)
    })
    $('tbody tr', el).each((i, el) => {
      const item = {}
      for (const [index, header] of headers.entries()) {
        const data = $(el).find('td').eq(index).text().trim()
        const value = parseFloat(data)
        item[header] = isNaN(value) ? data || null : value
      }
      update(type, item)
    })
  })
}

const run = async () => {
  // do not fetch outside of the NFL regular season
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  for (const item of urls) {
    await runOne(item)
    await wait(2000)
  }

  for (const [team, data] of Object.entries(teams.toJS())) {
    if (team === 'NFL') continue
    await db('footballoutsiders')
      .insert({
        team: fixTeam(team),
        week: constants.season.week,
        year: constants.season.year,
        ...data
      })
      .onConflict()
      .merge()
  }
}

const main = async () => {
  // do not pull in any data after the season has ended
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.DATA_FOOTBALL_OUTSIDERS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
