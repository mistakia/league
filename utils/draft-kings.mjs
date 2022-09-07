import fetch from 'node-fetch'
import debug from 'debug'

import { constants } from '#common'

const log = debug('draft-kings')
debug.enable('draft-kings')

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
    type: constants.player_prop_types.GAME_SCRIMMAGE_YARDS
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
  }
]

export const getOffers = async ({ offerCategoryId, subcategoryId }) => {
  const url = `https://sportsbook-us-va.draftkings.com//sites/US-VA-SB/api/v5/eventgroups/88808/categories/${offerCategoryId}/subcategories/${subcategoryId}?format=json`

  log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  if (data && data.eventGroup && data.eventGroup.offerCategories) {
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
        return sub_category.offerSubcategory.offers.flat()
      }
    }
  }

  return null
}
