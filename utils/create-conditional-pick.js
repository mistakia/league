// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const dayjs = require('dayjs')
const argv = require('yargs').argv

const { constants } = require('../common')
const { getLeague } = require('../utils')
const db = require('../db')

const createConditionalPick = async function ({ tid, league }) {
  const isBeforeDraft = league.ddate
    ? constants.season.now.isBefore(dayjs.unix(league.ddate))
    : true
  const year = isBeforeDraft ? constants.season.year : constants.season.year + 1
  await db('draft').insert({
    tid,
    lid: league.uid,
    otid: tid,
    comp: 1,
    round: 4,
    year
  })
}

module.exports = createConditionalPick

/* eslint-disable no-extra-semi */
if (!module.parent) {
  ;(async function () {
    const tid = argv.tid
    if (!tid) {
      console.log('missing --tid')
      return
    }

    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const league = await getLeague(lid)
    await createConditionalPick({
      tid,
      league
    })
  })()
}
/* eslint-enable no-extra-semi */
