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
  const num_teams_options = [10, 12]

  const sqb_options = [1]
  const srb_options = [2]
  const swr_options = [2]
  const ste_options = [1]
  const srbwr_options = [0]
  const srbwrte_options = [1, 2]
  const sqbrbwrte_options = [0, 1]
  const swrte_options = [0]
  const sdst_options = [1]
  const sk_options = [0, 1]

  const bench_options = [7]
  const ps_options = [4]
  const ir_options = [3]

  const pa_options = [0]
  const pc_options = [0]
  const py_options = [0.04, 0.05]
  const ints_options = [-1, -2]
  const tdp_options = [4, 6]

  const ra_options = [0]
  const ry_options = [0.1]
  const tdr_options = [6]

  const rec_options = [0, 0.5, 1]

  // TODO TE premium
  // const rbrec_options = [0, 0.5, 1]
  // const wrrec_options = [0, 0.5, 1]
  // const terec_options = [0, 0.5, 1, 1.5]

  const recy_options = [0.1]
  const twoptc_options = [2]
  const tdrec_options = [6]
  const fuml_options = [-1, -2]
  const prtd_options = [6]
  const krtd_options = [6]

  const cap_options = [200]
  const min_bid_options = [0]

  const league_formats = []
  const scoring_formats = []

  for (const num_teams of num_teams_options) {
    for (const sqb of sqb_options) {
      for (const srb of srb_options) {
        for (const swr of swr_options) {
          if (srb + swr > 5) {
            continue
          }

          for (const ste of ste_options) {
            for (const srbwr of srbwr_options) {
              for (const srbwrte of srbwrte_options) {
                for (const sqbrbwrte of sqbrbwrte_options) {
                  for (const swrte of swrte_options) {
                    // skip formats with multiple different starting flex configurations
                    if (srbwrte + srbwr - Math.max(srbwrte, srbwr) > 0) {
                      continue
                    }

                    for (const sdst of sdst_options) {
                      for (const sk of sk_options) {
                        for (const bench of bench_options) {
                          for (const ps of ps_options) {
                            for (const ir of ir_options) {
                              for (const pa of pa_options) {
                                for (const pc of pc_options) {
                                  for (const py of py_options) {
                                    for (const ints of ints_options) {
                                      for (const tdp of tdp_options) {
                                        for (const ra of ra_options) {
                                          for (const ry of ry_options) {
                                            for (const tdr of tdr_options) {
                                              for (const rec of rec_options) {
                                                for (const recy of recy_options) {
                                                  for (const twoptc of twoptc_options) {
                                                    for (const tdrec of tdrec_options) {
                                                      for (const fuml of fuml_options) {
                                                        for (const prtd of prtd_options) {
                                                          for (const krtd of krtd_options) {
                                                            for (const cap of cap_options) {
                                                              for (const min_bid of min_bid_options) {
                                                                const scoring_format =
                                                                  {
                                                                    pa,
                                                                    pc,
                                                                    py,
                                                                    ints,
                                                                    tdp,
                                                                    ra,
                                                                    ry,
                                                                    tdr,
                                                                    rec,
                                                                    rbrec: rec,
                                                                    wrrec: rec,
                                                                    terec: rec,
                                                                    recy,
                                                                    twoptc,
                                                                    tdrec,
                                                                    fuml,
                                                                    prtd,
                                                                    krtd
                                                                  }

                                                                const {
                                                                  scoring_format_hash
                                                                } =
                                                                  generate_scoring_format_hash(
                                                                    scoring_format
                                                                  )

                                                                scoring_formats.push(
                                                                  {
                                                                    scoring_format_hash,
                                                                    ...scoring_format
                                                                  }
                                                                )

                                                                const league_format =
                                                                  {
                                                                    scoring_format_hash,

                                                                    num_teams,
                                                                    sqb,
                                                                    srb,
                                                                    swr,
                                                                    ste,
                                                                    srbwr,
                                                                    srbwrte,
                                                                    sqbrbwrte,
                                                                    swrte,
                                                                    sdst,
                                                                    sk,

                                                                    bench,
                                                                    ps,
                                                                    ir,

                                                                    cap,
                                                                    min_bid
                                                                  }

                                                                const {
                                                                  league_format_hash
                                                                } =
                                                                  generate_league_format_hash(
                                                                    league_format
                                                                  )

                                                                league_formats.push(
                                                                  {
                                                                    league_format_hash,
                                                                    scoring_format_hash,
                                                                    ...league_format
                                                                  }
                                                                )
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

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
