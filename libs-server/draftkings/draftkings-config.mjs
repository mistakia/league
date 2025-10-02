import db from '#db'

/**
 * Get DraftKings configuration from the database
 * @returns {Promise<Object>} DraftKings configuration object
 */
export const get_draftkings_config = async () => {
  const config_row = await db('config')
    .where('key', 'draftkings_config')
    .first()
  return config_row.value
}
