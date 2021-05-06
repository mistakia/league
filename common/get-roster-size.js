const getRosterSize = ({
  sqb = 0,
  srb = 0,
  swr = 0,
  ste = 0,
  srbwr = 0,
  srbwrte = 0,
  sqbrbwrte = 0,
  swrte = 0,
  sdst = 0,
  sk = 0,
  bench = 0
}) => {
  return (
    sqb +
    srb +
    swr +
    ste +
    srbwr +
    srbwrte +
    sqbrbwrte +
    swrte +
    sdst +
    sk +
    bench
  )
}

export default getRosterSize
