import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Button from '@components/button'

import './user-settings-api-keys.styl'

// NO MUI ON THIS SURFACE. The section was a stock `Table`/`TextField`/`Alert`
// stack, which brought three type scales and a focus colour none of the app's
// own controls share. It is now the shared language the rest of the site is
// written in: `@components/button`, the `table__*` classes from
// app/styles/table.styl, and the form mixins from app/styles/prose-form.styl —
// the same combination the auth page moved to for the same reason.

const format_timestamp = (value) =>
  value ? new Date(value).toLocaleString() : '—'

const describe_ceiling = (max_rows) =>
  max_rows === null
    ? 'unlimited'
    : `${Number(max_rows).toLocaleString()} rows per request`

const MAX_NAME_LENGTH = 60

// The name cell is the rename control rather than a label with an edit button
// beside it: it is the only mutable field on the row, and the interaction the
// app already uses for an editable setting is a field that commits on blur.
//
// The committed name is `saved_name` from the store, never local state, so what
// the box shows after a request is what the server has. Escape restores it
// without a request.
function ApiKeyNameField({ saved_name, is_editable, rejection_count, rename }) {
  const [value, set_value] = useState(saved_name)

  // Two things put the box back to the stored name, and the second is why
  // `rejection_count` is a dependency rather than dead weight. A rename that
  // LANDS arrives as a new `saved_name` and the box follows it. A rename the
  // API REJECTS leaves `saved_name` exactly as it was, so this effect would
  // never re-run and the typed value would sit there looking saved — a name the
  // server does not have. The count moves on every rejection, which is what
  // makes the failed case reachable at all.
  useEffect(() => {
    set_value(saved_name)
  }, [saved_name, rejection_count])

  if (!is_editable) {
    return <span className='api-keys__name-static'>{saved_name || '—'}</span>
  }

  const commit = () => {
    const next = value.trim()
    if (next === saved_name) return
    if (!next) return set_value(saved_name)
    rename({ name: next })
  }

  const handle_key_down = (event) => {
    if (event.key === 'Enter') return event.target.blur()
    if (event.key === 'Escape') {
      set_value(saved_name)
      event.target.blur()
    }
  }

  return (
    <input
      className='api-keys__name-input'
      type='text'
      value={value}
      aria-label='API key label'
      placeholder='api key label'
      maxLength={MAX_NAME_LENGTH}
      onChange={(event) => set_value(event.target.value)}
      onBlur={commit}
      onKeyDown={handle_key_down}
    />
  )
}

ApiKeyNameField.propTypes = {
  saved_name: PropTypes.string,
  is_editable: PropTypes.bool,
  rejection_count: PropTypes.number,
  rename: PropTypes.func
}

export default function UserSettingsApiKeys({
  api_keys,
  data_view_export_max_rows,
  generated_key,
  is_pending,
  rename_rejection_count,
  load,
  create,
  rename,
  revoke,
  dismiss_generated_key
}) {
  const [name, set_name] = useState('')

  useEffect(() => {
    load()
  }, [load])

  const handle_create = () => {
    create({ name: name.trim() })
    set_name('')
  }

  const active_keys = api_keys.filter((api_key) => !api_key.get('revoked_at'))

  return (
    <div className='setting-section api-keys'>
      <h2>API Keys</h2>
      <p className='api-keys__description'>
        An API key authenticates you on the data view export endpoint, so an
        export made with it returns exactly what you see signed in. Send it as
        an <code>x-api-key</code> header. Your export limit is{' '}
        {describe_ceiling(data_view_export_max_rows)}.
      </p>

      {generated_key && (
        <div className='api-keys__generated' role='status'>
          <div className='api-keys__generated-message'>
            Copy this key now — it is shown once and cannot be retrieved again.
          </div>
          <div className='api-keys__generated-value'>{generated_key}</div>
          <button
            type='button'
            className='api-keys__generated-dismiss'
            aria-label='Dismiss key'
            onClick={dismiss_generated_key}
          >
            ×
          </button>
        </div>
      )}

      <div className='api-keys__create'>
        <input
          className='api-keys__create-input'
          type='text'
          value={name}
          aria-label='API key label'
          placeholder='api key label'
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => set_name(event.target.value)}
        />
        <Button disabled={is_pending} onClick={handle_create}>
          Generate key
        </Button>
      </div>

      {active_keys.size === 0 && (
        <p className='api-keys__empty'>No active keys.</p>
      )}

      {api_keys.size > 0 && (
        <div className='table__container'>
          <div className='table__row table__head'>
            <div className='table__cell api-keys__cell-name'>Name</div>
            <div className='table__cell api-keys__cell-prefix'>Key</div>
            <div className='table__cell api-keys__cell-date'>Created</div>
            <div className='table__cell api-keys__cell-date'>Last used</div>
            <div className='table__cell api-keys__cell-action' />
          </div>
          <div className='table__body'>
            {api_keys.map((api_key) => {
              const api_key_id = api_key.get('api_key_id')
              const revoked_at = api_key.get('revoked_at')
              return (
                <div className='table__row' key={api_key_id}>
                  <div className='table__cell api-keys__cell-name'>
                    <ApiKeyNameField
                      saved_name={api_key.get('name') || ''}
                      is_editable={!revoked_at}
                      rejection_count={rename_rejection_count}
                      rename={({ name }) => rename({ api_key_id, name })}
                    />
                  </div>
                  <div className='table__cell api-keys__cell-prefix'>
                    {api_key.get('key_prefix')}…
                  </div>
                  <div className='table__cell api-keys__cell-date'>
                    {format_timestamp(api_key.get('created_at'))}
                  </div>
                  <div className='table__cell api-keys__cell-date'>
                    {format_timestamp(api_key.get('last_used_at'))}
                  </div>
                  <div className='table__cell api-keys__cell-action'>
                    {revoked_at ? (
                      <span className='api-keys__revoked'>revoked</span>
                    ) : (
                      <Button
                        small
                        text
                        disabled={is_pending}
                        onClick={() => revoke({ api_key_id })}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

UserSettingsApiKeys.propTypes = {
  api_keys: ImmutablePropTypes.list,
  data_view_export_max_rows: PropTypes.number,
  generated_key: PropTypes.string,
  is_pending: PropTypes.bool,
  rename_rejection_count: PropTypes.number,
  load: PropTypes.func,
  create: PropTypes.func,
  rename: PropTypes.func,
  revoke: PropTypes.func,
  dismiss_generated_key: PropTypes.func
}
