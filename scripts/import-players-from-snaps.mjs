import debug from 'debug'
import dayjs from 'dayjs'

import db from '#db'
import {
  isMain,
  ngs,
  updatePlayer,
  getPlayer,
  wait,
  createPlayer
} from '#libs-server'

const log = debug('import-players-from-snaps')
debug.enable(
  'import-players-from-snaps,ngs,update-player,get-player,create-player'
)

const import_players_from_snaps = async () => {
  const nfl_ids = await db('nfl_snaps')
    .select('nfl_snaps.nflId')
    .leftJoin('player', 'nfl_snaps.nflId', 'player.gsisItId')
    .whereNull('player.gsisItId')
    .groupBy('nfl_snaps.nflId')

  log(`loaded ${nfl_ids.length} missing player ids`)

  const missing = []

  for (const { nflId } of nfl_ids) {
    const data = await ngs.getPlayer({ nflId })
    if (data && data.displayName) {
      let player_row
      try {
        if (data.gsisId) {
          player_row = await getPlayer({ gsisid: data.gsisId })
        }

        if (!player_row && data.esbId) {
          player_row = await getPlayer({ esbid: data.esbId })
        }

        if (!player_row) {
          const options = { name: `${data.firstName} ${data.lastName}` }
          if (data.birthDate) {
            const dob = dayjs(data.birthDate, 'MM/DD/YYYY')
            options.dob = dob.format('YYYY-MM-DD')
          }

          // TODO use entryYear
          // if (data.entryYear) {
          //   options.start = data.entryYear
          // }

          player_row = await getPlayer(options)

          if (!player_row) {
            options.name = data.displayName
            player_row = await getPlayer(options)
          }
        }

        if (!player_row) {
          await createPlayer({
            fname: data.firstName,
            lname: data.lastName,
            dob: data.birthDate
              ? dayjs(data.birthDate, 'MM/DD/YYYY').format('YYYY-MM-DD')
              : '0000-00-00',
            start: data.entryYear,
            pos: data.position,
            pos1: data.position,
            height: data.height,
            weight: data.weight,
            col: null,
            posd: 'INA',
            esbid: data.esbId,
            gsisid: data.gsisId,
            gsisItId: nflId,
            jnum: data.jerseyNumber,
            current_nfl_team: data.currentTeamAbbr
          })
          continue
        }
      } catch (err) {
        log(err)
      }

      if (!player_row) {
        missing.push(data)
        continue
      }

      const update = {
        gsisItId: nflId,
        gsisid: data.gsisId,
        esbid: data.esbId
      }

      if (data.birthDate) {
        const dob = dayjs(data.birthDate, 'MM/DD/YYYY')
        update.dob = dob.format('YYYY-MM-DD')
      }
      await updatePlayer({ player_row, update })
    }

    await wait(5000)
  }

  log(missing)
  log(`unable to match ${missing.length} players`)
}

const main = async () => {
  let error
  try {
    await import_players_from_snaps()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_players_from_snaps
