import { positions } from './constants'

const getRosterSlotCounts = ({
  sqb,
  srb,
  swr,
  ste,
  sk,
  sdst,
  srbwr,
  swrte,
  srbwrte,
  sqbrbwrte,
  bench,
  nteams
}) => ({
  sqb: nteams * sqb,
  srb: nteams * srb,
  swr: nteams * swr,
  ste: nteams * ste,
  sk: nteams * sk,
  sdst: nteams * sdst,
  srbwr: nteams * srbwr,
  swrte: nteams * swrte,
  srbwrte: nteams * srbwrte,
  sqbrbwrte: nteams * sqbrbwrte,
  bench: nteams * bench
})

const types = [
  'starter',
  'available'
]

const calculateBaselines = ({
  players,
  ...args
}) => {
  let data = JSON.parse(JSON.stringify(players))
  // sort players by points
  data = data.sort((a, b) => b.points.total - a.points.total)

  // group players by position
  const grouped = {}
  for (const position of positions) {
    grouped[position] = data.filter(p => p.pos1 === position)
  }

  const rosterCounts = getRosterSlotCounts(args)

  // baseline players
  const bPlayers = {}
  for (const position of positions) {
    const base = rosterCounts[`s${position.toLowerCase()}`]
    bPlayers[position] = {
      starter: grouped[position].slice(base),
      available: grouped[position].slice(base + (rosterCounts.bench / 4))
    }
  }

  const result = {}
  if (!args.sqbrbwrte && !args.srbwr && !args.wrte && !args.srbwrte) {
    for (const pos of positions) {
      result[pos] = {}
      for (const type in bPlayers[pos]) {
        result[pos][type] = bPlayers[pos][type][0]
      }
    }

    return result
  }

  const filter = (array, cutlist) =>
    array.filter(p => !cutlist.find(c => c.player === p.player))

  if (args.swrte) {
    // TODO fix calculations for types
    for (const type of types) {
      const combined = bPlayers.WR[type].concat(bPlayers.TE[type])
      const sorted = combined.sort((a, b) => b.points.total - a.points.total)
      const cutlist = sorted.slice(0, rosterCounts.swrte)
      bPlayers.WR[type] = filter(bPlayers.WR[type], cutlist)
      bPlayers.TE[type] = filter(bPlayers.TE[type], cutlist)
    }
  }

  if (args.srbwr) {
    // TODO fix calculations for types
    for (const type of types) {
      const combined = bPlayers.RB[type].concat(bPlayers.WR[type])
      const sorted = combined.sort((a, b) => b.points.total - a.points.total)
      const cutlist = sorted.slice(0, rosterCounts.srbwr)
      bPlayers.RB[type] = filter(bPlayers.RB[type], cutlist)
      bPlayers.WR[type] = filter(bPlayers.WR[type], cutlist)
    }
  }

  if (args.srbwrte) {
    // TODO fix calculations for types
    for (const type of types) {
      const combined = bPlayers.RB[type]
        .concat(bPlayers.WR[type])
        .concat(bPlayers.TE[type])
      const sorted = combined.sort((a, b) => b.points.total - a.points.total)
      const cutlist = sorted.slice(0, rosterCounts.srbwrte)
      bPlayers.RB[type] = filter(bPlayers.RB[type], cutlist)
      bPlayers.WR[type] = filter(bPlayers.WR[type], cutlist)
      bPlayers.TE[type] = filter(bPlayers.TE[type], cutlist)
    }
  }

  if (args.sqbrbwrte) {
    // TODO fix calculations for types
    for (const type of types) {
      const combined = bPlayers.QB[type]
        .concat(bPlayers.RB[type])
        .concat(bPlayers.WR[type])
        .concat(bPlayers.TE[type])
      const sorted = combined.sort((a, b) => b.points.total - a.points.total)
      const cutlist = sorted.slice(0, rosterCounts.sqbrbwrte)
      bPlayers.QB[type] = filter(bPlayers.QB[type], cutlist)
      bPlayers.RB[type] = filter(bPlayers.RB[type], cutlist)
      bPlayers.WR[type] = filter(bPlayers.WR[type], cutlist)
      bPlayers.TE[type] = filter(bPlayers.TE[type], cutlist)
    }
  }

  const select = ({ positions, type }, alternate) => {
    let combined = []
    for (const pos of positions) {
      combined = combined.concat(bPlayers[pos][type])
    }
    const sorted = combined.sort((a, b) => b.points.total - a.points.total)
    if (!alternate || sorted[0].points.total < alternate.points.total) {
      return sorted[0]
    } else {
      return alternate
    }
  }

  result.QB = {}
  for (const type of types) {
    result.QB[type] = args.sqbrbwrte
      ? select({ positions: ['QB', 'RB', 'WR', 'TE'], type })
      : select({ positions: ['QB'], type })
  }

  result.RB = {}
  for (const type of types) {
    let selection = select({ positions: ['RB'], type })
    if (args.sqbrbwrte) {
      selection = select({ positions: ['QB', 'RB', 'WR', 'TE'], type }, selection)
    }

    if (args.srbwrte) {
      selection = select({ positions: ['QB', 'RB', 'WR', 'TE'], type }, selection)
    }

    if (args.rbwr) {
      selection = select({ positions: ['RB', 'WR'], type })
    }

    result.RB[type] = selection
  }

  result.WR = {}
  for (const type of types) {
    let selection = select({ positions: ['WR'], type })
    if (args.sqbrbwrte) {
      selection = select({ positions: ['QB', 'RB', 'WR', 'TE'], type }, selection)
    }

    if (args.srbwrte) {
      selection = select({ positions: ['RB', 'WR', 'TE'], type }, selection)
    }

    if (args.swrte) {
      selection = select({ positions: ['TE', 'WR'], type }, selection)
    }

    if (args.srbwr) {
      selection = select({ positions: ['TE', 'WR'], type }, selection)
    }

    result.WR[type] = selection
  }

  result.TE = {}
  for (const type of types) {
    let selection = select({ positions: ['TE'], type })
    if (args.sqbrbwrte) {
      selection = select({ positions: ['QB', 'RB', 'WR', 'TE'], type }, selection)
    }

    if (args.srgbwrte) {
      selection = select({ positions: ['RB', 'WR', 'TE'], type }, selection)
    }

    if (args.swrte) {
      selection = select({ positions: ['TE', 'WR'], type }, selection)
    }

    result.TE[type] = selection
  }

  return result
}

export default calculateBaselines
