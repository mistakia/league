import { readFileSync } from 'fs'
import secure_config from '@tsmx/secure-config'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const current_file_path = fileURLToPath(import.meta.url)
const config_dir = dirname(current_file_path)

// CONFIG_ENCRYPTION_KEY_FILE is required. The file is dereferenced here and
// written to process.env.CONFIG_ENCRYPTION_KEY as a process-internal carrier
// so @tsmx/secure-config (which only reads CONFIG_ENCRYPTION_KEY directly)
// can pick it up. Any inherited inline CONFIG_ENCRYPTION_KEY value is
// overwritten — the inline env var is never trusted as a configuration source.
if (!process.env.CONFIG_ENCRYPTION_KEY_FILE) {
  throw new Error('CONFIG_ENCRYPTION_KEY_FILE must be set')
}
try {
  process.env.CONFIG_ENCRYPTION_KEY = readFileSync(
    process.env.CONFIG_ENCRYPTION_KEY_FILE,
    'utf8'
  ).trim()
} catch (err) {
  throw new Error(
    `CONFIG_ENCRYPTION_KEY_FILE unreadable: ${process.env.CONFIG_ENCRYPTION_KEY_FILE}: ${err.code || err.message}`
  )
}

const config = secure_config({ directory: config_dir })

export default config
