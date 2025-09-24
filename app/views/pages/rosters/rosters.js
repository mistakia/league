import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import GetAppIcon from '@mui/icons-material/GetApp'
import Button from '@mui/material/Button'

import DashboardDraftPicks from '@components/dashboard-draft-picks'
import PageLayout from '@layouts/page'
import Roster from '@components/roster'

import './rosters.styl'

export default function RostersPage({
  load_rosters,
  load_league_players,
  export_rosters,
  rosters,
  league,
  teams,
  ps_drafted_count_max,
  ps_drafted_threshold_count_max,
  ps_signed_count_max,
  bench_count_max,
  reserve_long_term_count_max
}) {
  const { lid } = useParams()
  const navigate = useNavigate()
  const [is_psd_expanded, set_is_psd_expanded] = useState(false)

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    load_league_players()
    load_rosters(lid)
  }, [lid, load_rosters, load_league_players, navigate])

  const labels = []
  if (league.sqb) {
    for (let i = 0; i < league.sqb; i++) {
      labels.push(
        <div key={`${i}QB`} className='roster__item'>
          QB
        </div>
      )
    }
  }

  if (league.srb) {
    for (let i = 0; i < league.srb; i++) {
      labels.push(
        <div key={`${i}RB`} className='roster__item'>
          RB
        </div>
      )
    }
  }

  if (league.swr) {
    for (let i = 0; i < league.swr; i++) {
      labels.push(
        <div key={`${i}WR`} className='roster__item'>
          WR
        </div>
      )
    }
  }

  if (league.ste) {
    for (let i = 0; i < league.ste; i++) {
      labels.push(
        <div key={`${i}TE`} className='roster__item'>
          TE
        </div>
      )
    }
  }

  if (league.sk) {
    for (let i = 0; i < league.sk; i++) {
      labels.push(
        <div key={`${i}K`} className='roster__item'>
          K
        </div>
      )
    }
  }

  if (league.sdst) {
    for (let i = 0; i < league.sdst; i++) {
      labels.push(
        <div key={`${i}DST`} className='roster__item'>
          DST
        </div>
      )
    }
  }

  if (league.srbwr) {
    for (let i = 0; i < league.srbwr; i++) {
      labels.push(
        <div key={`${i}RBWR`} className='roster__item'>
          RB/WR
        </div>
      )
    }
  }

  if (league.srbwrte) {
    for (let i = 0; i < league.srbwrte; i++) {
      labels.push(
        <div key={`${i}RBWRTE`} className='roster__item'>
          FLEX
        </div>
      )
    }
  }

  if (league.sqbrbwrte) {
    for (let i = 0; i < league.sqbrbwrte; i++) {
      labels.push(
        <div key={`${i}QBRBWRTE`} className='roster__item'>
          SFLEX
        </div>
      )
    }
  }

  if (league.swrte) {
    for (let i = 0; i < league.swrte; i++) {
      labels.push(
        <div key={`${i}WRTE`} className='roster__item'>
          WR/TE
        </div>
      )
    }
  }

  if (bench_count_max) {
    for (let i = 0; i < bench_count_max; i++) {
      labels.push(
        <div key={`${i}BENCH`} className='roster__item'>
          BE
        </div>
      )
    }
  }

  if (league.ps) {
    for (let i = 0; i < ps_signed_count_max; i++) {
      labels.push(
        <div key={`${i}PS`} className='roster__item'>
          PS
        </div>
      )
    }

    const psd_label_count = is_psd_expanded
      ? ps_drafted_count_max
      : ps_drafted_threshold_count_max
    for (let i = 0; i < psd_label_count; i++) {
      labels.push(
        <div key={`${i}PSD`} className='roster__item'>
          PSD
        </div>
      )
    }

    // Add label for toggle/spacer row
    labels.push(<div key='PSD_toggle' className='roster__item' />)
  }

  if (league.reserve_short_term_limit) {
    for (let i = 0; i < league.reserve_short_term_limit; i++) {
      labels.push(
        <div key={`${i}RESERVE_SHORT_TERM`} className='roster__item'>
          IR
        </div>
      )
    }

    for (let i = 0; i < reserve_long_term_count_max; i++) {
      labels.push(
        <div key={`${i}RESERVE_LONG_TERM`} className='roster__item'>
          IR LT
        </div>
      )
    }
  }

  const items = []
  rosters.forEach((roster, index) => {
    items.push(
      <Roster
        key={index}
        tid={roster.tid}
        {...{
          roster,
          ps_drafted_count_max,
          ps_drafted_threshold_count_max,
          ps_signed_count_max,
          bench_count_max,
          reserve_long_term_count_max,
          is_psd_expanded,
          set_is_psd_expanded
        }}
      />
    )
  })

  const pickItems = []
  for (const team of teams.valueSeq()) {
    pickItems.push(<DashboardDraftPicks key={team.uid} picks={team.picks} />)
  }

  const body = (
    <>
      <div className='rosters'>
        <div className='rosters__head'>{labels}</div>
        <div className='rosters__body'>{items}</div>
        <div className='rosters__picks'>{pickItems}</div>
      </div>
      <div className='rosters__footer'>
        <Button startIcon={<GetAppIcon />} onClick={export_rosters}>
          Export CSV
        </Button>
      </div>
    </>
  )

  return <PageLayout body={body} scroll />
}

RostersPage.propTypes = {
  rosters: ImmutablePropTypes.map,
  teams: ImmutablePropTypes.map,
  league: PropTypes.object,
  export_rosters: PropTypes.func,
  ps_drafted_count_max: PropTypes.number,
  ps_drafted_threshold_count_max: PropTypes.number,
  ps_signed_count_max: PropTypes.number,
  bench_count_max: PropTypes.number,
  reserve_long_term_count_max: PropTypes.number,
  load_league_players: PropTypes.func,
  load_rosters: PropTypes.func
}
