import fetch from 'node-fetch'
import queryString from 'query-string'
import debug from 'debug'

const log = debug('fantasylife')

const FANTASYLIFE_API_URL = 'https://www.fantasylife.com/api'

export const get_projections = async ({ table_id, query_params = {} } = {}) => {
  if (!table_id) {
    throw new Error('table_id is required')
  }

  const params = {
    page: 1,
    perPage: 500,
    ...query_params
  }

  try {
    const url = `${
      FANTASYLIFE_API_URL
    }/datatables/table-contents/${table_id}/ajax?${queryString.stringify(
      params
    )}`
    log(url)
    const res = await fetch(url)
    const data = await res.json()

    if (!data.total) {
      return null
    }

    const result = []

    const player_field_id = data.fields.find(
      (f) => f.label === 'Player' && f.type === 'player'
    )?.key
    const rush_att_field_id = data.fields.find((f) => f.label === 'Ru Att')?.key
    const rush_yds_field_id = data.fields.find((f) => f.label === 'Ru Yds')?.key
    const rush_tds_field_id = data.fields.find((f) => f.label === 'Ru TDs')?.key
    const targets_field_id = data.fields.find((f) => f.label === 'Tgt')?.key
    const rec_field_id = data.fields.find((f) => f.label === 'Rec')?.key
    const rec_yds_field_id = data.fields.find((f) => f.label === 'Rec Yds')?.key
    const rec_tds_field_id = data.fields.find((f) => f.label === 'Rec TDs')?.key
    const pass_att_field_id = data.fields.find((f) => f.label === 'P Att')?.key
    const pass_comp_field_id = data.fields.find(
      (f) => f.label === 'P Comp'
    )?.key
    const pass_yds_field_id = data.fields.find((f) => f.label === 'P Yds')?.key
    const pass_tds_field_id = data.fields.find((f) => f.label === 'P TDs')?.key
    const pass_ints_field_id = data.fields.find((f) => f.label === 'INT')?.key

    for (const item of data.items) {
      result.push({
        fantasylife_player_id: item[player_field_id]?.data.fa_id,
        position: item[player_field_id]?.data.position.name,
        name: item[player_field_id]?.data.name,
        nfl_team: item[player_field_id]?.data.team.abbr,
        rush_att: Number(item[rush_att_field_id]) || null,
        rush_yds: Number(item[rush_yds_field_id]) || null,
        rush_tds: Number(item[rush_tds_field_id]) || null,
        targets: Number(item[targets_field_id]) || null,
        rec: Number(item[rec_field_id]) || null,
        rec_yds: Number(item[rec_yds_field_id]) || null,
        rec_tds: Number(item[rec_tds_field_id]) || null,
        pass_att: Number(item[pass_att_field_id]) || null,
        pass_comp: Number(item[pass_comp_field_id]) || null,
        pass_yds: Number(item[pass_yds_field_id]) || null,
        pass_tds: Number(item[pass_tds_field_id]) || null,
        pass_ints: Number(item[pass_ints_field_id]) || null
      })
    }

    return result
  } catch (err) {
    log(err)
    return null
  }
}
