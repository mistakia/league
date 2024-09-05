export default function league_has_starting_position({ pos, league }) {
  switch (pos) {
    case 'QB':
      return Boolean(league.sqb || league.sqbrbwrte)
    case 'RB':
      return Boolean(
        league.srb || league.srbwr || league.srbwrte || league.sqbrbwrte
      )
    case 'WR':
      return Boolean(
        league.swr ||
          league.srbwr ||
          league.srbwrte ||
          league.swrte ||
          league.sqbrbwrte
      )
    case 'TE':
      return Boolean(
        league.ste || league.srbwrte || league.swrte || league.sqbrbwrte
      )
    case 'K':
      return Boolean(league.sk)
    case 'DST':
      return Boolean(league.sdst)
  }
}
