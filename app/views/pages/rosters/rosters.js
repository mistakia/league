import React, { useEffect } from 'react'
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
  loadRosters,
  loadLeaguePlayers,
  exportRosters,
  rosters,
  league,
  teams,
  ps_drafted_count_max,
  ps_signed_count_max,
  bench_count_max,
  ir_long_term_count_max
}) {
  const { lid } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    loadLeaguePlayers()
    loadRosters(lid)
  }, [lid, loadRosters, loadLeaguePlayers, navigate])

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

    for (let i = 0; i < ps_drafted_count_max; i++) {
      labels.push(
        <div key={`${i}PSD`} className='roster__item'>
          PSD
        </div>
      )
    }
  }

  if (league.ir) {
    for (let i = 0; i < league.ir; i++) {
      labels.push(
        <div key={`${i}IR`} className='roster__item'>
          IR
        </div>
      )
    }

    for (let i = 0; i < ir_long_term_count_max; i++) {
      labels.push(
        <div key={`${i}IRLT`} className='roster__item'>
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
          ps_signed_count_max,
          bench_count_max,
          ir_long_term_count_max
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
        <Button startIcon={<GetAppIcon />} onClick={exportRosters}>
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
  exportRosters: PropTypes.func,
  ps_drafted_count_max: PropTypes.number,
  ps_signed_count_max: PropTypes.number,
  bench_count_max: PropTypes.number,
  ir_long_term_count_max: PropTypes.number,
  loadLeaguePlayers: PropTypes.func,
  loadRosters: PropTypes.func
}
