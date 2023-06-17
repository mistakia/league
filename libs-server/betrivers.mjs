import fetch from 'node-fetch'

import config from '#config'

export const get_market_groups = async () => {
  const url = `${config.betrivers_market_groups_api_url}/offering/v2018/rsiusmd/group.json?t=1678603265664&lang=en_US&market=US-MD`
  const res = await fetch(url)
  const data = await res.json()

  if (data && data.group && data.group.groups && data.group.groups.length) {
    const american_football_groups = data.group.groups.find(
      (g) => g.id === 1000093199
    )

    if (!american_football_groups) {
      return []
    }

    const nfl_groups = american_football_groups.groups.filter((g) =>
      g.name.toLowerCase().includes('nfl')
    )
    return nfl_groups
  }

  return []
}

export const get_group_events = async (group_id) => {
  const url = `${config.betrivers_api_url}/service/sportsbook/offering/listview/events?t=2023212700&cageCode=410&type=futures&groupId=${group_id}&pageNr=1&pageSize=20&offset=0`
  const res = await fetch(url)
  const data = await res.json()

  if (data && data.items) {
    return data.items
  }

  return []
}

export const get_event_markets = async (event_id) => {
  const url = `${config.betrivers_api_url}/service/sportsbook/offering/listview/details?eventId=${event_id}&cageCode=410`
  const res = await fetch(url)
  const data = await res.json()
  return data
}
