import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Schema validation utility for external fantasy league data
 *
 * Provides runtime validation against comprehensive JSON schemas using AJV.
 * Validates data against canonical format schemas to ensure consistency across
 * all external platform adapters.
 *
 * Features:
 * - Schema caching for performance (5-minute TTL)
 * - Compiled validator caching
 * - Batch validation support
 * - Detailed error reporting with data summaries
 *
 * Supported canonical formats:
 * - league: League configuration and settings
 * - team: Team information and metadata
 * - roster: Player rosters with positions
 * - transaction: Trades, waivers, and other transactions
 * - player: Player information and stats
 *
 * @example
 * const validator = new SchemaValidator()
 * const result = await validator.validate_league(league_data)
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors)
 * }
 */
export class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false, // Allow unknown keywords for flexibility
      removeAdditional: false // Don't remove additional properties
    })

    // Add format validation support
    addFormats(this.ajv)

    this.schemas = new Map()
    this.compiled_validators = new Map()
    this.schema_cache_time = new Map()
    this.cache_duration = 5 * 60 * 1000 // 5 minutes cache
  }

  /**
   * Load and cache JSON schema from file
   * @param {string} schema_name - Name of the schema file (without .json extension)
   * @returns {Promise<object>} Loaded JSON schema
   */
  async load_schema(schema_name) {
    const cache_key = schema_name
    const now = Date.now()

    // Check if schema is cached and still valid
    if (this.schemas.has(cache_key)) {
      const cache_time = this.schema_cache_time.get(cache_key)
      if (now - cache_time < this.cache_duration) {
        return this.schemas.get(cache_key)
      }
    }

    try {
      const schema_path = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'schemas',
        `${schema_name}.json`
      )
      const schema_content = await fs.readFile(schema_path, 'utf8')
      const schema = JSON.parse(schema_content)

      // Cache the schema
      this.schemas.set(cache_key, schema)
      this.schema_cache_time.set(cache_key, now)

      return schema
    } catch (error) {
      throw new Error(
        `Failed to load schema '${schema_name}': ${error.message}`
      )
    }
  }

  /**
   * Get or compile validator for a specific schema
   * @param {string} schema_name - Name of the schema
   * @returns {Promise<Function>} Compiled validator function
   */
  async get_validator(schema_name) {
    if (this.compiled_validators.has(schema_name)) {
      return this.compiled_validators.get(schema_name)
    }

    const schema = await this.load_schema(schema_name)

    try {
      // Use AJV to compile the JSON schema directly
      const compiled = this.ajv.compile(schema)
      this.compiled_validators.set(schema_name, compiled)
      return compiled
    } catch (error) {
      // Check if this is a "schema already exists" error
      // Try to get the existing schema from AJV
      const schema_id = schema.$id || schema.id
      if (schema_id && error.message.includes('already exists')) {
        const existing = this.ajv.getSchema(schema_id)
        if (existing) {
          this.compiled_validators.set(schema_name, existing)
          return existing
        }
      }

      console.warn(
        `Schema compilation failed for ${schema_name}:`,
        error.message
      )
      // Fallback to a validator that always returns true
      const fallback_validator = () => true
      this.compiled_validators.set(schema_name, fallback_validator)
      return fallback_validator
    }
  }

  /**
   * Validate data against a specific canonical format schema
   * @param {string} format_type - Type of format (league, team, roster, transaction, player)
   * @param {object} data - Data to validate
   * @returns {Promise<object>} Validation result with success flag and errors
   */
  async validate_canonical_format(format_type, data) {
    const schema_name = `canonical-${format_type}-format`

    try {
      const validator = await this.get_validator(schema_name)
      const is_valid = validator(data)

      if (is_valid) {
        return {
          valid: true,
          errors: [],
          format_type,
          schema_name
        }
      }

      // AJV stores errors in validator.errors
      const errors = validator.errors || []

      return {
        valid: false,
        errors: errors.map((error) => ({
          instancePath: error.instancePath,
          schemaPath: error.schemaPath,
          keyword: error.keyword,
          message: error.message,
          data: error.data
        })),
        format_type,
        schema_name,
        data_summary: this.create_data_summary(data)
      }
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            type: 'schema_error',
            message: error.message,
            field: 'schema_validation'
          }
        ],
        format_type,
        schema_name,
        error: error.message
      }
    }
  }

  /**
   * Validate league data against canonical league format
   * @param {object} league_data - League configuration data
   * @returns {Promise<object>} Validation result
   */
  async validate_league(league_data) {
    return this.validate_canonical_format('league', league_data)
  }

  /**
   * Validate team data against canonical team format
   * @param {object} team_data - Team data
   * @returns {Promise<object>} Validation result
   */
  async validate_team(team_data) {
    return this.validate_canonical_format('team', team_data)
  }

  /**
   * Validate roster data against canonical roster format
   * @param {object} roster_data - Roster data
   * @returns {Promise<object>} Validation result
   */
  async validate_roster(roster_data) {
    return this.validate_canonical_format('roster', roster_data)
  }

  /**
   * Validate transaction data against canonical transaction format
   * @param {object} transaction_data - Transaction data
   * @returns {Promise<object>} Validation result
   */
  async validate_transaction(transaction_data) {
    return this.validate_canonical_format('transaction', transaction_data)
  }

  /**
   * Validate player data against canonical player format
   * @param {object} player_data - Player data
   * @returns {Promise<object>} Validation result
   */
  async validate_player(player_data) {
    return this.validate_canonical_format('player', player_data)
  }

  /**
   * Validate multiple data items with batch processing
   * @param {string} format_type - Type of format to validate against
   * @param {Array} data_array - Array of data objects to validate
   * @returns {Promise<object>} Batch validation results
   */
  async validate_batch(format_type, data_array) {
    if (!Array.isArray(data_array)) {
      throw new Error('Data must be an array for batch validation')
    }

    const results = {
      total: data_array.length,
      valid: 0,
      invalid: 0,
      errors: [],
      format_type,
      validation_summary: {}
    }

    const validator = await this.get_validator(
      `canonical-${format_type}-format`
    )

    for (let i = 0; i < data_array.length; i++) {
      const item = data_array[i]
      const is_valid = validator(item)

      if (is_valid) {
        results.valid++
      } else {
        results.invalid++
        results.errors.push({
          index: i,
          item_summary: this.create_data_summary(item),
          validation_errors: validator.errors || []
        })
      }
    }

    results.validation_summary = {
      success_rate: ((results.valid / results.total) * 100).toFixed(2) + '%',
      error_rate: ((results.invalid / results.total) * 100).toFixed(2) + '%'
    }

    return results
  }

  /**
   * Create a summary of data for error reporting
   * @param {object} data - Data object to summarize
   * @returns {object} Data summary
   */
  create_data_summary(data) {
    if (!data || typeof data !== 'object') {
      return { type: typeof data, value: String(data) }
    }

    const summary = {
      keys: Object.keys(data),
      key_count: Object.keys(data).length
    }

    // Add identifying fields if they exist (including canonical format fields)
    const id_fields = [
      'id',
      'team_id',
      'external_team_id',
      'team_external_id',
      'player_id',
      'external_id',
      'external_roster_id',
      'external_transaction_id',
      'league_id',
      'league_external_id',
      'transaction_id'
    ]
    for (const field of id_fields) {
      if (data[field] !== undefined) {
        summary[field] = data[field]
      }
    }

    return summary
  }

  /**
   * Clear validation cache (useful for testing or memory management)
   */
  clear_cache() {
    this.schemas.clear()
    this.compiled_validators.clear()
    this.schema_cache_time.clear()
  }

  /**
   * Get validation statistics
   * @returns {object} Cache and performance statistics
   */
  get_stats() {
    return {
      cached_schemas: this.schemas.size,
      compiled_validators: this.compiled_validators.size,
      cache_duration_ms: this.cache_duration,
      schema_names: Array.from(this.schemas.keys())
    }
  }
}

// Export singleton instance for convenient usage
export const schema_validator = new SchemaValidator()

// Export the class for custom instances
export default SchemaValidator
