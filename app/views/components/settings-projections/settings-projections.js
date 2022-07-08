import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import EditableSource from '@components/editable-source'

export default class SettingsProjections extends React.Component {
  constructor(props) {
    super(props)

    this.state = { open: false }
  }

  handleChange = () => {
    this.setState({ open: !this.state.open })
  }

  render = () => {
    const { sourceIds } = this.props

    const sourceItems = []
    for (const sourceId of sourceIds) {
      sourceItems.push(<EditableSource key={sourceId} sourceId={sourceId} />)
    }

    return (
      <Accordion expanded={this.state.open} onChange={this.handleChange}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <div className='settings__section-title'>Projections</div>
          <div className='settings__section-description'>Edit weights</div>
        </AccordionSummary>
        <AccordionDetails>
          <div className='settings__section-row'>{sourceItems}</div>
        </AccordionDetails>
      </Accordion>
    )
  }
}

SettingsProjections.propTypes = {
  sourceIds: ImmutablePropTypes.list
}
