import crypto from 'crypto'
import debug from 'debug'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { load_sops_json } from '#config'

const log = debug('external:credential-encryption')

/**
 * AES-256-GCM encryption for external league credentials
 *
 * Security considerations:
 * - Uses AES-256-GCM (authenticated encryption)
 * - Random IV per encryption (stored with ciphertext)
 * - Auth tag ensures integrity
 * - Key is a dedicated 32-byte column key delivered via sops/age to {league}
 *   only, resolved lazily at the decrypt site (never from process env)
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

// Dedicated 32-byte AES-256-GCM column key for
// external_league_connections.credentials_encrypted (users' third-party
// fantasy-platform logins). Delivered via sops/age to {league} ONLY -- the sole
// host that runs the external-league encrypt/decrypt site (main API process on
// .45). league-worker-1 / base-storage / macbook2025 hold league CONFIG secrets
// but must NOT decrypt user credentials (least-privilege). The key is resolved
// LAZILY inside get_encryption_key() on first use and memoized -- NEVER at
// module scope: this module is pulled transitively by the API route graph that
// non-recipient hosts import (the test suite loads the route/queue; #config is
// pulled on other hosts), so a {league}-only decrypt at module scope would throw
// at import on every non-recipient. Mirrors finance's
// require_account_connections_key (api/routes/connections.mjs).
const KEY_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'config',
  'external-league-credentials-key.sops.json'
)

let cached_key_hex = null

/**
 * Resolve the dedicated column key from the {league}-only sops file.
 * Lazy, first-call-memoized, fail-closed. There is NO environment/process.env
 * discriminator -- production and every real caller resolve unconditionally from
 * sops; test keys arrive only via the explicit key_hex parameter on
 * encrypt/decrypt, a channel structurally absent on production call sites.
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} If the sops decrypt fails or the key is missing/malformed
 */
function get_encryption_key() {
  if (!cached_key_hex) {
    const loaded = load_sops_json(KEY_FILE)
    const key_hex = loaded?.external_league_credentials_key
    if (!key_hex || !/^[0-9a-fA-F]{64}$/.test(key_hex)) {
      throw new Error(
        'external_league_credentials_key missing or not 64-hex in ' +
          'config/external-league-credentials-key.sops.json'
      )
    }
    // Memoize the resolved VALUE only -- never a throw, so a transient sops
    // failure inside the long-lived API process is retried on the next call
    // rather than permanently poisoning the encrypt/decrypt sites.
    cached_key_hex = key_hex
  }
  return Buffer.from(cached_key_hex, 'hex')
}

/**
 * Resolve the 32-byte key Buffer. An explicit key_hex (unit tests + the one-shot
 * rekey script) takes precedence; production call sites pass nothing and resolve
 * from the {league}-only sops file.
 * @param {string} [key_hex] - optional 64-hex key override (dependency-injection seam)
 * @returns {Buffer} 32-byte encryption key
 */
function resolve_key(key_hex) {
  if (key_hex) {
    if (!/^[0-9a-fA-F]{64}$/.test(key_hex)) {
      throw new Error('key_hex must be 64 hex characters (32 bytes)')
    }
    return Buffer.from(key_hex, 'hex')
  }
  return get_encryption_key()
}

/**
 * Encrypt credentials object
 * @param {Object} credentials - Plain credentials object
 * @param {Object} [options]
 * @param {string} [options.key_hex] - optional 64-hex key override (tests / rekey)
 * @returns {string} Encrypted credentials (base64-encoded: iv + authTag + ciphertext)
 */
