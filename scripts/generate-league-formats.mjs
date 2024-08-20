import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'
import { isMain, getLeague } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-formats')
debug.enable(
  'generate-league-formats,generate-league-format-hash,generate-scoring-format-hash'
)

const generate_scoring_format_title = (scoring_format) => {
  const parts = []

  // Reception points
  if (scoring_format.rec === 1) {
    parts.push('PPR')
  } else if (scoring_format.rec === 0.5) {
    parts.push('0.5PPR')
  } else if (scoring_format.rec === 0) {
    parts.push('Standard')
  }

  // Tight End Premium
  if (scoring_format.terec > scoring_format.rec) {
    parts.push(`TE+${scoring_format.terec - scoring_format.rec}`)
  }

  // Passing TD points
  parts.push(`${scoring_format.tdp}PTD`)

  // Interception points
  parts.push(`${scoring_format.ints}INT`)

  // Passing yards (if different from standard)
  if (scoring_format.py !== 0.04) {
    parts.push(`${scoring_format.py}PY`)
  }

  // Fumbles lost (if different from standard -2)
  if (scoring_format.fuml !== -2) {
    parts.push(`${scoring_format.fuml}FUM`)
  }

  return parts.join(' / ')
}

const generate_league_formats = async () => {
  const options = {
    num_teams: [10, 12],
    sqb: [1],
    srb: [2],
    swr: [2],
    ste: [1],
    srbwr: [0],
    srbwrte: [1, 2],
    sqbrbwrte: [0, 1],
    swrte: [0],
    sdst: [1],
    sk: [0, 1],
    bench: [7],
    ps: [4],
    ir: [3],
    pa: [0],
    pc: [0],
    py: [0.04, 0.05],
    ints: [-1, -2],
    tdp: [4, 6],
    ra: [0],
    ry: [0.1],
    tdr: [6],
    rec: [0, 0.5, 1],
    recy: [0.1],
    twoptc: [2],
    tdrec: [6],
    fuml: [-1, -2],
    prtd: [6],
    krtd: [6],
    cap: [200],
    min_bid: [0]
  }

  const league_formats = []
  const scoring_formats_map = new Map()

  const keys = Object.keys(options)
  const combinations = keys.reduce(
    (acc, key) => {
      const new_combinations = []
      acc.forEach((combination) => {
        options[key].forEach((option) => {
          const new_combination = { ...combination, [key]: option }
          if (
            !(new_combination.srb + new_combination.swr > 5) &&
            !(
              new_combination.srbwrte +
                new_combination.srbwr -
                Math.max(new_combination.srbwrte, new_combination.srbwr) >
              0
            )
          ) {
            new_combinations.push(new_combination)
          }
        })
      })
      return new_combinations
    },
    [{}]
  )

  log(`Generated ${combinations.length} combinations`)

  combinations.forEach((combination) => {
    const scoring_format = {
      pa: combination.pa,
      pc: combination.pc,
      py: combination.py,
      ints: combination.ints,
      tdp: combination.tdp,
      ra: combination.ra,
      ry: combination.ry,
      tdr: combination.tdr,
      rec: combination.rec,
      rbrec: combination.rec,
      wrrec: combination.rec,
      terec: combination.rec,
      recy: combination.recy,
      twoptc: combination.twoptc,
      tdrec: combination.tdrec,
      fuml: combination.fuml,
      prtd: combination.prtd,
      krtd: combination.krtd
    }

    const { scoring_format_hash } = generate_scoring_format_hash(scoring_format)
    const scoring_format_title = generate_scoring_format_title(scoring_format)
    scoring_formats_map.set(scoring_format_hash, {
      scoring_format_hash,
      scoring_format_title,
      ...scoring_format
    })

    const league_format = {
      scoring_format_hash,
      num_teams: combination.num_teams,
      sqb: combination.sqb,
      srb: combination.srb,
      swr: combination.swr,
      ste: combination.ste,
      srbwr: combination.srbwr,
      srbwrte: combination.srbwrte,
      sqbrbwrte: combination.sqbrbwrte,
      swrte: combination.swrte,
      sdst: combination.sdst,
      sk: combination.sk,
      bench: combination.bench,
      ps: combination.ps,
      ir: combination.ir,
      cap: combination.cap,
      min_bid: combination.min_bid
    }

    const { league_format_hash } = generate_league_format_hash(league_format)
    league_formats.push({
      league_format_hash,
      scoring_format_hash,
      ...league_format
    })
  })

  const default_league = await getLeague({ lid: 0 })
  const default_league_scoring_format =
    generate_scoring_format_hash(default_league)
  scoring_formats_map.set(default_league_scoring_format.scoring_format_hash, {
    scoring_format_hash: default_league_scoring_format.scoring_format_hash,
    scoring_format_title: generate_scoring_format_title(default_league),
    ...default_league_scoring_format
  })
  league_formats.push(generate_league_format_hash(default_league))

  // delete league formats not in `league_formats` array or in `seasons` table
  const league_format_hashes = league_formats.map(
    ({ league_format_hash }) => league_format_hash
  )
  const delete_query = await db('league_formats')
    .whereNotExists(function () {
      this.select('*')
        .from('seasons')
        .whereRaw(
          'seasons.league_format_hash = league_formats.league_format_hash'
        )
    })
    .whereNotIn('league_formats.league_format_hash', league_format_hashes)
    .del()

  log(`Deleted ${delete_query} stale league formats`)

  await db('league_formats')
    .insert(league_formats)
    .onConflict('league_format_hash')
    .ignore()
  log(`Inserted ${league_formats.length} league formats`)

  const scoring_formats = Array.from(scoring_formats_map.values())
  await db('league_scoring_formats')
    .insert(scoring_formats)
    .onConflict('scoring_format_hash')
    .merge() // update title
  log(`Inserted ${scoring_formats.length} scoring formats`)
}

const main = async () => {
  let error
  try {
    await generate_league_formats()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: job_types.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_league_formats
