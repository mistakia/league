import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Grid from '@mui/material/Grid'

import './settings-section.styl'

import Icon from '@components/icon'

export default function SettingsSection({
  title,
  description,
  body,
  defaultOpen = false
}) {
  const [open, set_open] = useState(defaultOpen)

  return (
    <Accordion expanded={open} onChange={() => set_open(!open)}>
      <AccordionSummary expandIcon={<Icon name='arrow-down' />}>
        <div className='settings__section-title'>{title}</div>
        <div className='settings__section-description'>{description}</div>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          {body}
        </Grid>
      </AccordionDetails>
    </Accordion>
  )
}

SettingsSection.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  body: PropTypes.element,
  defaultOpen: PropTypes.bool
}
