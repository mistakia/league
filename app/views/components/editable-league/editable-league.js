import React from 'react'

import Icon from '@components/icon'
import EditableLeagueField from '@components/editable-league-field'
import GenerateSchedule from '@components/generate-schedule'
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
            {isCommish &&
              <div className='editable__league-section'>
                <GenerateSchedule leagueId={league.uid} />
              </div>}
            <div className='editable__league-section'>
              <EditableLeagueField
                field='name'
                label='Name'
                {...props}
              />
              <EditableLeagueField
                  label='Number of Teams'
                  field='nteams'
                  type='int'
                  {...props}
                  />
              <EditableLeagueField
                label='FAAB Budget'
                field='faab'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='CAP Limit'
                field='cap'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Starting Lineup</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                field='sqb'
                label='QB'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='RB'
                field='srb'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='WR'
                field='swr'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='TE'
                field='ste'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='K'
                field='sk'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='DST'
                field='sdst'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='RB/WR'
                field='srbwr'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='RB/WR/TE'
                field='srbwrte'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='QB/RB/WR/TE'
                field='sqbrbwrte'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='WR/TE'
                field='swrte'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Roster Limits</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='QB'
                field='mqb'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='RB'
                field='mrb'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='WR'
                field='mwr'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='TE'
                field='mte'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='K'
                field='mk'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='DST'
                field='mdst'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='Bench'
                field='bench'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='PS'
                field='ps'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='IR'
                field='ir'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts passing</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Attempts'
                field='pa'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Completions'
                field='pc'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Yards'
                field='py'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Ints'
                field='ints'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='Tds'
                field='tdp'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts rushing</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Attempts'
                field='ra'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Yards'
                field='ry'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Fumbles'
                field='fuml'
                type='int'
                {...props}
              />
              <EditableLeagueField
                label='Tds'
                field='tdr'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts receiving</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Receptions'
                field='rec'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Yards'
                field='recy'
                type='float'
                {...props}
              />
              <EditableLeagueField
                label='Tds'
                field='tdrec'
                type='int'
                {...props}
              />
            </div>
            <div className='editable__league-section-title'>Pts misc</div>
            <div className='editable__league-section'>
              <EditableLeagueField
                label='Two PT Conv.'
                field='twoptc'
                type='int'
                {...props}
              />
            </div>
          </div>}
      </div>
    )
  }
}
