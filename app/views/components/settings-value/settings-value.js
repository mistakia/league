import React from 'react'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import EditableValue from '@components/editable-value'
import EditableBaseline from '@components/editable-baseline'

import './settings-value.styl'

export default class SettingsValue extends React.Component {
  constructor(props) {
    super(props)

    this.state = { open: false }
  }

  handleChange = () => {
    this.setState({ open: !this.state.open })
  }

  render = () => {
    const { baselines, vbaseline } = this.props
    const editableBaselines = []
    for (const baseline in baselines) {
      editableBaselines.push(
        <EditableBaseline key={baseline} position={baseline} />
      )
    }

    let baselineDescription
    switch (vbaseline) {
      case 'available':
        baselineDescription = (
          <p>
            <strong>Best Available: </strong> The best available player at each
            position that can be added. This is estimated when rosters are not
            full but dynamically updates with each roster transaction.
          </p>
        )
        break

      case 'bench':
        baselineDescription = (
          <p>
            <strong>Average Bench: </strong> The average player at each position
            on a teams bench
          </p>
        )
        break

      case 'starter':
        baselineDescription = (
          <p>
            <strong>Worst Starter: </strong> The worst player at each position
            on a starting lineup
          </p>
        )
        break

      case 'average':
        baselineDescription = (
          <p>
            <strong>Average Starter: </strong> The average player at each
            position on a starting lineup
          </p>
        )
        break

      case 'hybrid':
        baselineDescription = (
          <p>
            <strong>Hybrid</strong> allows for you to mix{' '}
            <strong>Best Available</strong> and <strong>Worst Starter</strong>{' '}
            based on specified weights. Weights are relative and normalized,
            thus equal weight values are the same as each having a weight of 1.
          </p>
        )
        break

      case 'manual':
        baselineDescription = (
          <p>
            <strong>Manual</strong> allows you to set the baseline for each
            position. Not recommended during the season.
          </p>
        )
        break
    }

    return (
      <Accordion expanded={this.state.open} onChange={this.handleChange}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <div className='settings__section-title'>Value Calculations</div>
          <div className='settings__section-description'>Adjust baselines</div>
        </AccordionSummary>
        <AccordionDetails>
          <div className='settings__section-row'>
            <div className='settings__value-selects'>
              <EditableValue />
              {vbaseline === 'manual' && editableBaselines}
            </div>
            <div className='settings__value-text'>
              {baselineDescription}
              <p>
                The baseline (aka replacement player) used for value over
                replacement calculations. Since only points from starters count,
                the <strong>worst starter</strong> baseline is the best baseline
                to use when determining historical value. When forecasting
                value, there is no right answer, it depends on strategy.{' '}
                <strong>Best Available</strong> will emphasize depth, whereas{' '}
                <strong>Worst Starter</strong> will emphasize the value of
                high-end starters and even more so for{' '}
                <strong>Average Starter</strong>.
              </p>
            </div>
          </div>
        </AccordionDetails>
      </Accordion>
    )
  }
}
