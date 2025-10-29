export const get_player_image_url = ({ player_map, width, height }) => {
  const is_team = player_map.get('pos') === 'DST'

  if (is_team) {
    const pid = player_map.get('pid')
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${pid}.png&h=${
      height * 2
    }&w=${height * 2}`
  }

  const espn_id = player_map.get('espn_id')
  return espn_id
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espn_id}.png&w=${
        width * 2
      }&h=${height * 2}&cb=1`
    : null
}
