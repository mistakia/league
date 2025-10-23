import debug from 'debug'

import db from '#db'
import { fixTeam, constants } from '#libs-shared'

const log = debug('play-cache')

/**
 * PlayCache - A singleton class for caching and searching NFL plays
 *
 * Provides fast lookup of plays by exact identifiers (esbid + playId) or
 * by game context (down, distance, field position, etc).
 */
class PlayCache {
  constructor() {
    this.plays_by_composite_key = new Map() // "esbid_playId" -> Play
    this.plays_by_esbid = new Map() // esbid -> Play[]
    this.plays_by_game_context = new Map() // context_key -> Play[]
    this.is_initialized = false
  }

  /**
   * Preloads plays into memory cache
   * @param {Object} options - Configuration options
   * @param {number[]} options.years - Load specific years (default: current year)
   * @param {number[]} options.weeks - Load specific weeks (optional)
   * @param {number[]} options.esbids - Load specific games by esbid (optional)
   * @param {boolean} options.all_plays - Load all plays from all years (default: false)
   * @param {boolean} options.include_context_index - Build game context index (default: true)
   * @throws {Error} If database query fails
   */
  async preload_plays({
    years = [constants.season.year],
    weeks = [],
    esbids = [],
    all_plays = false,
    include_context_index = true
  } = {}) {
    if (this.is_initialized) {
      log('Play cache already initialized')
      return
    }

    log(
      `Preloading plays (years: ${years}, weeks: ${weeks}, esbids: ${esbids.length})`
    )
    console.time('play-cache-preload')

    try {
      const plays = await this._fetch_plays({ years, weeks, esbids, all_plays })

      this._clear_cache()
      this._build_composite_index(plays)
      this._build_esbid_index(plays)

      if (include_context_index) {
        this._build_game_context_index(plays)
      }

      this.is_initialized = true
      console.timeEnd('play-cache-preload')
      log(`Loaded ${plays.length} plays`)
    } catch (error) {
      log(`Error loading plays: ${error.message}`)
      throw error
    }
  }

  /**
   * Finds a play by various identifiers
   * @param {Object} params - Search parameters
   * @param {number} params.esbid - Game esbid
   * @param {number} params.playId - Play ID
   * @param {number} params.week - Week number (for context search)
   * @param {number} params.year - Year (for context search)
   * @param {string} params.off - Offensive team abbreviation
   * @param {string} params.def - Defensive team abbreviation
   * @param {number} params.qtr - Quarter
   * @param {string} params.game_clock_start - Game clock start time
   * @param {number} params.dwn - Down
   * @param {number} params.yards_to_go - Yards to go
   * @param {string} params.play_type - Play type
   * @param {number} params.ydl_num - Yardline number
   * @param {string} params.ydl_side - Yardline side
   * @param {number} params.ydl_100 - Yardline from 0-100
   * @param {number} params.sec_rem_qtr - Seconds remaining in quarter
   * @returns {Object|null} Play object if found, null otherwise
   * @throws {Error} If cache not initialized
   */
  find_play({
    esbid,
    playId,
    week,
    year,
    off,
    def,
    qtr,
    game_clock_start,
    dwn,
    yards_to_go,
    play_type,
    ydl_num,
    ydl_side,
    ydl_100,
    sec_rem_qtr
  }) {
    this._ensure_initialized()

    if (esbid && playId) {
      const key = `${esbid}_${playId}`
      return this.plays_by_composite_key.get(key) || null
    }

    if (esbid) {
      return this._find_play_by_context({
        esbid,
        qtr,
        dwn,
        yards_to_go,
        ydl_100,
        off,
        def,
        sec_rem_qtr,
        game_clock_start,
        play_type,
        ydl_num,
        ydl_side
      })
    }

    return null
  }

  /**
   * Returns cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  get_cache_stats() {
    return {
      is_initialized: this.is_initialized,
      total_plays: this.plays_by_composite_key.size,
      games_cached: this.plays_by_esbid.size,
      game_context_entries: this.plays_by_game_context.size
    }
  }

  // Private methods

  /**
   * Fetches plays from database based on filters
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of play objects
   * @private
   */
  async _fetch_plays({ years, weeks, esbids, all_plays }) {
    const query = db('nfl_plays').select('*')

    if (all_plays) {
      return await query
    }

    if (esbids.length > 0) {
      query.whereIn('esbid', esbids)
    } else {
      if (years.length > 0) {
        query.whereIn('year', years)
      }
      if (weeks.length > 0) {
        query.whereIn('week', weeks)
      }
    }

    return await query
  }

