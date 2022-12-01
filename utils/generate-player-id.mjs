import debug from 'debug'

import db from '#db'
import isMain from './is-main.mjs'

const log = debug('generate-player-id')
debug.enable('generate-player-id')

const generatePlayerId = async (player_data) => {
  const firstInitial = player_data.fname
    .match(/[a-zA-Z]/)
    .pop()
    .toUpperCase()
  const lastInitial = player_data.lname
    .match(/[a-zA-Z]/)
    .pop()
    .toUpperCase()
  const preset = firstInitial + lastInitial

  const player_rows = await db('player')
    .select('pid')
    .where('pid', 'like', `${preset}-%`)
    .orderBy('pid', 'desc')
    .limit(1)

  if (!player_rows.length) {
    return `${preset}-1000`
  }

  const cursor_pid = player_rows[0].pid
  const re_results = /[A-Z]{2}-(?<index>[0-9]{4})/.exec(cursor_pid)
  const cursor_pid_index = parseInt(re_results.groups.index, 10)
  log(`current index: ${cursor_pid_index}`)

  // increase cursor_pid_index by 10 and round to the nearest 10
  const new_index = Math.ceil((cursor_pid_index + 10) / 10) * 10
  const formatted_index = ('0000' + new_index).slice(-4)
  log(`new index: ${formatted_index}`)

  return `${preset}-${formatted_index}`
}

export default generatePlayerId

if (isMain(import.meta.url)) {
  const main = async () => {
    const pid = await generatePlayerId({
      fname: 'Francis',
      lname: 'Scott'
    })

    console.log(pid)
    process.exit()
  }

  main()
}
