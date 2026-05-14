import { readFileSync } from 'fs'
import secure_config from '@tsmx/secure-config'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const current_file_path = fileURLToPath(import.meta.url)
const config_dir = dirname(current_file_path)

// _FILE indirection: if CONFIG_ENCRYPTION_KEY isn't set but
// CONFIG_ENCRYPTION_KEY_FILE is, dereference the file and populate the env
// var so @tsmx/secure-config (which only reads CONFIG_ENCRYPTION_KEY directly)
// can pick it up. Matches the file-based key pattern rolled out in
// user:task/base/migrate-config-encryption-key-to-file-based.md.
if (
  !process.env.CONFIG_ENCRYPTION_KEY &&
  process.env.CONFIG_ENCRYPTION_KEY_FILE
) {
  process.env.CONFIG_ENCRYPTION_KEY = readFileSync(
    process.env.CONFIG_ENCRYPTION_KEY_FILE,
    'utf8'
  ).trim()
}

const config = secure_config({ directory: config_dir })

export default config
