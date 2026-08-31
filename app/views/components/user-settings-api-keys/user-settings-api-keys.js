import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Alert from '@mui/material/Alert'

import './user-settings-api-keys.styl'

const format_timestamp = (value) =>
  value ? new Date(value).toLocaleString() : '—'

const describe_ceiling = (max_rows) =>
  max_rows === null
    ? 'unlimited'
    : `${Number(max_rows).toLocaleString()} rows per request`

export default function UserSettingsApiKeys({
  api_keys,
  data_view_export_max_rows,
  generated_key,
  is_pending,
  load,
  create,
  revoke,
  dismiss_generated_key
}) {
  const [name, set_name] = useState('')

  useEffect(() => {
    load()
  }, [load])

  const handle_create = () => {
    create({ name })
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
        <Alert
          severity='success'
          onClose={dismiss_generated_key}
          className='api-keys__generated'
        >
          Copy this key now — it is shown once and cannot be retrieved again.
          <div className='api-keys__generated-value'>{generated_key}</div>
        </Alert>
      )}

      <div className='api-keys__create'>
        <TextField
          label='Name'
          size='small'
          value={name}
          placeholder='what this key is for'
          inputProps={{ maxLength: 60 }}
          onChange={(event) => set_name(event.target.value)}
        />
        <Button
          variant='contained'
          disabled={is_pending}
          onClick={handle_create}
        >
          Generate key
        </Button>
      </div>

      {active_keys.size === 0 && (
        <p className='api-keys__empty'>No active keys.</p>
      )}

      {api_keys.size > 0 && (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Key</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last used</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {api_keys.map((api_key) => {
              const api_key_id = api_key.get('api_key_id')
              const revoked_at = api_key.get('revoked_at')
              return (
                <TableRow key={api_key_id}>
                  <TableCell>{api_key.get('name') || '—'}</TableCell>
                  <TableCell>{api_key.get('key_prefix')}…</TableCell>
                  <TableCell>
                    {format_timestamp(api_key.get('created_at'))}
                  </TableCell>
                  <TableCell>
                    {format_timestamp(api_key.get('last_used_at'))}
                  </TableCell>
                  <TableCell>
                    {revoked_at ? (
                      <span className='api-keys__revoked'>revoked</span>
                    ) : (
                      <Button
                        size='small'
                        disabled={is_pending}
                        onClick={() => revoke({ api_key_id })}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

UserSettingsApiKeys.propTypes = {
  api_keys: ImmutablePropTypes.list,
  data_view_export_max_rows: PropTypes.number,
  generated_key: PropTypes.string,
  is_pending: PropTypes.bool,
  load: PropTypes.func,
  create: PropTypes.func,
  revoke: PropTypes.func,
  dismiss_generated_key: PropTypes.func
}
