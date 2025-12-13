import debug from 'debug'

// import { constants } from '#libs-shared'

// Static imports for all adapters
import SleeperAdapter from '../adapters/sleeper.mjs'
import EspnAdapter from '../adapters/espn.mjs'
import YahooAdapter from '../adapters/yahoo.mjs'
import MflAdapter from '../adapters/mfl.mjs'
import CbsAdapter from '../adapters/cbs.mjs'
import FfpcAdapter from '../adapters/ffpc.mjs'
import NffcAdapter from '../adapters/nffc.mjs'
import FantraxAdapter from '../adapters/fantrax.mjs'
import FleaflickerAdapter from '../adapters/fleaflicker.mjs'
import NflAdapter from '../adapters/nfl.mjs'
import RtsportsAdapter from '../adapters/rtsports.mjs'

// Import extracted sync modules
import ConfigSync from './config-sync.mjs'
import TeamSync from './team-sync.mjs'
import RosterSync from './roster-sync.mjs'
import TransactionSync from './transaction-sync.mjs'
import ProgressReporter from './progress-reporter.mjs'
import SyncUtils from './sync-utils.mjs'

const log = debug('external:sync-orchestrator')

// Adapter factory registry
const ADAPTER_REGISTRY = {
  sleeper: SleeperAdapter,
  espn: EspnAdapter,
  yahoo: YahooAdapter,
  mfl: MflAdapter,
  cbs: CbsAdapter,
  ffpc: FfpcAdapter,
  nffc: NffcAdapter,
  fantrax: FantraxAdapter,
  fleaflicker: FleaflickerAdapter,
  nfl: NflAdapter,
  rtsports: RtsportsAdapter
}

/**
 * Sync orchestrator
 * Coordinates idempotent data import from external fantasy platforms
 *
 * Architecture:
 * - Modular sync modules (ConfigSync, TeamSync, RosterSync, TransactionSync)
 * - Shared utilities (SyncUtils, ProgressReporter)
 * - Adapter pattern for platform-specific implementations
 * - Idempotent operations (safe to run multiple times)
 *
 * Sync Flow:
 * 1. Initialize adapter and authenticate
 * 2. Sync league configuration (format, scoring)
 * 3. Sync teams (create mappings)
 * 4. Sync rosters (players, mappings)
 * 5. Sync transactions (optional)
 *
 * All operations support progress reporting and error collection.
 */
export default class SyncOrchestrator {
  constructor() {
    // Initialize sync modules
    this.config_sync = new ConfigSync()
    this.team_sync = new TeamSync()
    this.roster_sync = new RosterSync()
    this.transaction_sync = new TransactionSync()
    this.progress_reporter = new ProgressReporter()
    this.sync_utils = new SyncUtils()

    // Available adapters (instantiated on demand)
    this.adapters = new Map()
  }

  /**
   * Create a new sync_stats object for each sync operation
   * This ensures concurrent syncs don't interfere with each other
   * @returns {Object} Fresh sync statistics object
   * @private
   */
  _create_sync_stats() {
    return this.sync_utils.init_sync_stats()
  }

  /**
   * Get list of supported platforms
   * @returns {Array<string>} Array of supported platform identifiers
   */
  get_supported_platforms() {
    return Object.keys(ADAPTER_REGISTRY)
  }

  /**
   * Check if a platform is supported
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier to check
   * @returns {boolean} True if platform is supported
   */
  is_platform_supported({ platform }) {
    return platform && Object.hasOwn(ADAPTER_REGISTRY, platform.toLowerCase())
  }

