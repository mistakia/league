import player_cache from '#libs-server/player-cache.mjs'

// `player_cache` is a module-level SINGLETON, and mocha loads every spec file
// into one process. So a spec that preloads it, or clears `is_initialized` to
// force a reload, is mutating state that every later spec file shares -- and
// the damage lands far from the cause. Leaving it uninitialized makes any later
// find_player throw "not initialized"; leaving it loaded makes a later spec read
// a cache built before that spec seeded its own fixtures. A first attempt at the
// player-cache spec did both and turned a 3136-passing suite into 2717 passing
// and 73 failing, almost none of them in the file that caused it.
//
// The cache exposes no reset, so isolation has to be snapshot-and-restore of
// its actual fields. Keyed off the live instance rather than a hardcoded list,
// so a new index added to the class is covered without touching this file.
const snapshot_player_cache = () => {
  const saved = new Map()
  for (const [key, value] of Object.entries(player_cache)) {
    saved.set(key, value instanceof Map ? new Map(value) : value)
  }
  return saved
}

const restore_player_cache = (saved) => {
  for (const [key, value] of saved) {
    player_cache[key] = value
  }
}

/**
 * Wrap a describe block so anything it does to the player_cache singleton is
 * undone. Call at the top of the block; it registers its own before/after.
 *
 * @returns {(options: object) => Promise<unknown>} a `reload({...})` helper that forces a preload with the
 *   given options, since `preload_active_players` is otherwise a no-op once the
 *   cache is initialized.
 */
export const isolate_player_cache = () => {
  let saved = null

  // eslint-disable-next-line no-undef
  before(() => {
    saved = snapshot_player_cache()
  })

  // eslint-disable-next-line no-undef
  after(() => {
    if (saved) restore_player_cache(saved)
  })

  return async (options) => {
    player_cache.is_initialized = false
    await player_cache.preload_active_players(options)
  }
}

export default isolate_player_cache
