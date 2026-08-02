// Division count is a function of league size, not a league setting: divisions
// of exactly three teams where the team count divides by three, otherwise a
// single division holding every team. So a 12-team league runs four divisions
// and a 10-team league runs one.
export const DIVISION_SIZE = 3

const get_division_count = (num_teams) =>
  num_teams >= DIVISION_SIZE && num_teams % DIVISION_SIZE === 0
    ? num_teams / DIVISION_SIZE
    : 1

export default get_division_count
