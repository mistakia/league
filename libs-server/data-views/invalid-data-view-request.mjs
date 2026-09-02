// The one error class a data-view caller is allowed to READ.
//
// Two consumers ask the same question of a thrown error and neither can answer
// it from the message text. The routes ask it to choose 400 over 500; the
// websocket frame asks it to decide whether the message may cross to the
// browser at all. Both answers are the same answer, so it is one flag.
//
// THE DEFECT THIS EXISTS FOR. Everything `get_data_view_results` threw was a
// bare `Error`, so a caller who composed an impossible view got HTTP 500 and
// the page rendered "Error occured while processing request" -- the generic
// string, because the client cannot tell an authored refusal from a Postgres
// driver message carrying the whole generated SQL, and dropping every message
// is the only safe default when there is no class to test. The refusal that
// says exactly which two columns to split was written, sent, and thrown away
// at the last hop. On 2026-09-02 both of the two saved views carrying a `line`
// row axis failed this way -- every one that existed.
//
// So the flag is what makes the message SAFE, not merely convenient: a message
// raised through here is authored prose about the request, echoes no value the
// caller did not send, and names no schema. An error that does not come through
// here keeps its generic treatment, which is the correct default for a driver
// message and stays correct for one nobody has classified yet.

/**
 * @param {string} message - authored prose, safe to show the caller
 * @returns {Error} carrying is_invalid_request
 */
export const invalid_data_view_request = (message) => {
  const error = new Error(message)
  error.is_invalid_request = true
  return error
}
