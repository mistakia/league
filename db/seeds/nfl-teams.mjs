export default async function (knex) {
  await knex('player').insert([
    {
      pid: 'ARI',
      fname: 'Arizona',
      lname: 'Cardinals',
      pname: 'Cardinals',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'ARI',
      dob: '0000-00-00'
    },
    {
      pid: 'ATL',
      fname: 'Atlanta',
      lname: 'Falcons',
      pname: 'Falcons',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'ATL',
      dob: '0000-00-00'
    },
    {
      pid: 'BAL',
      fname: 'Baltimore',
      lname: 'Ravens',
      pname: 'Ravens',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'BAL',
      dob: '0000-00-00'
    },
    {
      pid: 'BUF',
      fname: 'Buffalo',
      lname: 'Bills',
      pname: 'Bills',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'BUF',
      dob: '0000-00-00'
    },
    {
      pid: 'CAR',
      fname: 'Carolina',
      lname: 'Panthers',
      pname: 'Panthers',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'CAR',
      dob: '0000-00-00'
    },
    {
      pid: 'CHI',
      fname: 'Chicago',
      lname: 'Bears',
      pname: 'Bears',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'CHI',
      dob: '0000-00-00'
    },
    {
      pid: 'CIN',
      fname: 'Cincinnati',
      lname: 'Bengals',
      pname: 'Bengals',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'CIN',
      dob: '0000-00-00'
    },
    {
      pid: 'CLE',
      fname: 'Cleveland',
      lname: 'Browns',
      pname: 'Browns',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'CLE',
      dob: '0000-00-00'
    },
    {
      pid: 'DAL',
      fname: 'Dallas',
      lname: 'Cowboys',
      pname: 'Cowboys',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'DAL',
      dob: '0000-00-00'
    },
    {
      pid: 'DEN',
      fname: 'Denver',
      lname: 'Broncos',
      pname: 'Broncos',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'DEN',
      dob: '0000-00-00'
    },
    {
      pid: 'DET',
      fname: 'Detroit',
      lname: 'Lions',
      pname: 'Lions',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'DET',
      dob: '0000-00-00'
    },
    {
      pid: 'GB',
      fname: 'Green Bay',
      lname: 'Packers',
      pname: 'Packers',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'GB',
      dob: '0000-00-00'
    },
    {
      pid: 'HOU',
      fname: 'Houston',
      lname: 'Texans',
      pname: 'Texans',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'HOU',
      dob: '0000-00-00'
    },
    {
      pid: 'IND',
      fname: 'Indianapolis',
      lname: 'Colts',
      pname: 'Colts',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'IND',
      dob: '0000-00-00'
    },
    {
      pid: 'JAX',
      fname: 'Jacksonville',
      lname: 'Jaguars',
      pname: 'Jaguars',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'JAX',
      dob: '0000-00-00'
    },
    {
      pid: 'KC',
      fname: 'Kansas City',
      lname: 'Chiefs',
      pname: 'Chiefs',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'KC',
      dob: '0000-00-00'
    },
    {
      pid: 'LA',
      fname: 'Los Angeles',
      lname: 'Rams',
      pname: 'Rams',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'LA',
      dob: '0000-00-00'
    },
    {
      pid: 'LAC',
      fname: 'Los Angeles',
      lname: 'Chargers',
      pname: 'Chargers',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'LAC',
      dob: '0000-00-00'
    },
    {
      pid: 'LV',
      fname: 'Las Vegas',
      lname: 'Raiders',
      pname: 'Raiders',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'LV',
      dob: '0000-00-00'
    },
    {
      pid: 'MIA',
      fname: 'Miami',
      lname: 'Dolphins',
      pname: 'Dolphins',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'MIA',
      dob: '0000-00-00'
    },
    {
      pid: 'MIN',
      fname: 'Minnesota',
      lname: 'Vikings',
      pname: 'Vikings',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'MIN',
      dob: '0000-00-00'
    },
    {
      pid: 'NE',
      fname: 'New England',
      lname: 'Patriots',
      pname: 'Patriots',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'NE',
      dob: '0000-00-00'
    },
    {
      pid: 'NO',
      fname: 'New Orleans',
      lname: 'Saints',
      pname: 'Saints',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'NO',
      dob: '0000-00-00'
    },
    {
      pid: 'NYG',
      fname: 'New York',
      lname: 'Giants',
      pname: 'Giants',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'NYG',
      dob: '0000-00-00'
    },
    {
      pid: 'NYJ',
      fname: 'New York',
      lname: 'Jets',
      pname: 'Jets',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'NYJ',
      dob: '0000-00-00'
    },
    {
      pid: 'PHI',
      fname: 'Philadelphia',
      lname: 'Eagles',
      pname: 'Eagles',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'PHI',
      dob: '0000-00-00'
    },
    {
      pid: 'PIT',
      fname: 'Pittsburgh',
      lname: 'Steelers',
      pname: 'Steelers',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'PIT',
      dob: '0000-00-00'
    },
    {
      pid: 'SEA',
      fname: 'Seattle',
      lname: 'Seahawks',
      pname: 'Seahawks',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'SEA',
      dob: '0000-00-00'
    },
    {
      pid: 'SF',
      fname: 'San Francisco',
      lname: '49ers',
      pname: '49ers',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'SF',
      dob: '0000-00-00'
    },
    {
      pid: 'TB',
      fname: 'Tampa Bay',
      lname: 'Buccaneers',
      pname: 'Buccaneers',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'TB',
      dob: '0000-00-00'
    },
    {
      pid: 'TEN',
      fname: 'Tennessee',
      lname: 'Titans',
      pname: 'Titans',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'TEN',
      dob: '0000-00-00'
    },
    {
      pid: 'WAS',
      fname: 'Washington',
      lname: 'Redskins',
      pname: 'Redskins',
      pos: 'DST',
      pos1: 'DST',
      cteam: 'WAS',
      dob: '0000-00-00'
    }
  ])
}
