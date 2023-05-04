export default function (position) {
  position = position ? position.toUpperCase() : null

  if (position.includes('/')) {
    position = position.split('/')[0]
  }

  switch (position) {
    case 'EDGE':
      return 'DE'

    case undefined:
    case null:
      return 'INA'

    default:
      return position
  }
}
