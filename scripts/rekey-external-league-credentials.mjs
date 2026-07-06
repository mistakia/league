import crypto from 'crypto'
import assert from 'assert'
import debug from 'debug'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import db from '#db'
import { is_main } from '#libs-server'
import { load_sops_json } from '#config'
import {
  encrypt_credentials,
  decrypt_credentials,
  is_encrypted
} from '#libs-server/external-fantasy-leagues/utils/credential-encryption.mjs'

const log = debug('rekey-external-league-credentials')

// One-shot, transactional, idempotent maintenance backfill: re-encrypt every
// external_league_connections.credentials_encrypted row from the OLD key(s) to
// the NEW dedicated {league}-only sops column key. Value-free throughout --
// logs counts and connection_ids only, NEVER key material or credential values.
//
// The OLD key is unknown at rest (rows may have been written under the ambient
// EXTERNAL_LEAGUE_ENCRYPTION_KEY value and/or the retired NODE_ENV-gated
// development-fallback-key), so we build every candidate old key and try each.
// The `development-fallback-key` derivation survives ONLY here, as a read-side
// candidate for legacy rows -- it is deleted from the production resolver.

const NEW_KEY_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'config',
  'external-league-credentials-key.sops.json'
)

// Reproduce the RETIRED env-var key derivation (hex / base64 / scrypt-passphrase)
// so a row written under the old ambient key can still be read here. Returns a
// 64-hex string the credential-encryption DI seam accepts.
const derive_old_env_key_hex = (env_value) => {
  if (/^[0-9a-fA-F]{64}$/.test(env_value)) {
    return Buffer.from(env_value, 'hex').toString('hex')
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(env_value) && env_value.length >= 43) {
    const key = Buffer.from(env_value, 'base64')
    if (key.length === 32) {
      return key.toString('hex')
    }
  }
  return crypto
    .scryptSync(env_value, 'external-league-credentials', 32)
    .toString('hex')
}

const build_candidate_old_keys = () => {
  const candidates = []
  const env_value = process.env.EXTERNAL_LEAGUE_ENCRYPTION_KEY
  if (env_value) {
    candidates.push({
      label: 'env',
      key_hex: derive_old_env_key_hex(env_value)
    })
  }
  // The retired NODE_ENV=development|test fallback. Kept ONLY as a read-side
  // candidate for rows that may have been written under it.
  candidates.push({
    label: 'dev-fallback',
    key_hex: crypto
      .scryptSync('development-fallback-key', 'salt', 32)
      .toString('hex')
  })
  return candidates
}

const resolve_new_key_hex = () => {
  const loaded = load_sops_json(NEW_KEY_FILE)
  const key_hex = loaded?.external_league_credentials_key
  if (!key_hex || !/^[0-9a-fA-F]{64}$/.test(key_hex)) {
    throw new Error(
      'external_league_credentials_key missing or not 64-hex in ' +
        'config/external-league-credentials-key.sops.json'
    )
  }
  return key_hex
}

const rekey = async ({ dry_run = false } = {}) => {
  const new_key_hex = resolve_new_key_hex()
  const candidates = build_candidate_old_keys()

  const rows = await db('external_league_connections')
    .whereNotNull('credentials_encrypted')
    .select('connection_id', 'credentials_encrypted')

  log(`found ${rows.length} rows with non-null credentials_encrypted`)

  const stats = {
    total: rows.length,
    migrated: [],
    skipped_migrated: [],
    skipped_empty: []
  }

  const trx = await db.transaction()
  try {
    for (const row of rows) {
      const cipher = row.credentials_encrypted
      const cid = row.connection_id

      // Idempotency: a GCM row that already decrypts under the NEW key is done.
      if (is_encrypted(cipher)) {
        try {
          decrypt_credentials(cipher, { key_hex: new_key_hex })
          stats.skipped_migrated.push(cid)
          continue
        } catch {
          // not under the new key -> fall through to rekey from an old candidate
        }
      }

      // Resolve the plaintext under a candidate old key. decrypt_credentials also
      // returns parsed JSON for legacy `{`-prefixed plaintext rows (key ignored),
      // so those get encrypted under the new key here.
      let old_plain
      for (const cand of candidates) {
        try {
          old_plain = decrypt_credentials(cipher, { key_hex: cand.key_hex })
          break
        } catch {
          // try the next candidate
        }
      }
      if (old_plain === undefined) {
        throw new Error(
          `connection ${cid}: undecryptable under all ${candidates.length} candidate old key(s)`
        )
      }

      // Empty credentials do not need encryption (encrypt returns null); leave as-is.
      if (!old_plain || Object.keys(old_plain).length === 0) {
        stats.skipped_empty.push(cid)
        continue
      }

      const new_cipher = encrypt_credentials(old_plain, {
        key_hex: new_key_hex
      })

      // Per-row parity: the new ciphertext must decrypt (under the new key) to the
      // exact plaintext we read from the old key. Aborts the whole transaction on
      // any mismatch. Value-free (compares objects, prints neither).
      const roundtrip = decrypt_credentials(new_cipher, {
        key_hex: new_key_hex
      })
      assert.deepStrictEqual(
        roundtrip,
        old_plain,
        `connection ${cid}: parity mismatch after rekey`
      )

      await trx('external_league_connections')
        .where({ connection_id: cid })
        .update({ credentials_encrypted: new_cipher })

      stats.migrated.push(cid)
    }

    if (dry_run) {
      await trx.rollback()
      log('DRY RUN — transaction rolled back, no rows written')
    } else {
      await trx.commit()
      log('committed')
    }
  } catch (err) {
    await trx.rollback()
    throw err
  }

  return stats
}

const main = async () => {
  const dry_run = process.argv.includes('--dry-run')
  try {
    const stats = await rekey({ dry_run })
    log(
      `done: total=${stats.total} migrated=${stats.migrated.length} ` +
        `skipped_already_migrated=${stats.skipped_migrated.length} ` +
        `skipped_empty=${stats.skipped_empty.length}`
    )
    if (stats.migrated.length)
      log(`migrated connection_ids: ${stats.migrated.join(', ')}`)
    process.exit(0)
  } catch (err) {
    console.error(`rekey FAILED (transaction rolled back): ${err.message}`)
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}

export default rekey
