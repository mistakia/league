import db from '#db'
import {
  constants,
  createDefaultLeague,
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'

export default async function ({ lid, commishid, ...params } = {}) {
  const default_league_params = createDefaultLeague({ commishid })
  const league_params = Object.assign({}, default_league_params, params)

  const league = {
    commishid,
    name: league_params.name,
    hosted: league_params.hosted
  }

  if (lid) league.uid = lid

  const leagues = await db('leagues').insert(league)
  const leagueId = leagues[0]

  const scoring_format = generate_scoring_format_hash(league_params)
  const league_format = generate_league_format_hash({
    scoring_format_hash: scoring_format.scoring_format_hash,
    ...league_params
  })

  league_format.scoring_format_hash = scoring_format.scoring_format_hash

  await db('league_formats')
    .insert(league_format)
    .onConflict('league_format_hash')
    .ignore()
  await db('league_scoring_formats')
    .insert(scoring_format)
    .onConflict('scoring_format_hash')
    .ignore()

  await db('seasons').insert({
    lid: leagueId,
    year: constants.season.year,

    league_format_hash: league_format.league_format_hash,
    scoring_format_hash: scoring_format.scoring_format_hash,

    mqb: league_params.mqb,
    mrb: league_params.mrb,
    mwr: league_params.mwr,
    mte: league_params.mte,
    mdst: league_params.mdst,
    mk: league_params.mk,

    faab: league_params.faab,

    tag2: league_params.tag2,
    tag3: league_params.tag3,
    tag4: league_params.tag4,

    ext1: league_params.ext1,
    ext2: league_params.ext2,
    ext3: league_params.ext3,
    ext4: league_params.ext4,

    fqb: league_params.fqb,
    frb: league_params.frb,
    fwr: league_params.fwr,
    fte: league_params.fte,

    tran_start: league_params.tran_start,
    tran_end: league_params.tran_end,

    ext_date: league_params.ext_date,

    draft_start: league_params.draft_start,
    draft_type: league_params.draft_type,
    draft_hour_min: league_params.draft_hour_min,
    draft_hour_max: league_params.draft_hour_max,

    adate: league_params.adate,
    tddate: league_params.tddate
  })

  return leagueId
}
