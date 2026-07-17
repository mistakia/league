// Reusable clipboard write. Returns the writeText promise so callers can chain
// success feedback. This is the forward convention for copy actions.
export default function copy_to_clipboard(text) {
  return navigator.clipboard.writeText(text)
}
