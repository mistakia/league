export default function getActiveRosterLimit(league) {
  return (
    league.sqb +
    league.srb +
    league.swr +
    league.ste +
    league.srbwr +
    league.srbwrte +
    league.sqbrbwrte +
    league.swrte +
    league.sdst +
    league.sk +
    league.bench
  )
}
