// Throws a tagged Error when `message` is a non-empty string, otherwise
// returns. Used to surface oracle row-count shortfalls from pipeline scripts
// to report_job so failures emit signals instead of silently exiting 0.
export default function throw_if_shortfall(message) {
  if (!message) return
  const err = new Error(message)
  err.row_count_shortfall = true
  throw err
}
