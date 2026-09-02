import { useEffect, useState } from 'react'

/**
 * A media query as react state.
 *
 * `@mui/material` ships a hook of this name and this is deliberately not it:
 * test/app.mui-import-ratchet.spec.mjs caps `@mui/material` at its current
 * import count and fails on an increase, so reaching for the library version
 * would spend the budget on a hook that is nine lines.
 *
 * IT RESOLVES FALSE ON THE FIRST RENDER DURING SSR and corrects on mount, since
 * `matchMedia` does not exist on the server. A caller whose initial state
 * depends on the answer -- a panel that should start collapsed on a phone --
 * must remount rather than seed, because a `default_` prop is read once and the
 * correction arrives after it.
 */
export const useMediaQuery = (query) => {
  const [matches, set_matches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia(query)
    const update = () => set_matches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}
