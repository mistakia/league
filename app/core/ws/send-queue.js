// Messages written before the socket finished opening, held until `onopen`.
//
// QUEUEING IS OPT-IN, AND ONLY A PER-SOCKET REGISTRATION MAY OPT IN. Every
// caller shared one buffer before this and nothing ever emptied it, so a frame
// written against a socket that never opened was flushed onto the NEXT socket.
// For a registration that is harmless -- AUCTION_JOIN and SCOREBOARD_REGISTER
// are idempotent, carry no board state, and re-registering is exactly what the
// new socket needs. For a COMMAND it is a different decision than the one the
// manager made: AUCTION_BID names a price the manager chose against the board
// in front of them, and delivering it a minute later places that bid at a price
// the board has moved past, against a real cap, in a live auction. A nomination
// and the commissioner's pause carry the same problem in a smaller form.
//
// Expiring entries by age would be the wrong axis. The board moves per BID, not
// per second, so a two-second-old bid can already name a superseded price and
// any TTL is a guess that admits stale commands or drops valid registrations.
// What separates the two is the message, not its age.
//
// THE QUEUE DOES NOT CROSS A SOCKET BOUNDARY, and it loses nothing by refusing
// to. Its whole job is the window on a FIRST connect where a socket is
// CONNECTING and no close will ever fire, so nothing else would re-drive the
// registration. Once a socket has dropped, the reconnect saga puts
// WEBSOCKET_RECONNECTED and both registrations re-send themselves from current
// state -- `rejoin_auction` off `is_joined`, which is set when the client SENDS
// a join rather than when the server answers, and `reregister` off `isLoaded`.
// A replayed buffer would be the same two frames built from staler state.
// The data-view results request is the third member, and it is a READ rather
// than a registration: idempotent, carrying no board state, and correct to run
// against whatever socket opens. It joins on the same terms and for the same
// window -- the data-views page issues its first query from a mount effect,
// which routinely beats the socket open on a cold load.
//
// It is the one member that can be written more than once in that window (every
// column add is another request), so it passes a `replace_key`. Without it a
// user who edits while connecting flushes every intermediate request at once and
// the table renders whichever ANSWER lands last, which is not necessarily the
// state on screen.
let messages = []

export const enqueue = (message, { replace_key } = {}) => {
  if (replace_key) {
    messages = messages.filter((entry) => entry.replace_key !== replace_key)
  }
  messages.push({ message, replace_key })
}

export const flush = (socket) => {
  const queued = messages
  messages = []
  queued.forEach((entry) => socket.send(JSON.stringify(entry.message)))
}

export const clear = () => {
  messages = []
}

export const pending = () => messages.map((entry) => entry.message)
