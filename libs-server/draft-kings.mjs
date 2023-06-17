import fetch from 'node-fetch'
// import debug from 'debug'

import config from '#config'
import { constants } from '#libs-shared'

// const log = debug('draft-kings')
// debug.enable('draft-kings')

export const categories = [
  {
    subcategoryId: 9524,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_YARDS
  },
  {
    subcategoryId: 9525,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_TOUCHDOWNS
  },
  {
    subcategoryId: 9522,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_COMPLETIONS
  },
  {
    subcategoryId: 9517,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_ATTEMPTS
  },
  {
    subcategoryId: 9526,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION
  },
  {
    subcategoryId: 9516,
    offerCategoryId: 1000,
    type: constants.player_prop_types.GAME_PASSING_INTERCEPTIONS
  },
  {
    subcategoryId: 9512,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RECEIVING_YARDS
  },
  {
    subcategoryId: 9514,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RUSHING_YARDS
  },
  {
    subcategoryId: 9519,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RECEPTIONS
  },
  {
    subcategoryId: 9523,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS
  },
  {
    subcategoryId: 9518,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_RUSHING_ATTEMPTS
  },
  {
    subcategoryId: 9527,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_LONGEST_RECEPTION
  },
  {
    subcategoryId: 9533,
    offerCategoryId: 1001,
    type: constants.player_prop_types.GAME_LONGEST_RUSH
  },
  {
    subcategoryId: 9521,
    offerCategoryId: 1002,
    type: constants.player_prop_types.GAME_TACKLES_ASSISTS
  },
  {
    subcategoryId: 11555,
    offerCategoryId: 1163,
    type: constants.player_prop_types.SUNDAY_MOST_PASSING_YARDS
  },
  {
    subcategoryId: 11557,
    offerCategoryId: 1163,
    type: constants.player_prop_types.SUNDAY_MOST_RUSHING_YARDS
  },
  {
    subcategoryId: 11556,
    offerCategoryId: 1163,
    type: constants.player_prop_types.GAME_MOST_RECEIVING_YARDS
  },
  {
    subcategoryId: 11819,
    offerCategoryId: 1003,
    type: constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS
  }
]

export const get_offers = async ({ offerCategoryId, subcategoryId }) => {
  const url = `${config.draftkings_api_v6_url}/eventgroups/88808/categories/${offerCategoryId}/subcategories/${subcategoryId}?format=json`

  // log(`fetching ${url}`)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
    const events = data.eventGroup.events || []
    const category = data.eventGroup.offerCategories.find(
      (c) => c.offerCategoryId === offerCategoryId
    )

    if (category) {
      const sub_category = category.offerSubcategoryDescriptors.find(
        (c) => c.subcategoryId === subcategoryId
      )

      if (
        sub_category &&
        sub_category.offerSubcategory &&
        sub_category.offerSubcategory.offers.length
      ) {
        return {
          offers: sub_category.offerSubcategory.offers.flat(),
          events
        }
      }
    }
  }

  return { offers: null, events: [] }
}

export const get_eventgroup_offer_categories = async () => {
  const url = `${config.draftkings_api_v6_url}/eventgroups/88808?format=json`

  // log(`fetching ${url}`)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
    return data.eventGroup.offerCategories
  }

  return []
}

export const get_eventgroup_offer_subcategories = async ({
  offerCategoryId
}) => {
  const url = `${config.draftkings_api_v6_url}/eventgroups/88808/categories/${offerCategoryId}?format=json`

  // log(`fetching ${url}`)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
    const category = data.eventGroup.offerCategories.find(
      (c) => c.offerCategoryId === offerCategoryId
    )

    if (category) {
      return category.offerSubcategoryDescriptors
    }
  }

  return []
}
