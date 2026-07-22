export default async function (knex) {
  await knex('player').insert([
    {
      pid: 'ARI',
      first_name: 'Arizona',
      last_name: 'Cardinals',
      short_name: 'Cardinals',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'ARI',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'ATL',
      first_name: 'Atlanta',
      last_name: 'Falcons',
      short_name: 'Falcons',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'ATL',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'BAL',
      first_name: 'Baltimore',
      last_name: 'Ravens',
      short_name: 'Ravens',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'BAL',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'BUF',
      first_name: 'Buffalo',
      last_name: 'Bills',
      short_name: 'Bills',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'BUF',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'CAR',
      first_name: 'Carolina',
      last_name: 'Panthers',
      short_name: 'Panthers',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'CAR',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'CHI',
      first_name: 'Chicago',
      last_name: 'Bears',
      short_name: 'Bears',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'CHI',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'CIN',
      first_name: 'Cincinnati',
      last_name: 'Bengals',
      short_name: 'Bengals',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'CIN',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'CLE',
      first_name: 'Cleveland',
      last_name: 'Browns',
      short_name: 'Browns',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'CLE',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'DAL',
      first_name: 'Dallas',
      last_name: 'Cowboys',
      short_name: 'Cowboys',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'DAL',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'DEN',
      first_name: 'Denver',
      last_name: 'Broncos',
      short_name: 'Broncos',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'DEN',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'DET',
      first_name: 'Detroit',
      last_name: 'Lions',
      short_name: 'Lions',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'DET',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'GB',
      first_name: 'Green Bay',
      last_name: 'Packers',
      short_name: 'Packers',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'GB',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'HOU',
      first_name: 'Houston',
      last_name: 'Texans',
      short_name: 'Texans',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'HOU',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'IND',
      first_name: 'Indianapolis',
      last_name: 'Colts',
      short_name: 'Colts',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'IND',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'JAX',
      first_name: 'Jacksonville',
      last_name: 'Jaguars',
      short_name: 'Jaguars',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'JAX',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'KC',
      first_name: 'Kansas City',
      last_name: 'Chiefs',
      short_name: 'Chiefs',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'KC',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'LA',
      first_name: 'Los Angeles',
      last_name: 'Rams',
      short_name: 'Rams',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'LA',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'LAC',
      first_name: 'Los Angeles',
      last_name: 'Chargers',
      short_name: 'Chargers',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'LAC',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'LV',
      first_name: 'Las Vegas',
      last_name: 'Raiders',
      short_name: 'Raiders',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'LV',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'MIA',
      first_name: 'Miami',
      last_name: 'Dolphins',
      short_name: 'Dolphins',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'MIA',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'MIN',
      first_name: 'Minnesota',
      last_name: 'Vikings',
      short_name: 'Vikings',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'MIN',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'NE',
      first_name: 'New England',
      last_name: 'Patriots',
      short_name: 'Patriots',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'NE',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'NO',
      first_name: 'New Orleans',
      last_name: 'Saints',
      short_name: 'Saints',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'NO',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'NYG',
      first_name: 'New York',
      last_name: 'Giants',
      short_name: 'Giants',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'NYG',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'NYJ',
      first_name: 'New York',
      last_name: 'Jets',
      short_name: 'Jets',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'NYJ',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'PHI',
      first_name: 'Philadelphia',
      last_name: 'Eagles',
      short_name: 'Eagles',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'PHI',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'PIT',
      first_name: 'Pittsburgh',
      last_name: 'Steelers',
      short_name: 'Steelers',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'PIT',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'SEA',
      first_name: 'Seattle',
      last_name: 'Seahawks',
      short_name: 'Seahawks',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'SEA',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'SF',
      first_name: 'San Francisco',
      last_name: '49ers',
      short_name: '49ers',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'SF',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'TB',
      first_name: 'Tampa Bay',
      last_name: 'Buccaneers',
      short_name: 'Buccaneers',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'TB',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'TEN',
      first_name: 'Tennessee',
      last_name: 'Titans',
      short_name: 'Titans',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'TEN',
      date_of_birth: '0000-00-00'
    },
    {
      pid: 'WAS',
      first_name: 'Washington',
      last_name: 'Redskins',
      short_name: 'Redskins',
      primary_position: 'DST',
      secondary_position: 'DST',
      current_nfl_team: 'WAS',
      date_of_birth: '0000-00-00'
    }
  ])
}