  /**
   * Fetch external league data in canonical format (read-only, no DB writes)
   * @param {Object} options - Fetch options
   * @param {string} options.platform_name - Platform identifier
   * @param {string} options.external_league_id - External league ID
   * @param {Object} [options.credentials] - Platform authentication credentials
   * @param {Object} [options.fetch_options] - Additional fetch options
   * @returns {Promise<Object>} Canonical league data components
   */
  async fetch_league_data({
    platform_name,
    external_league_id,
    credentials = {},
    fetch_options = {}
  }) {
    const start_time = Date.now()
    const sync_stats = this._create_sync_stats()

    try {
      // setup progress reporting if provided
      const progress_callback = this.progress_reporter.create_progress_callback(
        {
          callback: fetch_options.progress_callback
        }
      )

      await this.progress_reporter.report_adapter_init_progress({
        progress_callback,
        platform_name
      })

      const adapter = this.initialize_adapter({
        platform_name,
        adapter_config: fetch_options.adapter_config
      })

      if (credentials && Object.keys(credentials).length > 0) {
        await this.progress_reporter.report_adapter_init_progress({
          progress_callback,
          platform_name,
          status: 'authenticating'
        })
        await adapter.authenticate(credentials)
      }

      // Fetch in parallel
      await this.progress_reporter.report_fetch_progress({
        progress_callback,
        data_type: 'config',
        progress_percentage: 15
      })
      await this.progress_reporter.report_fetch_progress({
        progress_callback,
        data_type: 'rosters',
        progress_percentage: 40
      })
      if (fetch_options.include_transactions !== false) {
        await this.progress_reporter.report_fetch_progress({
          progress_callback,
          data_type: 'transactions',
          progress_percentage: 70
        })
      }
      if (fetch_options.include_players !== false) {
        await this.progress_reporter.report_fetch_progress({
          progress_callback,
          data_type: 'players',
          progress_percentage: 85
        })
      }
      const [league_config, rosters, transactions, players] = await Promise.all(
        [
          adapter.get_league(external_league_id, { year: fetch_options.year }),
          adapter.get_rosters({
            league_id: external_league_id,
            week: fetch_options.week,
            year: fetch_options.year
          }),
          fetch_options.include_transactions === false
            ? Promise.resolve([])
            : adapter.get_transactions({
                league_id: external_league_id,
                options: { week: fetch_options.week },
                year: fetch_options.year
              }),
          fetch_options.include_players === false
            ? Promise.resolve([])
            : adapter.get_players({
                filters: fetch_options.player_filters || {}
              })
        ]
      )

      await this.progress_reporter.report_completion_progress({
        progress_callback,
        status: 'fetch_complete',
        validation_results: {
          league_config_valid: !!league_config
        }
      })

      return this.sync_utils.create_standardized_output({
        platform_name,
        success: true,
        raw_data: {
          league_config,
          teams: league_config?.teams || [],
          rosters,
          transactions,
          players
        },
        validation_results: {
          league_config_valid: !!league_config,
          players_mapped: Array.isArray(players) ? players.length : 0,
          transactions_valid: Array.isArray(transactions)
            ? transactions.length
            : 0
        },
        metadata: {
          start_time,
          sync_type: 'fetch_only'
        }
      })
    } catch (error) {
      // try to report error to any provided progress callback
      const cb = this.progress_reporter.create_progress_callback({
        callback: fetch_options?.progress_callback
      })
      await this.progress_reporter.report_completion_progress({
        progress_callback: cb,
        status: 'error',
        error_message: error.message
      })

      sync_stats.errors.push(
        this.sync_utils.create_sync_error({
          error_type: 'fetch_failure',
          error_message: error.message,
          step: 'fetch_league_data'
        })
      )

      return this.sync_utils.create_standardized_output({
        platform_name,
        success: false,
        errors: sync_stats.errors,
        metadata: {
          start_time,
          sync_type: 'fetch_only'
        }
      })
    }
  }

  /**
   * Initialize adapter for a platform
   * @param {Object} options - Adapter initialization options
   * @param {string} options.platform_name - Platform identifier
   * @param {Object} [options.adapter_config] - Platform-specific configuration
   * @returns {Object} Adapter instance
   */
  initialize_adapter({ platform_name, adapter_config = {} }) {
    try {
      if (this.adapters.has(platform_name)) {
        return this.adapters.get(platform_name)
      }

      // Get adapter class from registry
      const AdapterClass = ADAPTER_REGISTRY[platform_name.toLowerCase()]
      if (!AdapterClass) {
        throw new Error(`Unsupported platform: ${platform_name}`)
      }

      const adapter = new AdapterClass(adapter_config)
      this.adapters.set(platform_name, adapter)

      log(`Initialized ${platform_name} adapter`)
      return adapter
    } catch (error) {
      log(`Failed to initialize ${platform_name} adapter: ${error.message}`)
      throw error
    }
  }

