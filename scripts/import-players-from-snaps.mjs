import debug from 'debug'
import dayjs from 'dayjs'

import db from '#db'
import { isMain, ngs, updatePlayer, getPlayer, wait } from '#utils'

const log = debug('import-players-from-snaps')
debug.enable('import-players-from-snaps,ngs,update-player,get-player')

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
    if (data && data.gsisItId) {
      const options = { name: data.displayName }
      if (data.birthDate) {
        const dob = dayjs(data.birthDate, 'MM/DD/YYYY')
        options.dob = dob.format('YYYY-MM-DD')
      }

      let player_row
      try {
        player_row = await getPlayer(options)
      } catch (err) {
        // ignore
      }

      if (!player_row) {
        missing.push(data)
        continue
      }

      const update = {
        gsisItId: data.gsisItId,
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
