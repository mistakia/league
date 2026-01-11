import secure_config from '@tsmx/secure-config'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const current_file_path = fileURLToPath(import.meta.url)
const config_dir = dirname(current_file_path)

const config = secure_config({ directory: config_dir })

export default config
