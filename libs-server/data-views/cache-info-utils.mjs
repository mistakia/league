import { current_season } from '#constants'

// Common cache TTL values in milliseconds
const CACHE_TTL = {
  ONE_HOUR: 1000 * 60 * 60,
  TWO_HOURS: 1000 * 60 * 60 * 2,
  SIX_HOURS: 1000 * 60 * 60 * 6,
  TWELVE_HOURS: 1000 * 60 * 60 * 12,
  ONE_DAY: 1000 * 60 * 60 * 24,
  TWO_DAYS: 1000 * 60 * 60 * 24 * 2,
  ONE_WEEK: 1000 * 60 * 60 * 24 * 7,
  THIRTY_DAYS: 1000 * 60 * 60 * 24 * 30
}

// Default parameter extractor - ensures year and week are arrays
const default_get_params = ({ params = {} } = {}) => {
  const year = params.year || []
  const week = params.week || []
  return {
    year: Array.isArray(year)
      ? year.filter((y) => y != null)
      : year != null
        ? [year]
        : [],
    week: Array.isArray(week)
      ? week.filter((w) => w != null)
      : week != null
        ? [week]
        : []
  }
}

// Enhanced cache info that considers week-level data freshness
// For play/game data: previous weeks are treated as historical
// For season-level data: all current season data may update weekly
export const create_season_cache_info = ({
  current_season_ttl = CACHE_TTL.SIX_HOURS,
  historical_ttl = CACHE_TTL.THIRTY_DAYS,
  get_params = default_get_params,
  is_season_level = false // true for data that updates throughout the season
} = {}) => {
  return ({ params = {} } = {}) => {
    const { year, week } = get_params({ params })

    // If no year specified, treat as current season data
    if (!year || year.length === 0) {
      return {
        cache_ttl: current_season_ttl,
        cache_expire_at: null
      }
    }

    // Historical data (previous seasons)
    if (!year.includes(current_season.year)) {
      return {
        cache_ttl: historical_ttl,
        cache_expire_at: null
      }
    }

    // Current season data
    if (is_season_level) {
      // Season-level data updates throughout the season
      return {
        cache_ttl: current_season_ttl,
        cache_expire_at: null
      }
    }

    // Week-level data (play/game data)
    // If no weeks specified, treat as current data
    if (!week || week.length === 0) {
      return {
        cache_ttl: current_season_ttl,
        cache_expire_at: null
      }
    }

    // If specific weeks are requested and they're all in the past, treat as historical
    if (week.every((w) => w < current_season.week)) {
      return {
        cache_ttl: historical_ttl,
        cache_expire_at: null
      }
    }

    // Current or future week data
    return {
      cache_ttl: current_season_ttl,
      cache_expire_at: null
    }
  }
}

// Cache info for frequently updated data (e.g., practice reports)
export const create_frequent_update_cache_info = ({
  get_params = default_get_params
} = {}) => {
  return create_season_cache_info({
    current_season_ttl: CACHE_TTL.TWO_HOURS,
    historical_ttl: CACHE_TTL.THIRTY_DAYS,
    get_params
  })
}

// Cache info for betting markets data
export const create_betting_cache_info = ({
  get_params = default_get_params
} = {}) => {
  return create_season_cache_info({
    current_season_ttl: CACHE_TTL.ONE_HOUR,
    historical_ttl: CACHE_TTL.THIRTY_DAYS,
    get_params
  })
}

// Cache info for static data (e.g., contracts)
export const create_static_cache_info = ({ ttl = CACHE_TTL.ONE_WEEK } = {}) => {
  return () => ({
    cache_ttl: ttl,
    cache_expire_at: null
  })
}

// Cache info for data that never changes once set
export const create_immutable_cache_info = () => {
  return () => ({
    cache_ttl: CACHE_TTL.THIRTY_DAYS,
    cache_expire_at: null
  })
}

// Cache info for data that checks exact year match (not array inclusion)
export const create_exact_year_cache_info = ({
  current_year_ttl = CACHE_TTL.SIX_HOURS,
  historical_ttl = CACHE_TTL.THIRTY_DAYS,
  get_year = (params) => params.year
} = {}) => {
  return ({ params = {} } = {}) => {
    const year = get_year(params)

    // If no year specified, treat as current year data
    if (year === undefined || year === null || year === current_season.year) {
      return {
        cache_ttl: current_year_ttl,
        cache_expire_at: null
      }
    } else {
      return {
        cache_ttl: historical_ttl,
        cache_expire_at: null
      }
    }
  }
}

// Cache info for data with custom date-based logic
export const create_date_based_cache_info = ({
  get_date_params,
  calculate_ttl,
  fallback_ttl = CACHE_TTL.SIX_HOURS // fallback when date params are undefined
} = {}) => {
  return ({ params = {} } = {}) => {
    const date_params = get_date_params({ params })
    const cache_ttl = date_params ? calculate_ttl(date_params) : fallback_ttl

    return {
      cache_ttl,
      cache_expire_at: null
    }
  }
}

// Cache info for play-by-play data (considers week granularity)
export const create_play_data_cache_info = ({
  get_params = default_get_params
} = {}) => {
  return create_season_cache_info({
    current_season_ttl: CACHE_TTL.SIX_HOURS,
    historical_ttl: CACHE_TTL.THIRTY_DAYS,
    get_params,
    is_season_level: false // play data is week-specific
  })
}

// Cache info for season-aggregate data (updates throughout season)
export const create_season_aggregate_cache_info = ({
  get_params = default_get_params
} = {}) => {
  return create_season_cache_info({
    current_season_ttl: CACHE_TTL.TWELVE_HOURS, // Less frequent updates for aggregates
    historical_ttl: CACHE_TTL.THIRTY_DAYS,
    get_params,
    is_season_level: true // aggregate data updates all season
  })
}

// Export TTL constants for custom implementations
export { CACHE_TTL }
