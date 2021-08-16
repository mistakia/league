const API = require('groupme').Stateless

module.exports = async ({ token, id, message }) => {
  await API.Bots.post.Q(token, id, message, {})
}