export function encrypt_credentials(credentials, { key_hex } = {}) {
  if (!credentials || typeof credentials !== 'object') {
    return null
  }

  // Empty credentials don't need encryption
  if (Object.keys(credentials).length === 0) {
    return null
  }

  try {
    const key = resolve_key(key_hex)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const plaintext = JSON.stringify(credentials)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ])
    const auth_tag = cipher.getAuthTag()

    // Combine: IV (16) + AuthTag (16) + Ciphertext
    const combined = Buffer.concat([iv, auth_tag, encrypted])

    log('Credentials encrypted successfully')
    return combined.toString('base64')
  } catch (error) {
    log('Encryption failed:', error.message)
    throw new Error(`Failed to encrypt credentials: ${error.message}`)
  }
}

/**
 * Decrypt credentials string
 * @param {string} encrypted_string - Base64-encoded encrypted credentials or legacy JSON
 * @param {Object} [options]
 * @param {string} [options.key_hex] - optional 64-hex key override (tests / rekey)
 * @returns {Object} Decrypted credentials object (empty object if input is null/empty)
 * @throws {Error} If decryption fails or encrypted data is malformed
 */
export function decrypt_credentials(encrypted_string, { key_hex } = {}) {
  if (!encrypted_string) {
    return {}
  }

  // Handle legacy unencrypted JSON (for migration from older versions)
  if (encrypted_string.startsWith('{')) {
    try {
      log('Detected legacy unencrypted credentials, parsing as JSON')
      return JSON.parse(encrypted_string)
    } catch (parse_error) {
      log('Failed to parse as JSON, attempting to decrypt as encrypted format')
      // Fall through to encrypted format handling
    }
  }

  try {
    const key = resolve_key(key_hex)
    const combined = Buffer.from(encrypted_string, 'base64')

    // Validate minimum length (IV + AuthTag = 32 bytes minimum)
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error(
        `Encrypted data too short: expected at least ${IV_LENGTH + AUTH_TAG_LENGTH} bytes, got ${combined.length}`
      )
    }

    // Extract components: IV (16) + AuthTag (16) + Ciphertext
    const iv = combined.subarray(0, IV_LENGTH)
    const auth_tag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(auth_tag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ])

    log('Credentials decrypted successfully')
    return JSON.parse(decrypted.toString('utf8'))
  } catch (error) {
    log('Decryption failed:', error.message)
    throw new Error(
      `Failed to decrypt credentials: ${error.message}. ` +
        'Ensure the external-league credentials key matches the key used for encryption.'
    )
  }
}

/**
 * Check if credentials string is encrypted (vs legacy plain JSON)
 * @param {string} credentials_string - Stored credentials string
 * @returns {boolean} True if encrypted (base64 format), false if legacy JSON or empty
 */
export function is_encrypted(credentials_string) {
  if (!credentials_string || typeof credentials_string !== 'string') {
    return false
  }

  // Legacy unencrypted JSON starts with {
  if (credentials_string.trim().startsWith('{')) {
    return false
  }

  // Encrypted format is base64 (alphanumeric + / + = padding)
  // Must be at least long enough for IV + AuthTag (32 bytes = ~43 base64 chars)
  return (
    /^[A-Za-z0-9+/]+=*$/.test(credentials_string) &&
    credentials_string.length >= 43
  )
}

/**
 * Migrate legacy credentials to encrypted format
 * @param {string} credentials_string - Potentially unencrypted credentials
 * @param {Object} [options]
 * @param {string} [options.key_hex] - optional 64-hex key override (tests / rekey)
 * @returns {string|null} Encrypted credentials string or null if empty
 */
export function migrate_credentials(credentials_string, { key_hex } = {}) {
  if (!credentials_string) {
    return null
  }

  // Already encrypted
  if (is_encrypted(credentials_string)) {
    return credentials_string
  }

  // Parse legacy JSON and re-encrypt
  try {
    const credentials = JSON.parse(credentials_string)
    return encrypt_credentials(credentials, { key_hex })
  } catch (error) {
    log('Failed to migrate credentials:', error.message)
    return null
  }
}

export default {
  encrypt_credentials,
  decrypt_credentials,
  is_encrypted,
  migrate_credentials
}
