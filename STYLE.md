# xo.football Design System

## Aesthetic: Newspaper Worksheet

Minimal and modern, set like a broadsheet and ruled like a worksheet. Structure is carried by
typography, rules and alignment — never by boxes, cards, gradients or shadows. The subject is
football, so the page borrows the field's own marks: ruled lines across it, and route arrows for
the wordmark.

**On the landing page the worksheet is read as a field**, and the reading cost one hairline. The
rules were already there — a stack of horizontal lines with nothing at either end. Drawing the
sideline is what closes them into a field:

| On the page                                        | On the field            |
| -------------------------------------------------- | ----------------------- |
| The 1px border around `.landing`                   | Sidelines and end lines |
| The two 2px ink rules                              | The goal lines          |
| The hero above the first, the space below the last | The end zones           |
| The 1px ink band rule opening a section            | A ten-yard line         |
| The hairline between two entries                   | The yard lines between  |

Nothing was added for the metaphor and nothing is decorative. **Ticks along the band rules were
tried in an earlier pass and removed at the operator's word, and there are no yard numbers** —
four invented figures on a page whose argument is that its numbers are real.

## Core Principles

- **Two faces, no third** — IBM Plex Mono for display and labels, Inter for prose and section heads
- **Rules, not boxes** — three rule weights do the work a card would otherwise do
- **One ground** — every surface is `$backgroundColor`; paper is for controls, not for pages
- **One accent** — a single deep red, spent on hover, focus and error and nothing else
- **One left edge, and now no exception** — the lede, every section head and every entry label
  align to it at every width. The section head was right-aligned in the rail for a while, because
  on the left edge it read as one more item in the list and face and size were losing that argument
  alone. The sideline settles it: a head is the first thing inside a segment of the field, under
  that segment's own ten-yard line
- **Restraint at rest** — colour and emphasis arrive on interaction, not on load

## Two Languages, One Ground

The repo has two visual languages and they are not interchangeable.

|         | App chrome                                            | Prose pages                                                      |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| For     | Tables read in glances — auction, players, data views | Pages read in paragraphs — landing, pitch, questionnaire, ballot |
| Tokens  | `app/styles/variables.styl`                           | `app/styles/prose-form.styl`                                     |
| Ink     | `$textColor` (`#444`), mid grey                       | `$prose_ink` (`#17181a`), near black                             |
| Density | Dense, chrome-forward                                 | Open, measured                                                   |

**They share the GROUND and nothing else.** `prose_surface()` paints `$backgroundColor` — the same
colour the app body, the menu drawer and the document pages carry. A paper surface here was tried
and reverted: it made the landing page the only surface on the site that did not match the menu
beside it, which reads as the menu being wrong rather than as the page being paper.

`prose-form.styl` is injected into every stylesheet by `stylusOptions.import`, so it holds
**mixins and variables only** — a top-level rule there is emitted once per stylesheet.

## Palette

Defined in `app/styles/prose-form.styl`.

| Token                | Value     | Use                                                |
| -------------------- | --------- | -------------------------------------------------- |
| `$prose_ink`         | `#17181a` | Headlines, labels, link text                       |
| `$prose_body`        | `#3d4045` | Running prose                                      |
| `$prose_muted`       | `#696d72` | Eyebrows, blurbs, notes, placeholders              |
| `$prose_paper`       | `#ffffff` | Cards and form controls — **not** page backgrounds |
| `$prose_rule`        | `#d7d9dc` | The hairline between two things of the same kind   |
| `$prose_rule_strong` | `#c9cbcf` | Link underlines and input borders                  |
| `$prose_rule_heavy`  | `#17181a` | The band rule that opens a section                 |
| `$prose_accent`      | `#c1121f` | Hover, focus rings, errors. Nothing else           |
| `$prose_action`      | `#636a73` | Filled submits and the floating menu button        |

Three of these are set against the ground rather than against white. `$prose_rule` was `#e3e4e6`,
four steps off `#f0f0f0`, so rules that were present in the DOM were invisible on screen.
`$prose_muted` was `#6b7075`, which clears AA on white at 5.0:1 and is 4.39:1 on the ground the
pages actually sit on — under the floor, for text set at normal size in every place it appears.
`$prose_action` is deliberately not ink: at near-black a several-hundred-pixel block reads as a
hole punched in the page.

