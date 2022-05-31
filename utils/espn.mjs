import fetch from 'node-fetch'

export const getPlayer = async ({ espn_id }) => {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espn_id}`
  const res = await fetch(url)
  const data = await res.json()
  return data
}
