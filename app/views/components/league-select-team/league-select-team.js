import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'

export default function LeagueSelectTeam({ selected_tid, league, teams }) {
  const { lid } = useParams()
  const navigate = useNavigate()

  const handleChange = (event) => {
    const tid = event.target.value
    navigate(`/leagues/${lid}/teams/${tid}`)
  }

  const selectItems = []
  teams.forEach((team, idx) => {
    selectItems.push(
      <MenuItem key={idx} value={team.uid}>
        {team.name}
      </MenuItem>
    )
  })

  return (
    <FormControl size='small' variant='outlined'>
      <InputLabel id='league__select-team-label'>Team</InputLabel>
      <Select
        labelId='league__select-team-label'
        value={selected_tid}
        onChange={handleChange}
        label='Team'
      >
        {selectItems}
      </Select>
    </FormControl>
  )
}

LeagueSelectTeam.propTypes = {
  league: PropTypes.object,
  selected_tid: PropTypes.number,
  teams: ImmutablePropTypes.map
}
