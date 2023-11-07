import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'
import { isMain, getLeague } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-formats')
debug.enable(
  'generate-league-formats,generate-league-format-hash,generate-scoring-format-hash'
)

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
  const scoring_formats = []

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
    scoring_formats.push({ scoring_format_hash, ...scoring_format })

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
  scoring_formats.push(generate_scoring_format_hash(default_league))
  league_formats.push(generate_league_format_hash(default_league))

  // delete league formats not in `league_formats` array or in `seasons` table
  const league_format_hashes = league_formats.map(
    ({ league_format_hash }) => league_format_hash
  )
  const delete_query = await db('league_formats')
    .leftJoin(
      'seasons',
      'league_formats.league_format_hash',
      'seasons.league_format_hash'
    )
    .whereNull('seasons.league_format_hash')
    .whereNotIn('league_formats.league_format_hash', league_format_hashes)
    .del()

  log(`Deleted ${delete_query} stale league formats`)

  await db('league_formats')
    .insert(league_formats)
    .onConflict('league_format_hash')
    .ignore()
  log(`Inserted ${league_formats.length} league formats`)

  await db('league_scoring_formats')
    .insert(scoring_formats)
    .onConflict('scoring_format_hash')
    .ignore()
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
  //   type: constants.jobs.EXAMPLE,
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
