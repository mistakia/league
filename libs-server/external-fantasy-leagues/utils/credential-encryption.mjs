import crypto from 'crypto'
import debug from 'debug'

const log = debug('external:credential-encryption')

/**
 * AES-256-GCM encryption for external league credentials
 *
 * Security considerations:
 * - Uses AES-256-GCM (authenticated encryption)
 * - Random IV per encryption (stored with ciphertext)
 * - Auth tag ensures integrity
 * - Key derived from environment variable
 *
 * Environment variable required:
 * - EXTERNAL_LEAGUE_ENCRYPTION_KEY: 32-byte hex string (64 hex chars) or base64
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get encryption key from environment
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} If key is missing or invalid
 */
function get_encryption_key() {
  const key_env = process.env.EXTERNAL_LEAGUE_ENCRYPTION_KEY

  if (!key_env) {
    // In development/test, use a deterministic key derived from a fallback
    // This allows the system to work without explicit configuration
    // but should NEVER be used in production
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      log(
        'WARNING: Using development fallback key - set EXTERNAL_LEAGUE_ENCRYPTION_KEY for production'
      )
      return crypto.scryptSync('development-fallback-key', 'salt', 32)
    }
    throw new Error(
      'EXTERNAL_LEAGUE_ENCRYPTION_KEY environment variable is required. ' +
        'Set a 32-byte key as hex (64 chars) or base64 (44 chars) string.'
    )
  }

  // Support hex-encoded keys (64 chars = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(key_env)) {
    return Buffer.from(key_env, 'hex')
  }

  // Support base64-encoded keys (44 chars = 32 bytes when decoded)
  if (/^[A-Za-z0-9+/]+=*$/.test(key_env) && key_env.length >= 43) {
    try {
      const key = Buffer.from(key_env, 'base64')
      if (key.length === 32) {
        return key
      }
      throw new Error(
        `Base64 key decodes to ${key.length} bytes, expected 32 bytes`
      )
    } catch (error) {
      throw new Error(
        `Invalid base64 key format: ${error.message}. Expected 44-character base64 string.`
      )
    }
  }

  // If raw string, derive key using scrypt (less secure, but allows passphrase-style keys)
  log(
    'Deriving encryption key from raw string using scrypt. Consider using hex or base64 format for better security.'
  )
  return crypto.scryptSync(key_env, 'external-league-credentials', 32)
}

/**
 * Encrypt credentials object
 * @param {Object} credentials - Plain credentials object
 * @returns {string} Encrypted credentials (base64-encoded: iv + authTag + ciphertext)
 */
export function encrypt_credentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return null
  }

  // Empty credentials don't need encryption
  if (Object.keys(credentials).length === 0) {
    return null
  }

  try {
    const key = get_encryption_key()
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
 * @returns {Object} Decrypted credentials object (empty object if input is null/empty)
 * @throws {Error} If decryption fails or encrypted data is malformed
 */
export function decrypt_credentials(encrypted_string) {
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
    const key = get_encryption_key()
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
        'Ensure EXTERNAL_LEAGUE_ENCRYPTION_KEY matches the key used for encryption.'
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
 * @returns {string|null} Encrypted credentials string or null if empty
 */
export function migrate_credentials(credentials_string) {
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
    return encrypt_credentials(credentials)
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
