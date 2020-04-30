const map = new Map()

module.exports = (wss) => {
  wss.on('connection', function(ws, request) {
    const userId = request.session.userId

    map.set(userId, ws)

    ws.on('message', function(message) {
      //
      // Here we can now use session parameters.
      //
      console.log(`Received message ${message} from user ${userId}`)
    })

    ws.on('close', function() {
      map.delete(userId)
    })
  })
}
