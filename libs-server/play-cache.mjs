import debug from 'debug'

import db from '#db'
import { fixTeam, constants } from '#libs-shared'

const log = debug('play-cache')

/**
 * Error thrown when multiple plays match the same search criteria
 */
export class MultiplePlayMatchError extends Error {
  constructor(match_count, filters, matching_plays) {
    super(
      `Multiple plays (${match_count}) matched the search criteria. This indicates ambiguous play matching.`
    )
    this.name = 'MultiplePlayMatchError'
    this.match_count = match_count
    this.filters = filters
    this.matching_plays = matching_plays
  }
}

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
   * @param {number} params.sec_rem_qtr_tolerance - Tolerance for sec_rem_qtr matching (default: 0 for exact match)
   * @returns {Object|null} Play object if found, null otherwise
   * @throws {Error} If cache not initialized
   * @throws {MultiplePlayMatchError} If multiple plays match the search criteria
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
    sec_rem_qtr,
    sec_rem_qtr_tolerance
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
        sec_rem_qtr_tolerance,
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
      const has_required_fields =
        play.esbid &&
        play.qtr !== null &&
        play.dwn !== null &&
        play.yards_to_go !== null &&
        play.ydl_100 !== null

      if (has_required_fields) {
        const context_key = this._create_context_key(
          play.esbid,
          play.qtr,
          play.dwn,
          play.yards_to_go,
          play.ydl_100
        )

        if (!this.plays_by_game_context.has(context_key)) {
          this.plays_by_game_context.set(context_key, [])
        }
        this.plays_by_game_context.get(context_key).push(play)
      }
    }
  }

  /**
   * Creates a context key for indexing plays
   * @param {number} esbid - Game esbid
   * @param {number} qtr - Quarter
   * @param {number} dwn - Down
   * @param {number} yards_to_go - Yards to go
   * @param {number} ydl_100 - Yardline from 0-100
   * @returns {string} Context key
   * @private
   */
  _create_context_key(esbid, qtr, dwn, yards_to_go, ydl_100) {
    return `${esbid}_${qtr}_${dwn}_${yards_to_go}_${ydl_100}`
  }

  /**
   * Checks if all required context fields are defined (not null or undefined)
   * @private
   */
  _has_context_fields(qtr, dwn, yards_to_go, ydl_100) {
    return (
      qtr !== undefined && qtr !== null &&
      dwn !== undefined && dwn !== null &&
      yards_to_go !== undefined && yards_to_go !== null &&
      ydl_100 !== undefined && ydl_100 !== null
    )
  }

  /**
   * Searches plays using context index first, falls back to full scan
   * @private
   */
  _find_play_by_context({
    esbid,
    qtr,
    dwn,
    yards_to_go,
    ydl_100,
    off,
    def,
    sec_rem_qtr,
    sec_rem_qtr_tolerance,
    game_clock_start,
    play_type,
    ydl_num,
    ydl_side
  }) {
    const has_context = this._has_context_fields(qtr, dwn, yards_to_go, ydl_100)

    // Try indexed lookup first (fastest)
    if (has_context) {
      const context_key = this._create_context_key(
        esbid,
        qtr,
        dwn,
        yards_to_go,
        ydl_100
      )
      const indexed_plays = this.plays_by_game_context.get(context_key) || []

      if (indexed_plays.length > 0) {
        const additional_filters = {
          off,
          def,
          sec_rem_qtr,
          sec_rem_qtr_tolerance,
          game_clock_start,
          play_type,
          ydl_num,
          ydl_side
        }
        const matching_play = this._find_unique_matching_play(
          indexed_plays,
          additional_filters
        )
        if (matching_play) {
          return matching_play
        }
      }
    }

    // Fall back to full game scan
    return this._scan_game_plays(esbid, {
      qtr,
      dwn,
      yards_to_go,
      ydl_100,
      off,
      def,
      sec_rem_qtr,
      sec_rem_qtr_tolerance,
      game_clock_start,
      play_type,
      ydl_num,
      ydl_side
    })
  }

  /**
   * Scans all plays for a game with given filters
   * @private
   */
  _scan_game_plays(esbid, filters) {
    const game_plays = this.plays_by_esbid.get(esbid) || []
    if (game_plays.length === 0) {
      return null
    }

    return this._find_unique_matching_play(game_plays, filters)
  }

  /**
   * Finds unique play matching all filters
   * Throws error if multiple plays match
   * @private
   * @throws {MultiplePlayMatchError} If multiple plays match the criteria
   */
  _find_unique_matching_play(plays, filters) {
    const matching_plays = this._filter_plays(plays, filters)
    
    if (matching_plays.length === 0) {
      return null
    }
    
    if (matching_plays.length > 1) {
      log(`Multiple plays matched (${matching_plays.length}):`)
      matching_plays.forEach((play, index) => {
        log(
          `  [${index + 1}] esbid=${play.esbid} playId=${play.playId} qtr=${play.qtr} dwn=${play.dwn} ytg=${play.yards_to_go} ydl=${play.ydl_100}`
        )
      })
      throw new MultiplePlayMatchError(
        matching_plays.length,
        filters,
        matching_plays
      )
    }
    
    return matching_plays[0]
  }

  /**
   * Filters plays based on provided criteria
   * @private
   */
  _filter_plays(plays, filters) {
    return plays.filter((play) => this._play_matches_filters(play, filters))
  }

  /**
   * Checks if a play matches all provided filters
   * @private
   */
  _play_matches_filters(play, filters) {
    const qtr_match = this._matches_numeric_field(play.qtr, filters.qtr)
    const dwn_match = this._matches_nullable_field(play.dwn, filters.dwn)
    const ytg_match = this._matches_nullable_field(play.yards_to_go, filters.yards_to_go)
    const ydl_match = this._matches_numeric_field(play.ydl_100, filters.ydl_100)
    const off_match = this._matches_team_field(play.off, filters.off)
    const def_match = this._matches_team_field(play.def, filters.def)
    const time_match = this._matches_time_field(
      play.sec_rem_qtr,
      filters.sec_rem_qtr,
      filters.sec_rem_qtr_tolerance
    )
    const clock_match = this._matches_string_field(
      play.game_clock_start,
      filters.game_clock_start
    )
    const type_match = this._matches_string_field(play.play_type, filters.play_type)
    const ydl_num_match = this._matches_numeric_field(play.ydl_num, filters.ydl_num)
    const ydl_side_match = this._matches_team_field(play.ydl_side, filters.ydl_side)

    return qtr_match && dwn_match && ytg_match && ydl_match && off_match && def_match && time_match && clock_match && type_match && ydl_num_match && ydl_side_match
  }

  /**
   * Checks if numeric field matches filter (handles undefined and null)
   * @private
   */
  _matches_numeric_field(play_value, filter_value) {
    if (filter_value === undefined) return true
    if (filter_value === null) return play_value === null
    return play_value === Number(filter_value)
  }

  /**
   * Checks if nullable field matches filter (handles null and numeric values)
   * @private
   */
  _matches_nullable_field(play_value, filter_value) {
    if (filter_value === undefined) return true
    if (filter_value === null) return play_value === null
    return play_value === Number(filter_value)
  }

  /**
   * Checks if string field matches filter
   * @private
   */
  _matches_string_field(play_value, filter_value) {
    if (!filter_value) return true
    return play_value === filter_value
  }

  /**
   * Checks if team field matches filter (normalizes team names)
   * @private
   */
  _matches_team_field(play_value, filter_value) {
    if (!filter_value) {
      return true
    }
    return play_value === fixTeam(filter_value)
  }

  /**
   * Checks if time field matches filter with optional tolerance
   * @param {number} play_value - Play's sec_rem_qtr value
   * @param {number} filter_value - Filter sec_rem_qtr value
   * @param {number} tolerance - Tolerance in seconds (default: 0 for exact match)
   * @returns {boolean} True if matches within tolerance
   * @private
   */
  _matches_time_field(play_value, filter_value, tolerance = 0) {
    if (filter_value === undefined) return true
    if (filter_value === null) return play_value === null

    const play_time = Number(play_value)
    const filter_time = Number(filter_value)

    // If no tolerance, require exact match
    if (tolerance === 0 || tolerance === undefined) {
      return play_time === filter_time
    }

    // Match if within tolerance range
    const diff = Math.abs(play_time - filter_time)
    return diff <= tolerance
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
