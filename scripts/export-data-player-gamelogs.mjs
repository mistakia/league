import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convert_to_csv } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-player-gamelogs')
debug.enable('export-data-player-gamelogs')

const format_gamelog = (gamelog) => ({
  esbid: gamelog.esbid,
  pid: gamelog.pid,
  opp: gamelog.opp,
  tm: gamelog.tm,
  pos: gamelog.pos,
  jnum: gamelog.jnum,
  active: gamelog.active,
  started: gamelog.started,
  pa: gamelog.pa,
  pc: gamelog.pc,
  py: gamelog.py,
  ints: gamelog.ints,
  tdp: gamelog.tdp,
  ra: gamelog.ra,
  ry: gamelog.ry,
  tdr: gamelog.tdr,
  fuml: gamelog.fuml,
  trg: gamelog.trg,
  rec: gamelog.rec,
  recy: gamelog.recy,
  tdrec: gamelog.tdrec,
  twoptc: gamelog.twoptc,
  prtd: gamelog.prtd,
  krtd: gamelog.krtd,
  snp: gamelog.snp,
  fgm: gamelog.fgm,
  fgy: gamelog.fgy,
  fg19: gamelog.fg19,
  fg29: gamelog.fg29,
  fg39: gamelog.fg39,
  fg49: gamelog.fg49,
  fg50: gamelog.fg50,
  xpm: gamelog.xpm,
  dsk: gamelog.dsk,
  dint: gamelog.dint,
  dff: gamelog.dff,
  drf: gamelog.drf,
  dtno: gamelog.dtno,
  dfds: gamelog.dfds,
  dpa: gamelog.dpa,
  dya: gamelog.dya,
  dblk: gamelog.dblk,
  dsf: gamelog.dsf,
  dtpr: gamelog.dtpr,
  dtd: gamelog.dtd,
  career_game: gamelog.career_game
})

const export_data_player_gamelogs = async () => {
  const data = await db('player_gamelogs')
    .select('player_gamelogs.*')
    .orderBy('esbid', 'asc')
    .orderBy('pid', 'asc')

  const header = {}
  for (const field of Object.keys(data[0])) {
    header[field] = field
  }

  const gamelogs_by_year = {}
  for (const item of data) {
    const { year, ...gamelog } = item
    if (!gamelogs_by_year[year]) {
      gamelogs_by_year[year] = []
    }

    const formatted_gamelog = format_gamelog(gamelog)
    gamelogs_by_year[year].push(formatted_gamelog)
  }

  for (const year of Object.keys(gamelogs_by_year)) {
    const year_data = gamelogs_by_year[year]
    const year_json_file_path = `${data_path}/nfl/player_gamelogs/${year}.json`
    const year_csv_file_path = `${data_path}/nfl/player_gamelogs/${year}.csv`

    const year_csv_data = [header, ...year_data]
    const year_csv_data_string = JSON.stringify(year_csv_data)
    const year_csv = convert_to_csv(year_csv_data_string)

    await fs.ensureDir(`${data_path}/nfl/player_gamelogs`)
    await fs.writeJson(year_json_file_path, year_data, { spaces: 2 })
    log(`wrote json to ${year_json_file_path}`)

    await fs.writeFile(year_csv_file_path, year_csv)
    log(`wrote csv to ${year_csv_file_path}`)
  }
}

const main = async () => {
  let error
  try {
    await export_data_player_gamelogs()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default export_data_player_gamelogs
