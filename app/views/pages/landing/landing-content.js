// Copy and link targets for the landing page, kept apart from the markup so a
// change of fact or of contact route is a one-line edit rather than a JSX edit.

// The vetting questionnaire does not exist yet. Until it does the page carries
// NO call to action: the only other contact route available is an invite to the
// league's Discord server, and handing a stranger a seat in the members' room
// before any vetting is the wrong order.
export const questionnaire_url = null

// The live league. It is publicly readable without an account, which is most of
// the argument this page is making — a prospect can go look rather than take my
// word for any of it.
export const league_url = '/leagues/1'

// Every claim here is checkable against the constitution. Ten teams means no
// divisions (Article V, Section 13) — divisions exist only at twelve.
export const league_format = [
  'Ten teams, half-PPR, superflex. At ten teams there are no divisions — one league-wide standing.',
  'Dynasty with a salary cap. Players extend automatically up a fixed ladder each offseason, so the real decision is who you let go.',
  'One franchise tag, two restricted free agency nominations, and one rookie tag per year.',
  'Rookie draft on a pick clock, then a free agency auction for whoever is left. FAAB waivers run Wednesdays in season.'
]
