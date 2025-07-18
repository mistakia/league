import debug from 'debug'

import is_main from './is-main.mjs'

const log = debug('generate-player-id')
debug.enable('generate-player-id')

// Player ID (pid) format:
//
//   FFFF-LLLL-YYYY-YYYY-MM-DD
//
// Where:
//   FFFF = First four letters of first name (A-Z, uppercase, padded with X if <4)
//   LLLL = First four letters of last name (A-Z, uppercase, padded with X if <4)
//   YYYY = NFL draft year (4 digits, zero-padded if missing)
//   YYYY-MM-DD = Date of birth (zero-padded, may be 0000-00-00 if unknown)
//
// Examples from production data:
//   AARI-PENT-2017-1994-09-03
//   AARO-ADAM-2013-1989-05-16
//   AARO-ADEO-2019-1993-08-26
//   AARO-BAIL-2017-0000-00-00
//   AARO-BANK-2021-0000-00-00
//   AARO-BANK-2021-1997-09-03
//   AARO-BARR-1991-1969-08-14
//   AARO-BEAS-1996-1973-07-07
//   AARO-BERR-2010-1988-06-25
//   AARO-BRAN-2007-1984-09-16
//
// If the player is a DST (defense/special teams), the pid is the team abbreviation (e.g., "NE", "DAL").
//
// This format is used as the canonical player identifier throughout the system.
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
  const start = player_data.nfl_draft_year
    .toString()
    .slice(0, 4)
    .padStart(4, '0')

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