  /**
   * Perform full sync of external league
   * @param {Object} options - Full sync options
   * @param {string} options.platform_name - Platform identifier
   * @param {string} options.external_league_id - External league ID
   * @param {string} options.internal_league_id - Internal league ID
   * @param {Object} [options.credentials] - Platform authentication credentials
   * @param {Object} [options.sync_options] - Additional sync options including progress_callback
   * @returns {Promise<Object>} Standardized sync results
   */
  async sync_league({
    platform_name,
    external_league_id,
    internal_league_id,
    credentials = {},
    sync_options = {}
  }) {
    const start_time = Date.now()
    log(`Starting full sync for ${platform_name} league ${external_league_id}`)

    // Create progress callback wrapper (handles null case internally)
    const progress_callback = sync_options.progress_callback
      ? this.progress_reporter.create_progress_callback({
          callback: sync_options.progress_callback
        })
      : null

    // Create per-sync stats to avoid concurrent sync interference
    const sync_stats = this._create_sync_stats()
    const sync_context = this.sync_utils.create_sync_context({
      platform_name,
      external_league_id,
      internal_league_id,
      year: sync_options.year,
      week: sync_options.week
    })

    try {
      // Step 1: Initialize and authenticate
      if (progress_callback) {
        await this.progress_reporter.report_adapter_init_progress({
          progress_callback,
          platform_name
        })
      }

      const adapter = this.initialize_adapter({
        platform_name,
        adapter_config: sync_options.adapter_config
      })

      // Authenticate if credentials provided
      if (credentials && Object.keys(credentials).length > 0) {
        if (progress_callback) {
          await this.progress_reporter.report_adapter_init_progress({
            progress_callback,
            platform_name,
            status: 'authenticating'
          })
        }
        await adapter.authenticate(credentials)
      }

      // Step 2: Sync league configuration
      if (progress_callback) {
        await progress_callback('Syncing league configuration', 15, {
          step: 'league_config',
          external_league_id
        })
      }
      await this.config_sync.sync_league_config({
        adapter,
        sync_context,
        progress_callback,
        sync_stats_errors: sync_stats.errors
      })

      // Step 3: Sync teams
      if (progress_callback) {
        await progress_callback('Syncing teams', 25, {
          step: 'teams',
          external_league_id
        })
      }
      await this.team_sync.sync_teams({
        adapter,
        sync_context,
        progress_callback,
        sync_stats_errors: sync_stats.errors
      })

      // Step 4: Sync players and rosters
      if (progress_callback) {
        await progress_callback('Syncing rosters and players', 40, {
          step: 'rosters',
          external_league_id
        })
      }
      await this.roster_sync.sync_rosters({
        adapter,
        sync_context,
        sync_stats,
        progress_callback,
        sync_stats_errors: sync_stats.errors
      })

      // Step 5: Sync transactions (if requested)
      if (sync_options.sync_transactions !== false) {
        if (progress_callback) {
          await progress_callback('Syncing transactions', 70, {
            step: 'transactions',
            external_league_id
          })
        }
        await this.transaction_sync.sync_transactions({
          adapter,
          sync_context,
          sync_options,
          sync_stats,
          progress_callback,
          sync_stats_errors: sync_stats.errors
        })
      }

      // Step 6: Complete
      if (progress_callback) {
        await this.progress_reporter.report_completion_progress({
          progress_callback,
          status: 'success',
          sync_stats
        })
      }

      log(`Completed sync for ${platform_name} league ${external_league_id}`)

      return this.sync_utils.create_standardized_output({
        platform_name,
        success: true,
        validation_results: {
          league_config_valid: true,
          players_mapped: sync_stats.players_mapped,
          transactions_valid: sync_stats.transactions_imported
        },
        errors: sync_stats.errors,
        metadata: {
          start_time,
          sync_type: progress_callback ? 'full_with_progress' : 'full'
        }
      })
    } catch (error) {
      log(`Error during sync: ${error.message}`)

      if (progress_callback) {
        await this.progress_reporter.report_completion_progress({
          progress_callback,
          status: 'error',
          error_message: error.message
        })
      }

      sync_stats.errors.push(
        this.sync_utils.create_sync_error({
          error_type: 'sync_failure',
          error_message: error.message,
          step: 'orchestration'
        })
      )

      return this.sync_utils.create_standardized_output({
        platform_name,
        success: false,
        errors: sync_stats.errors,
        metadata: {
          start_time,
          sync_type: progress_callback ? 'full_with_progress' : 'full'
        }
      })
    }
  }