**Check a grey against the surface it lands on, not against white.** Two of the three above were
first measured on white and shipped failing on `#f0f0f0`. `$prose_action` is the exception that
proves the rule — it is a background, so the ratio that governs it is 5.47:1 against its own white
LABEL, and that is the floor on going lighter.

## Typography

Loaded in `app/index.html`: **IBM Plex Mono 300/400/500/600** and **Inter 400/500/600/700**.

**The weight facts are asymmetric and both matter.** `$prose_bold` is 600 because Plex Mono has no
700 — asking for it gets a synthesized bold, which on mono reads as a smudge. Inter _does_ load
700, so the sans section label is the one place on these pages that can go heavier, and it is
drawn rather than faked.

| Role         | Mixin                   | Face      | Size                               | Weight  |
| ------------ | ----------------------- | --------- | ---------------------------------- | ------- |
| Body         | `prose_page()`          | Inter     | 17px / 1.7                         | 400     |
| Page title   | `prose_title()`         | Plex Mono | `clamp(30px, 4.4vw, 40px)`         | 600     |
| Hero lede    | page-local              | Plex Mono | `clamp(25px, 3.1vw, 34px)`         | 600     |
| Section head | `prose_section_label()` | **Inter** | 0.6875em, `0.12em` tracking, upper | **700** |
| Group label  | `prose_section_title()` | Plex Mono | 0.8125em, `0.14em` tracking, upper | 600     |
| Eyebrow      | `prose_eyebrow()`       | Plex Mono | 0.75em, `0.16em` tracking, upper   | 500     |
| Field label  | `prose_label()`         | Plex Mono | 0.9375em                           | 600     |

Rules:

- **Mono sets loose and even**, so it takes negative tracking (`-0.02em` to `-0.025em`) and tight
  leading at display size, or a headline reads as a terminal dump.
- **A section head is SMALLER than the entries under it.** That is the newspaper order — the head
  names where you are, the items are what you came to read. The band rule above it supplies the
  hierarchy that size would otherwise have to.
- **So is the blurb beside it**, and it stays a step under the entry descriptions it introduces —
  `0.875em` against their `0.9412em`. At body size it was the largest type in its own row, so the
  rule said a section was starting and the type said the orientation line was the thing to read.
- **A directory entry is not a paragraph.** 17px is a READING size, set against running prose, and
  the landing descriptions are one-line captions in a list of fourteen — at 17px half of them took
  two lines, the page ran a screen and a half, and the rules that structure it were too far apart
  to read as a field. They are `0.9412em` (16px). This is a landing-page exception, not a change to
  `prose_page()`: the questionnaire and the ballot ARE paragraphs and keep 17px.
- **Section head and group label are separated by FACE**, not by size. Sizing the parent larger was
  the old answer and it cost a step in the type scale to say what two faces already say.
- **17px is the floor for any form control.** Below 16px iOS Safari zooms on focus and does not
  zoom back out.
- `text-wrap: balance` on headlines, `text-wrap: pretty` on prose. Both degrade to `normal`.
- **The field did not buy a third face, and was asked to.** A condensed grotesque for yard numerals
  is the obvious candidate and there is nowhere to put it: the field is legible from its lines, the
  only label near it is the 11px section head, where a display face is unreadable and pointless,
  and drawing actual numerals means inventing four figures. A third face needs a job the two cannot
  do; this one had a look it wanted instead.

## Structure

### The measure

`prose_page()` is **680px** — a prose measure, ~72 characters, for pages that are one running
column (the questionnaire, the ballot).

`prose_page_wide()` is **880px**, for the two reading pages, whose body is a rail. Inside 680px the
rail left the prose column at 412px. Every added pixel goes to the prose column and none to the
rail. The hero does not widen with it — the lede stays at 26ch and the deck at 46ch.

### The rail — `prose_rail()`

A **208px** label column, a **28px** gutter, prose filling the rest. Collapses to stacked below
640px, because a rail taking a quarter of a phone leaves the prose at an unreadable measure.

208px is set against the _longest_ label, not the average. A directory entry and a group of league
rules are the same object — a short mono label naming a thing, and prose about it — and in a rail
the labels form a column that can be read down without reading any of the prose beside them.
Because they are the same object they take the same treatment on both pages: a mono label in the
rail, prose beside it, and a hairline above each row but the first.

The label column's width is `$prose_rail_label`, one token rather than a literal, because the
Genesis section head is not inside a rail — it is a full-width child that reproduces the column's
width to sit where the landing page's does.

