import { current_season } from '#constants'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || []
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }
  return { year, week }
}

export const get_cache_info_for_fields_from_plays = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })

  // TODO factor in week

  if (year.length) {
    if (year.includes(current_season.year)) {
      return {
        cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
        // TODO should expire before the next game starts
        cache_expire_at: null
      }
    } else {
      // includes only prior years
      return {
        cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
        cache_expire_at: null
      }
    }
  } else {
    // includes the current year
    return {
      cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
      // TODO should expire before the next game starts
      cache_expire_at: null
    }
  }
}
