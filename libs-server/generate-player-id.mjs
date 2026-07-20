import debug from 'debug'

import is_main from './is-main.mjs'

const log = debug('generate-player-id')
debug.enable('generate-player-id')

// Player ID (pid) format:
//
//   FNAM-LNAM-<serial>
//
// Where:
//   FNAM     = First four letters of first name (A-Z, uppercase, X-padded if <4)
//   LNAM     = First four letters of last name (A-Z, uppercase, X-padded if <4)
//   <serial> = an opaque, immutable, collision-free ordinal, zero-padded to six digits
//              and allowed to grow past six as the sequence advances
//
// Examples:
//   PATR-MAHO-000123
//   AARO-RODG-004567
//
// The FNAM-LNAM prefix is a frozen, human-readable courtesy snapshot taken once at mint.
// It carries NO referential meaning: it is never recomputed, is allowed to go stale if the
// person's name is later corrected, and must not be parsed for identity. The <serial> is
// the actual identity -- immutable, assigned exactly once, never regenerated. The pid does
// not depend on dob or nfl_draft_year, so a person can be minted at recruit/college stage
// before either field exists.
//
// The serial is allocated by the caller (create-player.mjs draws nextval from the dedicated
// player_pid_serial_seq sequence) and passed in, keeping this a pure, synchronous, DB-free
// function that is trivially unit-testable with a fixed serial.
//
// If the player is a DST (defense/special teams), the pid is the team abbreviation (e.g.
// "NE", "DAL") -- a stable non-person pseudo-identifier carrying no serial.
//
// This format is the canonical player identifier throughout the system.

const SERIAL_MIN_DIGITS = 6

const four_letter_prefix = (name) =>
  name
    .match(/[a-zA-Z]/g)
    .slice(0, 4)
    .map((letter) => letter.toUpperCase())
    .join('')
    .padEnd(4, 'X')

const generate_player_id = ({
  fname,
  lname,
  pos,
  current_nfl_team,
  serial
} = {}) => {
  // DST pseudo-rows are not persons: the pid is the team abbreviation, no serial.
  if (pos === 'DST') {
    if (!current_nfl_team) {
      throw new Error('Missing field current_nfl_team')
    }
    return current_nfl_team
  }

  if (!fname) {
    throw new Error('Missing field fname')
  }

  if (!lname) {
    throw new Error('Missing field lname')
  }

  if (serial === undefined || serial === null || serial === '') {
    throw new Error('Missing field serial')
  }

  const serial_number = Number(serial)
  if (!Number.isInteger(serial_number) || serial_number < 0) {
    throw new Error(`Invalid serial ${serial}`)
  }

  const formatted_serial = serial_number
    .toString()
    .padStart(SERIAL_MIN_DIGITS, '0')

  const pid = `${four_letter_prefix(fname)}-${four_letter_prefix(lname)}-${formatted_serial}`
  log(`Generated pid ${pid}`)
  return pid
}

export default generate_player_id

if (is_main(import.meta.url)) {
  const main = () => {
    const pid = generate_player_id({
      fname: 'Francis',
      lname: 'Scott',
      serial: 123
    })

    console.log(pid)
    process.exit()
  }

  main()
}
