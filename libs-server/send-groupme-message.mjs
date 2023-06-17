import groupme from 'groupme'
const API = groupme.Stateless

export default async function ({ token, id, message }) {
  await API.Bots.post.Q(token, id, message, {})
}
