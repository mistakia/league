import React, { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useLocation, useSearchParams } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'

import Button from '@components/button'
import { capture_contribution_context } from '@core/contribution-context'

import './contribution-dialog.styl'

// Mirrors api/routes/contributions.mjs so a refusal is not a round trip. The
// floor is deliberately low -- the scarce resource on a report form is
// COMPLETION, and a strict rule rejects real reports.
export const MINIMUM_TITLE_LENGTH = 8
export const MINIMUM_BODY_LENGTH = 20
export const MAXIMUM_TITLE_LENGTH = 200
export const MAXIMUM_BODY_LENGTH = 10000

export default function ContributionDialog({
  is_open,
  submission_kind: initial_submission_kind,
  is_submitting,
  submit_error,
  receipt,
  state,
  open_contribution_dialog,
  close_contribution_dialog,
  dismiss_contribution_receipt,
  submit_contribution
}) {
  const location = useLocation()
  const [search_params, set_search_params] = useSearchParams()

  const [submission_kind, set_submission_kind] = useState(
    initial_submission_kind
  )
  const [submission_title, set_submission_title] = useState('')
  const [submission_body, set_submission_body] = useState('')
  const [captured_context, set_captured_context] = useState(null)
  const [screenshot, set_screenshot] = useState(null)
  const [is_capturing, set_is_capturing] = useState(false)
  const [include_screenshot, set_include_screenshot] = useState(true)

  // Opens from ?report=bug so a support reply can link straight into the form.
  // The parameter is stripped once consumed, so a refresh or a shared URL does
  // not reopen the dialog over whatever the reader navigated to.
  useEffect(() => {
    if (search_params.get('report') !== 'bug') return
    open_contribution_dialog({ submission_kind: 'bug_report' })
    const next_params = new URLSearchParams(search_params)
    next_params.delete('report')
    set_search_params(next_params, { replace: true })
  }, [search_params, open_contribution_dialog, set_search_params])

  useEffect(() => {
    set_submission_kind(initial_submission_kind)
  }, [initial_submission_kind])

  // Captured once per opening. Re-capturing on every keystroke would mean the
  // preview the submitter approved is not the payload that gets sent.
  useEffect(() => {
    if (!is_open) return
    let is_current = true
    set_is_capturing(true)

    // The screenshot module is imported DYNAMICALLY so its capture code lands
    // in this dialog's chunk rather than the main bundle. Almost nobody files
    // a report, and the people who never do should not pay for the ability.
    const capture_screenshot_if_available = async () => {
      try {
        const { capture_screenshot } = await import(
          /* webpackChunkName: "contribution-screenshot" */
          '@core/contribution-screenshot'
        )
        return await capture_screenshot()
      } catch (_error) {
        return null
      }
    }

    Promise.all([
      capture_contribution_context({ state }),
      capture_screenshot_if_available()
    ])
      .then(([context, captured_screenshot]) => {
        if (!is_current) return
        set_captured_context(context)
        set_screenshot(captured_screenshot)
      })
      .catch(() => {
        // DEGRADE, NEVER BLOCK. Context is a triage aid, not a precondition.
        if (!is_current) return
        set_captured_context(null)
        set_screenshot(null)
      })
      .finally(() => {
        if (is_current) set_is_capturing(false)
      })
    return () => {
      is_current = false
    }
  }, [is_open, location.key, state])

  const title_error = useMemo(() => {
    const trimmed = submission_title.trim()
    if (!trimmed.length) return null
    if (trimmed.length < MINIMUM_TITLE_LENGTH) {
      return `At least ${MINIMUM_TITLE_LENGTH} characters`
    }
    return null
  }, [submission_title])

  const body_error = useMemo(() => {
    const trimmed = submission_body.trim()
    if (!trimmed.length) return null
    if (trimmed.length < MINIMUM_BODY_LENGTH) {
      return `At least ${MINIMUM_BODY_LENGTH} characters`
    }
    return null
  }, [submission_body])

  const is_submittable =
    submission_title.trim().length >= MINIMUM_TITLE_LENGTH &&
    submission_body.trim().length >= MINIMUM_BODY_LENGTH &&
    !is_submitting

  const handle_submit = useCallback(() => {
    if (!is_submittable) return
    submit_contribution({
      submission_kind,
      submission_title: submission_title.trim(),
      submission_body: submission_body.trim(),
      captured_context,
      // A screenshot is a picture of whatever was on the submitter's screen,
      // which may include their own roster, their league or their account. It
      // is attached only if they left it attached.
      screenshot: include_screenshot ? screenshot : null
    })
  }, [
    is_submittable,
    submit_contribution,
    submission_kind,
    submission_title,
    submission_body,
    captured_context,
    include_screenshot,
    screenshot
  ])

  const handle_close = useCallback(() => {
    close_contribution_dialog()
  }, [close_contribution_dialog])

  const handle_receipt_close = useCallback(() => {
    set_submission_title('')
    set_submission_body('')
    set_captured_context(null)
    set_screenshot(null)
    set_include_screenshot(true)
    dismiss_contribution_receipt()
  }, [dismiss_contribution_receipt])

  // THE RECEIPT. An anonymous submitter has no account to scope a list to, so
  // the claim token is their only route back to their own report. It is
  // returned exactly once by the create response and there is no resend path,
  // because there is no address to resend to -- hence the blunt warning.
  if (receipt) {
    const submission_id = receipt.get('submission_id')
    const claim_token = receipt.get('claim_token')
    const status_path = claim_token
      ? `/contributions/${submission_id}`
      : '/contributions'

    return (
      <Dialog
        open
        onClose={handle_receipt_close}
        className='contribution-dialog'
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Report received</DialogTitle>
        <DialogContent>
          <p className='contribution-dialog__receipt-lead'>
            Thank you. Your report is queued for triage.
          </p>
          {claim_token ? (
            <>
              <Alert severity='warning'>
                Save this link now. It is the only way back to your report, it
                is shown once, and it cannot be sent to you again.
              </Alert>
              <div className='contribution-dialog__claim'>
                <code>{`${window.location.origin}${status_path}#${claim_token}`}</code>
              </div>
            </>
          ) : (
            <p>
              You can follow it on your{' '}
              <a href='/contributions'>contributions page</a>.
            </p>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handle_receipt_close}>Done</Button>
        </DialogActions>
      </Dialog>
    )
  }

  if (!is_open) return null

  return (
    <Dialog
      open
      onClose={handle_close}
      className='contribution-dialog'
      maxWidth='sm'
      fullWidth
    >
      <DialogTitle>Report a problem</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          size='small'
          value={submission_kind}
          onChange={(event, value) => value && set_submission_kind(value)}
          className='contribution-dialog__kind'
        >
          <ToggleButton value='bug_report'>Something is broken</ToggleButton>
          <ToggleButton value='feature_idea'>I have an idea</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          label='Summary'
          fullWidth
          margin='normal'
          value={submission_title}
          error={Boolean(title_error)}
          helperText={title_error}
          slotProps={{ htmlInput: { maxLength: MAXIMUM_TITLE_LENGTH } }}
          onChange={(event) => set_submission_title(event.target.value)}
        />

        <TextField
          label={
            submission_kind === 'bug_report'
              ? 'What happened, and what did you expect instead?'
              : 'What would you like to be able to do?'
          }
          fullWidth
          multiline
          minRows={5}
          margin='normal'
          value={submission_body}
          error={Boolean(body_error)}
          helperText={body_error}
          slotProps={{ htmlInput: { maxLength: MAXIMUM_BODY_LENGTH } }}
          onChange={(event) => set_submission_body(event.target.value)}
        />

        {/* THE SCREENSHOT IS SHOWN, not merely described. It is a picture of
            whatever was on screen, so a checkbox saying "attach a screenshot"
            with nothing to look at asks the submitter to consent to something
            they cannot see. Rendering it is what makes declining meaningful. */}
        {screenshot && (
          <div className='contribution-dialog__screenshot'>
            <FormControlLabel
              control={
                <Checkbox
                  checked={include_screenshot}
                  onChange={(event) =>
                    set_include_screenshot(event.target.checked)
                  }
                />
              }
              label='Attach this screenshot'
            />
            {include_screenshot && (
              <img
                src={screenshot}
                alt='Screenshot of the page as it appeared when you opened this form'
                className='contribution-dialog__screenshot-preview'
              />
            )}
          </div>
        )}

        {/* The submitter sees exactly what is being sent before they send it.
            Every field here is allowlisted at capture -- see
            app/core/contribution-context.js. */}
        <Accordion className='contribution-dialog__context' disableGutters>
          <AccordionSummary>
            {is_capturing
              ? 'Collecting page details…'
              : 'What gets sent with this report'}
          </AccordionSummary>
          <AccordionDetails>
            {is_capturing ? (
              <CircularProgress size={20} />
            ) : (
              <pre className='contribution-dialog__context-preview'>
                {JSON.stringify(captured_context, null, 2)}
              </pre>
            )}
          </AccordionDetails>
        </Accordion>

        {submit_error && <Alert severity='error'>{submit_error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handle_close}>Cancel</Button>
        <Button disabled={!is_submittable} onClick={handle_submit}>
          {is_submitting ? 'Sending…' : 'Send report'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

ContributionDialog.propTypes = {
  is_open: PropTypes.bool,
  submission_kind: PropTypes.string,
  is_submitting: PropTypes.bool,
  submit_error: PropTypes.string,
  receipt: PropTypes.object,
  state: PropTypes.object,
  open_contribution_dialog: PropTypes.func,
  close_contribution_dialog: PropTypes.func,
  dismiss_contribution_receipt: PropTypes.func,
  submit_contribution: PropTypes.func
}
