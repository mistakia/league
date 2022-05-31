import db from '#db'
import isMain from './is-main.mjs'

const generatePlayerId = async (player) => {
  const firstInitial = player.fname.charAt(0).toUpperCase()
  const lastInitial = player.lname.charAt(0).toUpperCase()
  const preset = firstInitial + lastInitial

  const playerIds = await db('players')
    .select('player')
    .where('player', 'like', `${preset}-%`)
    .orderBy('player', 'desc')
    .limit(1)

  if (!playerIds.length) {
    return `${preset}-1000`
  }

  const cursor = playerIds[0].player
  const results = /[A-Z]{2}-(?<index>[0-9]{4})/.exec(cursor)
  const currentIndex = parseInt(results.groups.index, 10)
  // increase currentIndex by 10 and round to the nearest 10
  const newIndex = Math.ceil((currentIndex + 10) / 10) * 10
  const paddedIndex = ('0000' + newIndex).slice(-4)

  return `${preset}-${paddedIndex}`
}

export default generatePlayerId

if (isMain(import.meta.url)) {
  const main = async () => {
    const playerId = await generatePlayerId({
      fname: 'Francis',
      lname: 'Scott'
    })

    console.log(playerId)
    process.exit()
  }

  main()
}
