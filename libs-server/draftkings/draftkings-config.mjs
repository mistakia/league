import db from '#db'

/**
 * Get DraftKings configuration from the database
 * @returns {Promise<object>} DraftKings configuration object
 */
export const get_draftkings_config = async () => {
  const config_row = await db('config')
    .where('key', 'draftkings_config')
    .first()
  return config_row.config_value
}
