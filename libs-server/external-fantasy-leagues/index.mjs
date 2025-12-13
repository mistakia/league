import SyncOrchestrator from './sync/sync-orchestrator.mjs'

// Re-export all components
export { default as SyncOrchestrator } from './sync/sync-orchestrator.mjs'
export {
  PlayerIdMapper,
  LeagueConfigMapper,
  TransactionMapper
} from './mappers/index.mjs'

// Re-export adapters for direct use if needed
export { default as SleeperAdapter } from './adapters/sleeper.mjs'
export { default as EspnAdapter } from './adapters/espn.mjs'
export { default as YahooAdapter } from './adapters/yahoo.mjs'
export { default as MflAdapter } from './adapters/mfl.mjs'
export { default as CbsAdapter } from './adapters/cbs.mjs'
export { default as FfpcAdapter } from './adapters/ffpc.mjs'
export { default as NffcAdapter } from './adapters/nffc.mjs'
export { default as FantraxAdapter } from './adapters/fantrax.mjs'
export { default as FleaflickerAdapter } from './adapters/fleaflicker.mjs'
export { default as NflAdapter } from './adapters/nfl.mjs'
export { default as RtsportsAdapter } from './adapters/rtsports.mjs'

/**
 * Convenience function for syncing external league
 * @param {Object} params - Sync parameters
 * @returns {Promise<Object>} Sync results
 */
export async function sync_external_league(params) {
  const orchestrator = new SyncOrchestrator()
  return await orchestrator.sync_league(params)
}

/**
 * Convenience function for fetching external league data (read-only)
 * @param {Object} params - Fetch parameters
 * @param {string} params.platform - Platform identifier
 * @param {string} params.external_league_id - External league ID
 * @param {Object} [params.credentials] - Platform authentication credentials
 * @param {Object} [params.config] - Platform-specific configuration
 * @returns {Promise<Object>} Standardized league data
 */
export async function fetch_external_league_data(params) {
  const orchestrator = new SyncOrchestrator()
  return await orchestrator.fetch_league_data({
    platform_name: params.platform,
    external_league_id: params.external_league_id,
    credentials: params.credentials || {},
    fetch_options: params.config || {}
  })
}

/**
 * Get list of supported platforms
 * @returns {Array<string>} Array of supported platform identifiers
 */
export function get_supported_platforms() {
  const orchestrator = new SyncOrchestrator()
  return orchestrator.get_supported_platforms()
}

/**
 * Check if a platform is supported
 * @param {Object} params - Parameters object
 * @param {string} params.platform - Platform identifier to check
 * @returns {boolean} True if platform is supported
 */
export function is_platform_supported(params) {
  const orchestrator = new SyncOrchestrator()
  return orchestrator.is_platform_supported(params)
}

/**
 * Create and configure a platform adapter directly
 * @param {Object} params - Parameters object
 * @param {string} params.platform - Platform identifier
 * @param {Object} [params.config] - Platform-specific configuration
 * @returns {Object} Configured adapter instance
 */
export function create_adapter(params) {
  const orchestrator = new SyncOrchestrator()
  return orchestrator.initialize_adapter(params)
}

// Default export is the main orchestrator class
export default SyncOrchestrator
