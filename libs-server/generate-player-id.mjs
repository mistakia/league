import debug from 'debug'

import is_main from './is-main.mjs'

const log = debug('generate-player-id')
debug.enable('generate-player-id')

const required_fields = ['fname', 'lname', 'nfl_draft_year', 'dob']

const generate_player_id = (player_data) => {
  // check if all required fields are present
  for (const field of required_fields) {
    if (!player_data[field]) {
      throw new Error(`Missing field ${field}`)
    }
  }

  // if DST, get pid from team abbreviation
  if (player_data.pos === 'DST') {
    return player_data.current_nfl_team
  }

  // get first initial, uppercase, pad if needed
  const first_name_first_four = player_data.fname
    .match(/[a-zA-Z]/g)
    .slice(0, 4)
    .map((initial) => initial.toUpperCase())
    .join('')
    .padEnd(4, 'X')

  // get last three initials, uppercase and pad if needed
  const last_name_first_four = player_data.lname
    .match(/[a-zA-Z]/g)
    .slice(0, 4)
    .map((initial) => initial.toUpperCase())
    .join('')
    .padEnd(4, 'X')

  // format nfl draft year, a number, to ensure it is in format YYYY, fill in any missing digits
  const start = player_data.nfl_draft_year.toString().slice(0, 4).padStart(4, '0')

  // format date of birth to ensure it is in format YYYY-MM-DD, fill in any missing digits
  const dob = player_data.dob
    .split('-')
    .map((part) => part.padStart(2, '0')) // pad each part
    .join('-')

  const pid = `${first_name_first_four}-${last_name_first_four}-${start}-${dob}`
  log(`Generated pid ${pid}`)
  return pid
}

export default generate_player_id

if (is_main(import.meta.url)) {
  const main = () => {
    const pid = generate_player_id({
      fname: 'Francis',
      lname: 'Scott'
    })

    console.log(pid)
    process.exit()
  }

  main()
}
