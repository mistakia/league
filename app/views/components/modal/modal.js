import React, { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'

import './modal.styl'

// THE APP'S DIALOG. Every confirmation in app/ had the same three parts in the
// same order — a title, some content, a row of buttons — so the shape is the
// SIGNATURE here rather than a convention held up by five composable
// sub-components. That is not only tidier: because this component owns the
// title element, it can wire `aria-labelledby` to it itself, which a compound
// API cannot do without threading context through every caller.
//
// It portals to document.body. The layering scale in app/styles/variables.styl
// is only meaningful for a node that is not trapped in some ancestor's stacking
// context, and `transform`, `filter`, `opacity < 1`, `will-change` and
// `contain` all make one — silently, and undetectably from any static sweep.
// Portaling is what makes $z_dialog mean what it says.

const focusable_selector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function Modal({
  open,
  onClose,
  title,
  actions,
  children,
  className
}) {
  const panel_ref = useRef(null)
  const opener_ref = useRef(null)
  const title_id = useId()

  // Focus moves into the dialog on open and back to whatever opened it on
  // close. Without the restore, dismissing a confirmation drops focus to the
  // top of the document and a keyboard user loses their place in the roster.
  useEffect(() => {
    if (!open) return

    opener_ref.current = document.activeElement
    panel_ref.current?.focus()

    return () => {
      const opener = opener_ref.current
      if (opener && typeof opener.focus === 'function') opener.focus()
    }
  }, [open])

  // The page behind must not scroll while a dialog is over it. The previous
  // value is restored rather than cleared, so this cannot strand the body with
  // an overflow it did not have.
  useEffect(() => {
    if (!open) return

    const previous_overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous_overflow
    }
  }, [open])

  const handle_key_down = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = panel_ref.current?.querySelectorAll(focusable_selector)
      if (!focusable || !focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      // Tab out of either end wraps to the other. The panel itself is
      // focusable, so `document.activeElement` can be the panel rather than a
      // control — in which case forward Tab should land on the first control
      // and the browser's default already does that.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose]
  )

  if (!open) return null

  const class_names = ['modal']
  if (className) class_names.push(className)

  return createPortal(
    <div className={class_names.join(' ')}>
      {/* The scrim is a sibling of the panel rather than its parent, so a
          click on the panel cannot reach it and no stopPropagation is needed
          to keep the dialog from closing when its own content is clicked. */}
      <div className='modal__scrim' onClick={onClose} />
      <div
        ref={panel_ref}
        className='modal__panel'
        role='dialog'
        aria-modal='true'
        aria-labelledby={title_id}
        tabIndex={-1}
        onKeyDown={handle_key_down}
      >
        <div className='modal__title' id={title_id}>
          {title}
        </div>
        <div className='modal__content'>{children}</div>
        {actions && <div className='modal__actions'>{actions}</div>}
      </div>
    </div>,
    document.body
  )
}

Modal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string
}