  /**
   * Clears all cache data
   * @private
   */
  _clear_cache() {
    this.plays_by_composite_key.clear()
    this.plays_by_esbid.clear()
    this.plays_by_game_context.clear()
  }

  /**
   * Builds composite key index from play data
   * @param {Array} plays - Array of play objects
   * @private
   */
  _build_composite_index(plays) {
    for (const play of plays) {
      const key = `${play.esbid}_${play.playId}`
      this.plays_by_composite_key.set(key, play)
    }
  }

  /**
   * Builds esbid index from play data
   * @param {Array} plays - Array of play objects
   * @private
   */
  _build_esbid_index(plays) {
    for (const play of plays) {
      if (!this.plays_by_esbid.has(play.esbid)) {
        this.plays_by_esbid.set(play.esbid, [])
      }
      this.plays_by_esbid.get(play.esbid).push(play)
    }
  }

  /**
   * Builds game context index from play data
   * @param {Array} plays - Array of play objects
   * @private
   */
  _build_game_context_index(plays) {
    for (const play of plays) {
      const has_context_fields =
        play.esbid &&
        play.qtr !== null &&
        play.dwn !== null &&
        play.yards_to_go !== null &&
        play.ydl_100 !== null

      if (has_context_fields) {
        const key = `${play.esbid}_${play.qtr}_${play.dwn}_${play.yards_to_go}_${play.ydl_100}`

        if (!this.plays_by_game_context.has(key)) {
          this.plays_by_game_context.set(key, [])
        }
        this.plays_by_game_context.get(key).push(play)
      }
    }
  }

  _find_play_by_context({
    esbid,
    qtr,
    dwn,
    yards_to_go,
    ydl_100,
    off,
    def,
    sec_rem_qtr,
    game_clock_start,
    play_type,
    ydl_num,
    ydl_side
  }) {
    const has_context_key =
      qtr !== undefined &&
      dwn !== undefined &&
      yards_to_go !== undefined &&
      ydl_100 !== undefined

    if (has_context_key) {
      const key = `${esbid}_${qtr}_${dwn}_${yards_to_go}_${ydl_100}`
      const plays = this.plays_by_game_context.get(key) || []

      if (plays.length > 0) {
        const filtered = this._filter_plays(plays, {
          off,
          def,
          sec_rem_qtr,
          game_clock_start,
          play_type,
          ydl_num,
          ydl_side
        })

        if (filtered.length > 0) {
          return filtered[0]
        }
      }
    }

    const game_plays = this.plays_by_esbid.get(esbid) || []
    if (game_plays.length === 0) {
      return null
    }

    const filtered = this._filter_plays(game_plays, {
      qtr,
      dwn,
      yards_to_go,
      ydl_100,
      off,
      def,
      sec_rem_qtr,
      game_clock_start,
      play_type,
      ydl_num,
      ydl_side
    })

    return filtered.length > 0 ? filtered[0] : null
  }

  _filter_plays(plays, filters) {
    return plays.filter((play) => {
      if (filters.qtr !== undefined && play.qtr !== Number(filters.qtr)) {
        return false
      }
      if (filters.dwn !== undefined && play.dwn !== Number(filters.dwn)) {
        return false
      }
      if (
        filters.yards_to_go !== undefined &&
        play.yards_to_go !== filters.yards_to_go
      ) {
        return false
      }
      if (filters.ydl_100 !== undefined && play.ydl_100 !== filters.ydl_100) {
        return false
      }
      if (filters.off && play.off !== fixTeam(filters.off)) {
        return false
      }
      if (filters.def && play.def !== fixTeam(filters.def)) {
        return false
      }
      if (
        filters.sec_rem_qtr !== undefined &&
        play.sec_rem_qtr !== filters.sec_rem_qtr
      ) {
        return false
      }
      if (
        filters.game_clock_start &&
        play.game_clock_start !== filters.game_clock_start
      ) {
        return false
      }
      if (filters.play_type && play.play_type !== filters.play_type) {
        return false
      }
      if (filters.ydl_num !== undefined && play.ydl_num !== filters.ydl_num) {
        return false
      }
      if (filters.ydl_side && play.ydl_side !== fixTeam(filters.ydl_side)) {
        return false
      }
      return true
    })
  }

  /**
   * Ensures cache is initialized before operations
   * @throws {Error} If cache not initialized
   * @private
   */
  _ensure_initialized() {
    if (!this.is_initialized) {
      throw new Error('Play cache not initialized. Call preload_plays() first.')
    }
  }
}

const play_cache = new PlayCache()

export const preload_plays = (options) => play_cache.preload_plays(options)
export const find_play = (params) => play_cache.find_play(params)
export const get_cache_stats = () => play_cache.get_cache_stats()

export default play_cache
