const aliases = {
  'Mark Ingram II': {
    player: 'MI-0100'
  },
  'Antonio Brown': {
    player: 'AB-3500'
  }
}

const normalizePlayerName = (name) => {
  if (aliases[name]) {
    return aliases[name]
  }

  const fname = name.split(' ').shift()
  const lname = name.split(' ').splice(1).join(' ')
  return {
    fname,
    lname
  }
}

module.exports = normalizePlayerName
