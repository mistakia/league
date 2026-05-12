export default async function (knex) {
  await knex('player').insert([
    {
      pid: 'ARI',
      fname: 'Arizona',
      lname: 'Cardinals',
      pname: 'Cardinals',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'ARI',
      dob: '0000-00-00'
    },
    {
      pid: 'ATL',
      fname: 'Atlanta',
      lname: 'Falcons',
      pname: 'Falcons',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'ATL',
      dob: '0000-00-00'
    },
    {
      pid: 'BAL',
      fname: 'Baltimore',
      lname: 'Ravens',
      pname: 'Ravens',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'BAL',
      dob: '0000-00-00'
    },
    {
      pid: 'BUF',
      fname: 'Buffalo',
      lname: 'Bills',
      pname: 'Bills',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'BUF',
      dob: '0000-00-00'
    },
    {
      pid: 'CAR',
      fname: 'Carolina',
      lname: 'Panthers',
      pname: 'Panthers',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'CAR',
      dob: '0000-00-00'
    },
    {
      pid: 'CHI',
      fname: 'Chicago',
      lname: 'Bears',
      pname: 'Bears',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'CHI',
      dob: '0000-00-00'
    },
    {
      pid: 'CIN',
      fname: 'Cincinnati',
      lname: 'Bengals',
      pname: 'Bengals',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'CIN',
      dob: '0000-00-00'
    },
    {
      pid: 'CLE',
      fname: 'Cleveland',
      lname: 'Browns',
      pname: 'Browns',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'CLE',
      dob: '0000-00-00'
    },
    {
      pid: 'DAL',
      fname: 'Dallas',
      lname: 'Cowboys',
      pname: 'Cowboys',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'DAL',
      dob: '0000-00-00'
    },
    {
      pid: 'DEN',
      fname: 'Denver',
      lname: 'Broncos',
      pname: 'Broncos',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'DEN',
      dob: '0000-00-00'
    },
    {
      pid: 'DET',
      fname: 'Detroit',
      lname: 'Lions',
      pname: 'Lions',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'DET',
      dob: '0000-00-00'
    },
    {
      pid: 'GB',
      fname: 'Green Bay',
      lname: 'Packers',
      pname: 'Packers',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'GB',
      dob: '0000-00-00'
    },
    {
      pid: 'HOU',
      fname: 'Houston',
      lname: 'Texans',
      pname: 'Texans',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'HOU',
      dob: '0000-00-00'
    },
    {
      pid: 'IND',
      fname: 'Indianapolis',
      lname: 'Colts',
      pname: 'Colts',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'IND',
      dob: '0000-00-00'
    },
    {
      pid: 'JAX',
      fname: 'Jacksonville',
      lname: 'Jaguars',
      pname: 'Jaguars',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'JAX',
      dob: '0000-00-00'
    },
    {
      pid: 'KC',
      fname: 'Kansas City',
      lname: 'Chiefs',
      pname: 'Chiefs',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'KC',
      dob: '0000-00-00'
    },
    {
      pid: 'LA',
      fname: 'Los Angeles',
      lname: 'Rams',
      pname: 'Rams',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'LA',
      dob: '0000-00-00'
    },
    {
      pid: 'LAC',
      fname: 'Los Angeles',
      lname: 'Chargers',
      pname: 'Chargers',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'LAC',
      dob: '0000-00-00'
    },
    {
      pid: 'LV',
      fname: 'Las Vegas',
      lname: 'Raiders',
      pname: 'Raiders',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'LV',
      dob: '0000-00-00'
    },
    {
      pid: 'MIA',
      fname: 'Miami',
      lname: 'Dolphins',
      pname: 'Dolphins',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'MIA',
      dob: '0000-00-00'
    },
    {
      pid: 'MIN',
      fname: 'Minnesota',
      lname: 'Vikings',
      pname: 'Vikings',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'MIN',
      dob: '0000-00-00'
    },
    {
      pid: 'NE',
      fname: 'New England',
      lname: 'Patriots',
      pname: 'Patriots',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'NE',
      dob: '0000-00-00'
    },
    {
      pid: 'NO',
      fname: 'New Orleans',
      lname: 'Saints',
      pname: 'Saints',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'NO',
      dob: '0000-00-00'
    },
    {
      pid: 'NYG',
      fname: 'New York',
      lname: 'Giants',
      pname: 'Giants',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'NYG',
      dob: '0000-00-00'
    },
    {
      pid: 'NYJ',
      fname: 'New York',
      lname: 'Jets',
      pname: 'Jets',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'NYJ',
      dob: '0000-00-00'
    },
    {
      pid: 'PHI',
      fname: 'Philadelphia',
      lname: 'Eagles',
      pname: 'Eagles',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'PHI',
      dob: '0000-00-00'
    },
    {
      pid: 'PIT',
      fname: 'Pittsburgh',
      lname: 'Steelers',
      pname: 'Steelers',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'PIT',
      dob: '0000-00-00'
    },
    {
      pid: 'SEA',
      fname: 'Seattle',
      lname: 'Seahawks',
      pname: 'Seahawks',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'SEA',
      dob: '0000-00-00'
    },
    {
      pid: 'SF',
      fname: 'San Francisco',
      lname: '49ers',
      pname: '49ers',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'SF',
      dob: '0000-00-00'
    },
    {
      pid: 'TB',
      fname: 'Tampa Bay',
      lname: 'Buccaneers',
      pname: 'Buccaneers',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'TB',
      dob: '0000-00-00'
    },
    {
      pid: 'TEN',
      fname: 'Tennessee',
      lname: 'Titans',
      pname: 'Titans',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'TEN',
      dob: '0000-00-00'
    },
    {
      pid: 'WAS',
      fname: 'Washington',
      lname: 'Redskins',
      pname: 'Redskins',
      pos: 'DST',
      pos1: 'DST',
      current_nfl_team: 'WAS',
      dob: '0000-00-00'
    }
  ])
}
