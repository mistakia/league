// THE APP'S ONE REACH FOR A TOOLTIP, and it exists to be the seam rather than
// to add behaviour. Nine components imported `@mui/material/Tooltip` directly;
// they import this instead, so the SPA names MUI in one file where it used to
// name it in nine.
//
// That is the shape the MUI removal needs. `test/app.mui-import-ratchet.spec.mjs`
// is a ceiling that ends at zero, and a primitive reached through a seam is
// retired by rewriting ONE file — the call sites do not move, and nothing has to
// be converted twice. Reached directly, every future replacement is a nine-file
// change that has to be re-verified at each site.
//
// A BARE RE-EXPORT, NOT A WRAPPER. MUI's Tooltip clones its child to attach a
// ref and its own hover handlers, so a wrapper that rendered `<Tooltip>{children}</Tooltip>`
// would be identical in every respect except for the extra component in the
// tree — and props this file did not think to forward would silently vanish
// (`placement`, `enterDelay`, `open`, `disableInteractive` are all in use or a
// keystroke away). Re-exported, the component IS MUI's, so every prop, every
// ref and every escape hatch keeps working and the swap is provably inert.
//
// WHAT REPLACING IT WILL COST, recorded here because the re-export makes it look
// free: the callers depend on MUI's contract, not just its name. It takes a
// SINGLE element child and clones it, so the replacement must too; `title`
// accepts a node rather than a string; and an empty `title` renders no tooltip
// at all, which several call sites rely on for an absent description. Match
// those three and no call site changes.
export { default } from '@mui/material/Tooltip'
