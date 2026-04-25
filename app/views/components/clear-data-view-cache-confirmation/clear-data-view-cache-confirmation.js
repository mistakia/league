import React from 'react'
import PropTypes from 'prop-types'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'

export default function ClearDataViewCacheConfirmation({
  onClose,
  clear_local_view_cache
}) {
  const handle_confirm = () => {
    clear_local_view_cache()
    onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Clear local view cache</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This wipes all locally-cached snapshot history for every data view in
          this browser, including unsaved local edits that have not been pushed
          to the server. Server-stored views are not affected and will reload
          on the next request.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} text>
          Cancel
        </Button>
        <Button onClick={handle_confirm} text>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

ClearDataViewCacheConfirmation.propTypes = {
  onClose: PropTypes.func,
  clear_local_view_cache: PropTypes.func
}
