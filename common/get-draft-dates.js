import getDraftWindow from './get-draft-window'

export default function getDraftDates({
  start,
  min = 11,
  max = 16,
  picks,
  type = 'hour'
}) {
  const draftEnd = getDraftWindow({
    start,
    min,
    max,
    pickNum: picks + 1,
    type
  })

  const waiverEnd = draftEnd.endOf('day').add(1, 'day')
  return {
    draftEnd,
    waiverEnd
  }
}
