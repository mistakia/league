import db from '#db'

export const get_rts_config = async () => {
  const config_row = await db('config').where({ key: 'rts_config' }).first()
  return config_row.value
}
