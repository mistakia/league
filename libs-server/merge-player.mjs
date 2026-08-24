import debug from 'debug'

import db from '#db'
import update_player_id from './update-player-id.mjs'
import updatePlayer from './update-player.mjs'
import { BIRTH_DATE_PLACEHOLDER } from './resolve-canonical-player.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('merge-player')
enable_debug_namespaces('merge-player,update-player-id')

// `date_of_birth` is a character varying whose "never learned" value is the
// `0000-00-00` sentinel rather than NULL, so it is both truthy and exactly as
// long as a real date. The field merge below breaks string ties by length and
// otherwise prefers `remove_player_row`, which means the sentinel wins outright
// against a real birth date whenever the row holding the real one survives --
// the merge then WRITES the sentinel, the one value this repair class is
// forbidden to produce. An absence is not a value; treat it as one nowhere.
const is_absent = (value) => !value || value === BIRTH_DATE_PLACEHOLDER

// Exported for its own spec: this rule decides what the surviving row ends up
// holding, and it is the half of the merge that can be wrong without any
// database write failing.
export const merge_player_row_fields = ({
  update_player_row,
  remove_player_row
}) =>
  Object.keys(update_player_row).reduce((acc, key) => {
    if (key === 'pid') {
      return acc
    }

    const update_value = update_player_row[key]
    const remove_value = remove_player_row[key]

    // select present values, or longest string, or largest number
    if (!is_absent(update_value) && !is_absent(remove_value)) {
      if (typeof update_value === 'string') {
        if (update_value.length > remove_value.length) {
          acc[key] = update_value
        } else {
          acc[key] = remove_value
        }
      } else if (typeof update_value === 'number') {
        if (update_value > remove_value) {
          acc[key] = update_value
        } else {
          acc[key] = remove_value
        }
      } else {
        acc[key] = update_value
      }
    } else if (!is_absent(update_value)) {
      acc[key] = update_value
    } else if (!is_absent(remove_value)) {
      acc[key] = remove_value
    }

    return acc
  }, {})

// The caller names which row survives: `update_player_row` keeps its pid and
// `remove_player_row` is folded into it.
//
// This used to be decided here, by preferring whichever row carried a real
// `date_of_birth`. That rule predates the pid redesign and no longer means
// anything: a pid is now an opaque immutable serial off a sequence
// (`generate-player-id.mjs`), so it encodes no birth date and two pids are
// equally canonical. Holding a birth date said something about which pid was
// "more real" only while the pid string was built from one.
//
// Note the field merge below still keeps both rows' values, so the surviving
// row inherits a birth date from either side regardless of which pid wins.
export default async function ({ update_player_row, remove_player_row }) {
  log(
    `merging ${update_player_row.first_name} ${update_player_row.last_name} ${update_player_row.pid} and ${remove_player_row.first_name} ${remove_player_row.last_name} ${remove_player_row.pid}. Using pid ${update_player_row.pid}`
  )

  await update_player_id({
    current_pid: remove_player_row.pid,
    new_pid: update_player_row.pid
  })

  await db('player').where('pid', remove_player_row.pid).del()

  const merged_player_row = merge_player_row_fields({
    update_player_row,
    remove_player_row
  })

  await updatePlayer({
    pid: update_player_row.pid,
    update: merged_player_row,
    source: 'merge'
  })
}