**The section head is right-aligned in that column**, and the entry labels are not. Both sat on the
same left edge, so a head read as one more item in the list; face and size were carrying that
distinction alone and losing. It goes back to the left below 640px, where the rail is `display
block` and there is no column for it to sit at the right of.

**The two cells sit on one baseline**, via `align-items: baseline` on the grid. The label is
smaller than the prose and in a different face, so aligning the boxes left their first baselines
3px apart on a landing entry, 7px on a Genesis group and 9px under a section head. Grid baseline
alignment rather than a padding on each label: the offset is a function of two fonts' metrics and
three type sizes, so a hardcoded nudge is wrong the moment any of the five inputs moves.

### The rules — three weights

| Weight            | Where                                                    | Says                                                                         |
| ----------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2px ink           | `prose_section_band(2px)`, and the last rule on the page | Masthead, and the goal line                                                  |
| 1px ink           | `prose_section_band()`                                   | A new section begins                                                         |
| 1px `$prose_rule` | Between entries                                          | Two things of the same kind                                                  |
| 1px `$prose_rule` | The border around `.landing`                             | The sideline. Hairline, so the frame never outranks the goal lines inside it |

**The yard lines stop 20px short of the sideline** (12px on a phone), via a negative margin and an
equal padding on every ruled block — band, entry hairline and the closing goal line, so no rule is
a different length from its neighbours. They stop short rather than meeting it because meeting it
closes every row into a cell, and a page of cells is a table, which is what the rest of the site
already is.

**A page is bracketed by the heavy weight top and bottom.** The 2px rule that opens the first
section closes the last one too, so a reader reaching the end sees the directory finish rather than
run out. On the landing page the closing rule carries no copy at all (`.landing__end`) — a footer
of links there would repeat the directory it is closing.

The header does **not** carry its own rule. Giving it one puts two parallel rules sixty pixels
apart with nothing between them, which reads as a mistake rather than as two levels of break.

## The Mark

`app/views/pages/landing/route-diagram.js` — the two football routes from `static/images/icon.png`,
redrawn at the icon's own 512×512 coordinates so the two read as one object. Nothing added, nothing
stylised.

It sits **in the top end zone, above the header text, at 72px, at every width** — one placement and
no breakpoint. The text never moves for it: the lede shares its left edge with every section head
and every entry label, and putting the mark above rather than beside it is what keeps that free.

**It used to hang in the left margin above 1400px**, out of flow, at 104px. The sideline ended
that. With a border drawn around the page there is no margin to hang in — only inside the field and
outside it — and the hanging mark landed outside, 8px off the new left sideline, because its 32px
gap was measured from the text edge and the frame sits 32px left of that. A bigger gap and a higher
breakpoint would have bought a second layout, visible only above ~1460px, whose entire purpose was
to protect an alignment the frame now protects for free.

Two facts from that era worth keeping, because both would be re-derived wrongly. The old breakpoint
was set by the **nav drawer**, not the page gutter — the obvious arithmetic (`(viewport - 880) / 2`)
answers the wrong question, and the mark overlapped the drawer by 24px at 1280px. And the mark is
72px rather than 104px because in the margin it was free, occupying space the page was not using,
while in the end zone it spends the top of the first screen: at 104px it pushed the eyebrow 293px
down a 1280x900 laptop.

Inline SVG, not `@components/icon`: the sprite is a 24×24 UI-glyph surface, and a name with no
symbol in it renders **nothing** rather than erroring.

## Interaction

- **120ms** for colour and border. Geometry moves only on `:active` (`translateY(1px)`).
- **Accent on hover, not at rest.** A link is ink with a `$prose_rule_strong` underline; hover
  repaints both to the accent.
- **The underline is a real underline, not a bottom border.** A border sits on the bottom of the
  line box, so one value lands at two depths across a 1.45 label and 1.7 running prose, and it runs
  through every descender. `text-underline-offset: 0.28em` measures from the baseline instead, and
  `text-decoration-skip-ink` breaks around the descenders.
- **Focus is a ring, not a hue swap.** `outline: 2px solid $prose_accent` with a 3px offset — a
  border that only changes colour is invisible to anyone who cannot separate the two. Where the
  element repaints to the accent on hover, the ring is ink instead.
- **3px radius** everywhere it appears. Never larger.

## Anti-Patterns

