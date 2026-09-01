import React from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/modal'
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
    <Modal
      open
      onClose={onClose}
      title='Clear local view cache'
      actions={
        <>
          <Button onClick={onClose} text>
            Cancel
          </Button>
          <Button onClick={handle_confirm} text>
            Confirm
          </Button>
        </>
      }
    >
      <p>
        This wipes all locally-cached snapshot history for every data view in
        this browser, including unsaved local edits that have not been pushed to
        the server. Server-stored views are not affected and will reload on the
        next request.
      </p>
    </Modal>
  )
}

ClearDataViewCacheConfirmation.propTypes = {
  onClose: PropTypes.func,
  clear_local_view_cache: PropTypes.func
}