  /**
   * Main sync method dispatcher
   * @param {Object} options - Sync options
   * @param {string} options.platform_name - Platform identifier
   * @param {string} options.external_league_id - External league ID
   * @param {string} options.internal_league_id - Internal league ID
   * @param {Object} [options.credentials] - Platform authentication credentials
   * @param {boolean} [options.dry_run] - Whether to perform a dry run
   * @param {Object} [options.sync_options] - Sync options including progress_callback
   * @returns {Promise<Object>} Standardized sync results
   */
  async sync({
    platform_name,
    external_league_id,
    internal_league_id,
    credentials = {},
    dry_run = false,
    sync_options = {}
  }) {
    // Validate parameters
    const validation = this.sync_utils.validate_sync_params({
      platform_name,
      external_league_id,
      internal_league_id,
      credentials
    })

    if (!validation.valid) {
      return this.sync_utils.create_standardized_output({
        platform_name,
        success: false,
        errors: validation.errors.map((msg) => ({
          type: 'validation',
          message: msg
        }))
      })
    }

    // For dry run mode, just validate connection and return
    if (dry_run) {
      return this._perform_validation_sync({
        platform_name,
        external_league_id,
        internal_league_id,
        credentials,
        sync_options
      })
    }

    // Perform full sync (handles progress_callback internally if provided)
    return this.sync_league({
      platform_name,
      external_league_id,
      internal_league_id,
      credentials,
      sync_options
    })
  }

  /**
   * Perform validation-only sync (dry run)
   * @param {Object} options - Validation sync options
   * @param {string} options.platform_name - Platform identifier
   * @param {string} options.external_league_id - External league ID
   * @param {string} options.internal_league_id - Internal league ID
   * @param {Object} options.credentials - Platform credentials
   * @param {Object} options.sync_options - Additional sync options
   * @returns {Promise<Object>} Validation results
   * @private
   */
  async _perform_validation_sync({
    platform_name,
    external_league_id,
    internal_league_id,
    credentials,
    sync_options
  }) {
    const start_time = Date.now()
    const progress_callback = this.progress_reporter.create_progress_callback({
      callback: sync_options.progress_callback
    })

    try {
      await this.progress_reporter.report_validation_progress({
        progress_callback,
        status: 'validating'
      })

      // Initialize adapter for testing
      const adapter = this.initialize_adapter({
        platform_name,
        adapter_config: sync_options.adapter_config
      })

      if (credentials && Object.keys(credentials).length > 0) {
        await adapter.authenticate(credentials)
      }

      // Test basic connectivity
      await this.progress_reporter.report_fetch_progress({
        progress_callback,
        data_type: 'config',
        progress_percentage: 50
      })

      const league_config = await adapter.get_league(external_league_id)

      await this.progress_reporter.report_completion_progress({
        progress_callback,
        status: 'fetch_complete',
        validation_results: {
          league_config_valid: !!league_config
        }
      })

      return this.sync_utils.create_standardized_output({
        platform_name,
        success: true,
        raw_data: { league_config },
        validation_results: {
          league_config_valid: !!league_config
        },
        metadata: {
          start_time,
          sync_type: 'validation',
          dry_run: true
        }
      })
    } catch (error) {
      await this.progress_reporter.report_completion_progress({
        progress_callback,
        status: 'error',
        error_message: error.message
      })

      return this.sync_utils.create_standardized_output({
        platform_name,
        success: false,
        errors: [
          {
            type: 'validation_error',
            message: error.message
          }
        ],
        metadata: {
          start_time,
          sync_type: 'validation',
          dry_run: true
        }
      })
    }
  }
}
