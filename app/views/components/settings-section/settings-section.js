import React from 'react'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import './settings-section.styl'

import Accordion from '@components/accordion'

export default function SettingsSection({
  title,
  description,
  body,
  defaultOpen = false
}) {
  return (
    <Accordion
      default_expanded={defaultOpen}
      summary={
        <>
          <div className='settings__section-title'>{title}</div>
          <div className='settings__section-description'>{description}</div>
        </>
      }
    >
      <Grid container spacing={2}>
        {body}
      </Grid>
    </Accordion>
  )
}

SettingsSection.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  body: PropTypes.element,
  defaultOpen: PropTypes.bool
}
