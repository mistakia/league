import React from 'react'
import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'

import LeagueTeamsValueOverTime from '@components/league-teams-value-over-time'

import './league-header.styl'

export default function LeagueHeader({ league, is_in_league }) {
  const is_ppr_equal =
    league.terec === league.rbrec && league.terec === league.wrrec
  const isTEP = league.terec !== league.rbrec || league.terec !== league.wrrec
  const isHalfPPR = is_ppr_equal && league.rec === 0.5
  const isFullPPR = is_ppr_equal && league.rec === 1

  // TODO isSalaryCap
  // TODO isHosted
  // TODO espn/sleeper/mfl
  // TODO isDynasty
  // TODO isRedraft

  const scoring_chips = []
  const starting_labels = [
    'qb',
    'rb',
    'wr',
    'te',
    'k',
    'dst',
    'rb/wr',
    'rb/wr/te',
    'qb/rb/wr/te'
  ]

  starting_labels.forEach((starting_label, index) => {
    const clean_label = starting_label.replaceAll('/', '')
    const value = league[`s${clean_label}`]
    if (!value) return
    scoring_chips.push(
      <Chip
        key={index}
        className={`starters ${clean_label}`}
        size='small'
        label={
          starting_label === 'qb/rb/wr/te'
            ? `SUPERFLEX`
            : `${value}${starting_label.toUpperCase()}`
        }
      />
    )
  })
  return (
    <div className='league__header'>
      <h1>{league.name}</h1>
      {!is_in_league && (
        <Stack direction='row' spacing={1} className='league__chips'>
          {Boolean(league.num_teams) && (
            <Chip variant='outlined' label={`${league.num_teams} Teams`} />
          )}
          {isHalfPPR && <Chip size='small' label='Half PPR' />}
          {isFullPPR && <Chip size='small' label='Full PPR' />}
          {isTEP && <Chip size='small' label='TEP' />}
          {scoring_chips}
        </Stack>
      )}
      <LeagueTeamsValueOverTime />
    </div>
  )
}

LeagueHeader.propTypes = {
  league: PropTypes.object,
  is_in_league: PropTypes.bool
}
