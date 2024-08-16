import React, { useState, useRef } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Popper } from '@mui/base/Popper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Paper from '@mui/material/Paper'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import TeamImage from '@components/team-image'

import './league-select-team.styl'

export default function LeagueSelectTeam({
  selected_tid,
  teams,
  historical_ranks
}) {
  const { lid } = useParams()
  const navigate = useNavigate()
  const [popper_open, set_popper_open] = useState(false)
  const anchor_el = useRef(null)

  const handle_team_select = (tid) => {
    navigate(`/leagues/${lid}/teams/${tid}`)
    set_popper_open(false)
  }

  const handle_toggle_popper = () => {
    set_popper_open(!popper_open)
  }

  const handle_click_away = () => {
    set_popper_open(false)
  }

  const selected_team = teams.find((team) => team.uid === selected_tid) || {}
  const historical_rank = historical_ranks[selected_tid] || {}

  const select_items = []
  teams.forEach((team) => {
    select_items.push(
      <div
        key={team.uid}
        className='league-select-team__item'
        onClick={() => handle_team_select(team.uid)}
      >
        <TeamImage tid={team.uid} />
        {team.name}
      </div>
    )
  })

  return (
    <ClickAwayListener onClickAway={handle_click_away}>
      <div className='league-select-team-container'>
        <div className='league-select-team'>
          <TeamImage tid={selected_tid} />
          <div className='league-select-team-info'>
            <div
              className='league-select-team__name'
              onClick={handle_toggle_popper}
              ref={anchor_el}
            >
              {selected_team.name}
              <ArrowDropDownIcon />
            </div>
            <div className='league-select-team-meta'>
              <div>{historical_rank.num_seasons} Seasons</div>
              <div>
                {historical_rank.first_season_year}-
                {historical_rank.last_season_year}
              </div>
            </div>
          </div>
        </div>
        <Popper
          open={popper_open}
          anchorEl={anchor_el.current}
          placement='bottom-start'
          className='league-select-team__popper'
          modifiers={[
            {
              name: 'preventOverflow',
              enabled: true,
              options: {
                altAxis: true,
                altBoundary: true,
                tether: true,
                rootBoundary: 'viewport',
                padding: 8
              }
            },
            {
              name: 'maxSize',
              enabled: true,
              options: {
                max_height: 'viewport'
              }
            }
          ]}
        >
          <Paper className='league-select-team__dropdown'>
            <div className='league-select-team__scroll-container'>
              {select_items}
            </div>
          </Paper>
        </Popper>
      </div>
    </ClickAwayListener>
  )
}

LeagueSelectTeam.propTypes = {
  selected_tid: PropTypes.number,
  teams: ImmutablePropTypes.map,
  historical_ranks: ImmutablePropTypes.map
}
