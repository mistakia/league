import { get_data_view_results, data_view_cache } from '#libs-server'
import get_table_hash from '#libs-server/get-table-hash.mjs'

class DataViewQueue {
  constructor() {
    this.queue = []
    this.processing = false
  }

  add_request({ ws, request_id, params, user_id }) {
    const position = this.queue.length + 1
    this.queue.push({ ws, request_id, params, user_id, position })
    this.send_position_update({ ws, request_id, position })
    this.process_queue()
  }

  remove_request(ws) {
    this.queue = this.queue.filter((item) => item.ws !== ws || item.user_id)
    this.update_queue_positions()
  }

  send_position_update({ ws, request_id, position }) {
    ws.send(
      JSON.stringify({
        type: 'DATA_VIEW_POSITION',
        request_id,
        position
      })
    )
  }

  update_queue_positions() {
    this.queue.forEach((item, index) => {
      const new_position = index + 1
      if (item.position !== new_position) {
        item.position = new_position
        this.send_position_update({
          ws: item.ws,
          request_id: item.request_id,
          position: new_position
        })
      }
    })
  }

  async process_queue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    const { ws, request_id, params } = this.queue.shift()

    try {
      ws.send(
        JSON.stringify({
          type: 'DATA_VIEW_STATUS',
          request_id,
          status: 'processing'
        })
      )

      const cache_key = get_table_hash(JSON.stringify(params))
      const cached_result = await data_view_cache.get(cache_key)

      if (cached_result) {
        ws.send(
          JSON.stringify({
            type: 'DATA_VIEW_RESULT',
            request_id,
            result: cached_result
          })
        )
      } else {
        const result = await get_data_view_results(params)

        if (result && result.length) {
          const cache_ttl = 1000 * 60 * 60 * 12 // 12 hours
          await data_view_cache.set(cache_key, result, cache_ttl)
        }

        ws.send(
          JSON.stringify({ type: 'DATA_VIEW_RESULT', request_id, result })
        )
      }
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: 'DATA_VIEW_ERROR',
          request_id,
          error: error.toString()
        })
      )
    } finally {
      this.processing = false
      this.process_queue()
    }
  }
}

const data_view_queue = new DataViewQueue()

export default function handle_data_view_socket(wss) {
  wss.on('connection', function (ws, request) {
    const { userId } = request.auth

    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      if (message.type === 'DATA_VIEW_REQUEST') {
        const { request_id, params } = message.payload
        data_view_queue.add_request({ ws, request_id, params, user_id: userId })
      }
    })

    ws.on('close', () => {
      if (!userId) {
        data_view_queue.remove_request(ws)
      }
    })
  })
}
