export default function (position) {
  position = position ? position.toUpperCase() : null

  switch (position) {
    case undefined:
    case null:
      return 'INA'

    default:
      return position
  }
}
