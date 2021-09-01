import React from 'react'
import PropTypes from 'prop-types'
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
      case 'default':
        baselineDescription = (
          <>
            <p>
              <strong>Default: </strong> A sensible default baseline to measure
              a players contribution to your starting lineup.
            </p>
            <p>
              It is heavily based on the worst starter baseline with minor
              adjustments to account for the value of depth and unexpected
              injuries. You shouldn&apos;t change the baseline (i.e. how value
              is measured) but the assumptions that go into it (i.e. the
              projections), as this is the most sensible way to measure value.
            </p>
          </>
        )
        break

      case 'available':
        baselineDescription = (
          <>
            <p>
              <strong>Best Available: </strong> The best available player at
              each position that can be added. This is estimated when rosters
              are not full but dynamically updates with each roster transaction.
            </p>
            <p>
              Somewhat useful for determining the value of depth. Provides a
              good &quot;floor&quot; value for starters. Provides a good
              &quot;ceiling&quot; value for depth players.
            </p>
          </>
        )
        break

      case 'starter':
        baselineDescription = (
          <>
            <p>
              <strong>Worst Starter: </strong> The worst player at each position
              on a starting lineup
            </p>
            <p>
              Useful for determining the true value of a players contribution to
              your starting lineup. Provides a good &quot;ceiling&quot; value
              for starters.
            </p>
          </>
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
                replacement calculations. It is advised to use the{' '}
                <strong>default</strong> baseline.
              </p>
            </div>
          </div>
        </AccordionDetails>
      </Accordion>
    )
  }
}

SettingsValue.propTypes = {
  baselines: PropTypes.object,
  vbaseline: PropTypes.string
}
