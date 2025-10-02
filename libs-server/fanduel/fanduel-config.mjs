import db from '#db'

/**
 * Get FanDuel DFS configuration from the database
 * @returns {Promise<Object>} FanDuel DFS configuration object
 */
export const get_fanduel_dfs_config = async () => {
  const config_row = await db('config')
    .where('key', 'fanduel_dfs_config')
    .first()
  return config_row.value
}
