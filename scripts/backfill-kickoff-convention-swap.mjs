import db from '#db'
import { is_main } from '#libs-server'

const main = async () => {
  // Snapshot sample kickoff return TD plays before backfill
  const before_sample = await db('nfl_plays')
    .select(
      'esbid',
      'off',
      'def',
      'epa',
      'ep',
      'ep_succ',
      'wp',
      'wpa',
      'pos_score',
      'def_score',
      'pos_score_post',
      'def_score_post',
      'score_diff',
      'score_diff_post'
    )
    .where('play_type', 'KOFF')
    .where('td', true)
    .whereNotNull('epa')
    .limit(5)

  console.log('=== BEFORE backfill (kickoff return TDs) ===')
  for (const row of before_sample) {
    console.log(
      `  ${row.esbid} | off=${row.off} def=${row.def} | epa=${row.epa} ep=${row.ep} ep_succ=${row.ep_succ} | wp=${row.wp} wpa=${row.wpa} | pos_score=${row.pos_score}->${row.pos_score_post} def_score=${row.def_score}->${row.def_score_post} score_diff=${row.score_diff}->${row.score_diff_post}`
    )
  }

  // Run backfill in a transaction
  const result = await db.transaction(async (trx) => {
    const updated = await trx('nfl_plays')
      .where('play_type', 'KOFF')
      .update({
        // Score pairs: swap pos <-> def
        pos_score: db.ref('def_score'),
        def_score: db.ref('pos_score'),
        pos_score_post: db.ref('def_score_post'),
        def_score_post: db.ref('pos_score_post'),

        // Score differentials: negate
        score_diff: db.raw('-score_diff'),
        score_diff_post: db.raw('-score_diff_post'),

        // Timeout pairs: swap pos <-> def
        pos_to_rem: db.ref('def_to_rem'),
        def_to_rem: db.ref('pos_to_rem'),

        // EPA fields: negate
        epa: db.raw('-epa'),
        ep: db.raw('-ep'),
        qb_epa: db.raw('-qb_epa'),
        air_epa: db.raw('-air_epa'),
        yac_epa: db.raw('-yac_epa'),
        comp_air_epa: db.raw('-comp_air_epa'),
        comp_yac_epa: db.raw('-comp_yac_epa'),
        xyac_epa: db.raw('-xyac_epa'),

        // Re-derive ep_succ from negated epa
        ep_succ: db.raw(
          'CASE WHEN epa IS NOT NULL THEN (-epa > 0) ELSE NULL END'
        ),

        // WPA fields: negate
        wpa: db.raw('-wpa'),
        vegas_wpa: db.raw('-vegas_wpa'),
        air_wpa: db.raw('-air_wpa'),
        yac_wpa: db.raw('-yac_wpa'),
        comp_air_wpa: db.raw('-comp_air_wpa'),
        comp_yac_wpa: db.raw('-comp_yac_wpa'),

        // Win probability: flip to kicking team perspective
        wp: db.raw('1 - wp'),
        vegas_wp: db.raw('1 - vegas_wp'),

        // Probability pairs: swap own <-> opp
        fg_prob: db.ref('opp_fg_prob'),
        opp_fg_prob: db.ref('fg_prob'),
        td_prob: db.ref('opp_td_prob'),
        opp_td_prob: db.ref('td_prob'),
        safety_prob: db.ref('opp_safety_prob'),
        opp_safety_prob: db.ref('safety_prob')
      })

    return updated
  })

  console.log(`\nBackfill complete: ${result} kickoff plays updated`)

  // Verify after backfill
  const after_sample = await db('nfl_plays')
    .select(
      'esbid',
      'off',
      'def',
      'epa',
      'ep',
      'ep_succ',
      'wp',
      'wpa',
      'pos_score',
      'def_score',
      'pos_score_post',
      'def_score_post',
      'score_diff',
      'score_diff_post'
    )
    .where('play_type', 'KOFF')
    .where('td', true)
    .whereNotNull('epa')
    .limit(5)

  console.log('\n=== AFTER backfill (kickoff return TDs) ===')
  for (const row of after_sample) {
    console.log(
      `  ${row.esbid} | off=${row.off} def=${row.def} | epa=${row.epa} ep=${row.ep} ep_succ=${row.ep_succ} | wp=${row.wp} wpa=${row.wpa} | pos_score=${row.pos_score}->${row.pos_score_post} def_score=${row.def_score}->${row.def_score_post} score_diff=${row.score_diff}->${row.score_diff_post}`
    )
  }

  // Verify return TDs have negative EPA
  const td_check = await db('nfl_plays')
    .where('play_type', 'KOFF')
    .where('td', true)
    .whereNotNull('epa')
    .select(
      db.raw('count(*) as total'),
      db.raw('count(*) filter (where epa < 0) as negative_epa'),
      db.raw('count(*) filter (where epa > 0) as positive_epa'),
      db.raw('avg(epa) as avg_epa')
    )
    .first()

  console.log('\n=== Verification: kickoff return TDs ===')
  console.log(
    `  Total: ${td_check.total} | Negative EPA: ${td_check.negative_epa} | Positive EPA: ${td_check.positive_epa} | Avg EPA: ${Number(td_check.avg_epa).toFixed(4)}`
  )

  if (td_check.negative_epa > td_check.positive_epa) {
    console.log(
      '  PASS: Majority of return TDs now have negative EPA (bad for kicking team)'
    )
  } else {
    console.log('  FAIL: Return TDs still show positive EPA')
  }

  process.exit(0)
}

if (is_main(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

export default main
