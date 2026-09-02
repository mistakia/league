/**
 * The injected timer interface, which is the whole reason auction clock
 * behavior is assertable at all -- MockDate moves `Date.now` without moving
 * `setTimeout`, and nothing else in this repository fakes timers.
 *
 * Recording rather than merely inert: a spec that cares about the clock reads
 * `scheduled`, and one that only needs the auction not to settle itself
 * mid-test ignores it. Both want the same stub, which is why it lives here
 * rather than in either spec.
 */
export default function make_recording_timers() {
  const scheduled = []
  return {
    scheduled,
    set_timeout: (fn, ms) => {
      scheduled.push({ fn, ms })
      return scheduled.length
    },
    clear_timeout: () => {}
  }
}
