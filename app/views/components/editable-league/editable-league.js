import React from 'react'

import Icon from '@components/icon'
import EditableLeagueField from '@components/editable-league-field'
import { DEFAULT_LEAGUE_ID } from '@core/constants'

import './editable-league.styl'

export default class EditableLeague extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      visible: false
    }
  }

  handleClick = (event) => {
    this.setState({ visible: !this.state.visible })
  }

  onchange = (value) => {
    const leagueId = this.props.league.uid || DEFAULT_LEAGUE_ID
    this.props.update({ leagueId, ...value })
  }

  render = () => {
    const { league, userId } = this.props

    const isCommish = league.commishid === userId
    const isDefault = !league.commishid

    const classNames = ['editable__league']
    if (this.state.visible) {
      classNames.push('expanded')
    }

    const props = { league, isCommish, isDefault, onchange: this.onchange }

    return (
      <div className={classNames.join(' ')}>
        <div className='editable__league-head' onClick={this.handleClick}>
          <div className='editable__league-title'>League: {league.name}</div>
          <Icon className='editable__league-icon' name='arrow-down' />
        </div>
        {this.state.visible &&
          <div className='editable__league-body'>
            <div className='editable__league-section'>
              <EditableLeagueField
                field='name'
                label='Name'
                length={80}
                {...props}
              />
              <EditableLeagueField
                label='Number of Teams'
                field='nteams'
                type='int'
                max={20}
                min={4}
                {...props}
              />
              <EditableLeagueField
                label='FAAB Budget'
                field='faab'
                type='int'
                max={1000000}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='CAP Limit'
                field='cap'
                type='int'
                max={1000000}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Min Bid'
                field='minBid'
                type='int'
                max={1}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Starting Lineup</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                field='sqb'
                label='QB'
                type='int'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='RB'
                field='srb'
                type='int'
                max={3}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='WR'
                field='swr'
                type='int'
                max={3}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='TE'
                field='ste'
                type='int'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='K'
                field='sk'
                type='int'
                max={1}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='DST'
                field='sdst'
                type='int'
                max={1}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='RB/WR'
                field='srbwr'
                type='int'
                max={3}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='RB/WR/TE'
                field='srbwrte'
                type='int'
                max={3}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='QB/RB/WR/TE'
                field='sqbrbwrte'
                type='int'
                max={1}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='WR/TE'
                field='swrte'
                type='int'
                max={2}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Roster Limits</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='QB'
                field='mqb'
                type='int'
                max={7}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='RB'
                field='mrb'
                type='int'
                max={20}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='WR'
                field='mwr'
                type='int'
                max={20}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='TE'
                field='mte'
                type='int'
                max={10}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='K'
                field='mk'
                type='int'
                max={5}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='DST'
                field='mdst'
                type='int'
                max={4}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Bench'
                field='bench'
                type='int'
                max={20}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='PS'
                field='ps'
                type='int'
                max={10}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='IR'
                field='ir'
                type='int'
                max={5}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts passing</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Attempts'
                field='pa'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Completions'
                field='pc'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Yards'
                field='py'
                type='float'
                max={1}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Ints'
                field='ints'
                type='int'
                max={0}
                min={-3}
                {...props}
              />
              <EditableLeagueField
                label='Tds'
                field='tdp'
                type='int'
                max={12}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts rushing</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Attempts'
                field='ra'
                type='float'
                max={1}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Yards'
                field='ry'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Fumbles'
                field='fuml'
                type='int'
                max={0}
                min={-3}
                {...props}
              />
              <EditableLeagueField
                label='Tds'
                field='tdr'
                type='int'
                max={12}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts receiving</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Rec. (RB)'
                field='rbrec'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Rec. (WR)'
                field='wrrec'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Rec. (TE)'
                field='terec'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Rec. (Other)'
                field='rec'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Yards'
                field='recy'
                type='float'
                max={2}
                min={0}
                {...props}
              />
              <EditableLeagueField
                label='Tds'
                field='tdrec'
                type='int'
                max={12}
                min={0}
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts misc</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Two PT Conv.'
                field='twoptc'
                type='int'
                max={4}
                min={0}
                {...props}
              />
            </div>
          </div>}
      </div>
    )
  }
}
