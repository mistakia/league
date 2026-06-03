// Test fixture: in-repo encryption key file for decrypting committed test
// fixtures. The keyfile lives at test/fixtures/test-encryption-key; it
// decrypts in-repo test fixtures only and is not a production secret. Loaded
// via mocha --require so test scripts no longer need to inline the key in
// their command strings. The league config bridge reads the file and
// populates process.env.CONFIG_ENCRYPTION_KEY internally.
import path from 'path'
import { fileURLToPath } from 'url'

const current_dir = path.dirname(fileURLToPath(import.meta.url))
process.env.CONFIG_ENCRYPTION_KEY_FILE = path.resolve(
  current_dir,
  'fixtures/test-encryption-key'
)
