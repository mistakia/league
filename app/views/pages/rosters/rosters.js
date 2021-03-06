import React from 'react'

import PageLayout from '@layouts/page'
import Roster from '@components/roster'
import { constants } from '@common'

import './rosters.styl'

export default class RostersPage extends React.Component {
  render = () => {
    const { rosters, league } = this.props

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

    if (league.ps) {
      for (let i = 0; i < league.ps; i++) {
        labels.push(
          <div key={`${i}PS`} className='roster__item'>
            PS
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
    }

    let benchMax = 0
    const items = []
    for (const [index, roster] of rosters.entries()) {
      const benchSize = roster.players.filter(
        (p) => p.slot === constants.slots.BENCH
      ).size
      if (benchSize > benchMax) benchMax = benchSize
      items.push(<Roster key={index} roster={roster} />)
    }

    if (benchMax) {
      for (let i = 0; i < benchMax; i++) {
        labels.push(
          <div key={`${i}BENCH`} className='roster__item'>
            BE
          </div>
        )
      }
    }

    const body = (
      <div className='rosters'>
        <div className='rosters__head'>{labels}</div>
        <div className='rosters__body'>{items}</div>
      </div>
    )

    return <PageLayout body={body} scroll />
  }
}