- **No filled button on a reading page.** A filled button is the register of something being sold,
  and neither reading page sells anything. Their next steps are text links. `prose_action_fill()`
  is for real form submits.
- **No boxes or cards on a prose page.** A directory drawn as a grid of cards becomes a marketing
  page the moment there are three of them. The landing frame is not the exception it looks like:
  what a card wraps is a content GROUP, and there are four of those here. The frame encloses the
  page, once, at the same hairline the entries use — it is the sideline, not a container drawn
  around anything.
- **No shadows for depth.** The one shadow in the language lifts the floating action off the page.
- **No `@mui/*` import.** `test/app.mui-import-ratchet.spec.mjs` holds per-package budgets that must
  EQUAL the real count in both directions — adding _or removing_ an import fails unless the budget
  moves in the same commit.
- **No second measure, type scale or ink.** These pages are read one after another; a change
  between them reads as a different site.
- **No bare z-index.** Use the named scale in `variables.styl`; `yarn check:z-index-scale` fails CI
  on a literal.

## Traps That Fail Silently

Every one of these has already shipped a broken page. Full accounts in
[docs/guides/spa.md](docs/guides/spa.md).

- **An element selector beats a bare class.** `.landing h2` is (0,1,1) and wins over
  `.landing__section-title`. Worse, it wins _selectively_: it sets family, weight, colour and
  tracking but no `font-size`, so an unqualified rule renders at the new size in the old face and
  reads as a change that landed. Qualify with the element — `.landing h2.landing__section-title`.
  This has now shipped twice. The second was `.genesis-league__group-title`, where `.genesis-league
h3` won on colour, tracking and line-height while letting `font-size` and `text-transform`
  through: the group labels rendered uppercase at the right size in near-black at `-0.01em`, which
  is the section head's own voice rather than the muted rail label they are meant to be. Nothing
  was missing from the page and nothing was misaligned, so it survived a design pass unnoticed.
- **An undefined stylus variable emits a bare ident**, and an unimported mixin emits nothing at
  all. Both look like a clean build.
- **`-$var` is not negation** inside a multi-value property. Bind the negative to its own variable.
- **`$variables` are not substituted inside `calc()`.** Use the custom-property form.
- **A `var(--x)` nothing declares drops the whole declaration.** This app styles with stylus
  tokens; a CSS custom property is the exception and must be declared somewhere.
- **`normalize.css` strips `-webkit-appearance` from every `input`**, so a hand-rolled checkbox has
  no box, no tick and no size, and `accent-color` is inert. Call `prose_checkbox()`.
- **A non-`.button` direct child of `<ButtonGroup>` silently un-paints the segmented control**, and
  the change that does it touches no stylesheet. Everything that makes a group read as one control
  is written in `button.styl` as `.button-group > .button` plus a `+ .button` adjacency, so a
  wrapper div in a segment slot is reached by none of it: the wrapped button keeps full radius and
  its own hover shadow, and the segment AFTER the wrapper loses both its `-1px` and its seam
  border, because its previous sibling is no longer a button. Nothing errors and nothing is missing
  from the DOM. Shipped 2026-09-04, when the auction's optional nomination ceiling was added by
  wrapping the Nominate button and the new input together — and that wrapper was `action`, which
  renders as a stepper segment. **Put a new control BESIDE the group, not inside it**; the row
  around it already carries the gap. `player-context-menu.js` states the same rule at its own call
  site.

## Verifying a Style Change

**The emitted CSS is the oracle, never the source** — a source read cannot distinguish a mixin that
expanded from one that silently did not.

1. **Read computed style off the real element.** `getComputedStyle` after a real build, not the
   `.styl` file.
2. **Grep the compiled CSS for a stray token** — `/:\s*[^;{}]*\$[a-z_]+/i` must return zero — and
   grep a token you know is present as a control, so the zero is not vacuous.
3. **Screenshot both pages at desktop and at a phone width.** Both have a 640px breakpoint.
4. **Sweep for truncation on elements that can actually clip.** An element with `overflow: visible`
   never truncates its child, so counting it reports a decorative pseudo as if it were a cut-off
   name. Walk descendants, skip the ones with visible overflow, and prove the sweep can fire by
   clipping something on purpose.
5. **A container's overflow cannot see a child that truncates**, and a check that measures only the
   element you added cannot see what your change did to the layout around it.

`yarn dev:live` per `user:guideline/software/develop-league.md`, and note a sibling session may
already have a dev server up — check before starting your own.
