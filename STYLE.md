# xo.football Design System

## Aesthetic: Newspaper Worksheet

Minimal and modern, set like a broadsheet and ruled like a worksheet. Structure is carried by
typography, rules and alignment — never by boxes, cards, gradients or shadows. The subject is
football, so the page borrows the field's own marks: ruled lines across it, and route arrows for
the wordmark.

**On the landing page the worksheet is read as a field.** Most of the marks were already there:

| On the page                                        | On the field                                    |
| -------------------------------------------------- | ----------------------------------------------- |
| The two 2px ink rules                              | The goal lines                                  |
| The hero above the first, the space below the last | The end zones                                   |
| The 1px ink band rule opening a section            | A ten-yard line                                 |
| The hairline between two entries                   | The yard lines between                          |
| `.landing__yard`                                   | The yard numbers                                |
| `.landing__section::before`                        | The hash marks, down the right sideline         |
| `.landing__end`                                    | The end zone: two boundaries and a distribution |

**The field is marked from the inside, and this is the constraint, not a detail.** Sidelines and
end lines drawn as a hairline rectangle around `.landing` were tried and removed: whatever it is
called, a rectangle around a directory of four groups is the grid of cards the anti-patterns
forbid, drawn once instead of four times, and it read as a container on sight. Ticks along the band
rules were tried in an earlier pass and removed too. **What carries the reading is the yard
numbers** — the mark a reader identifies before he has thought about it, and the reason a field is
recognisable from the top row with no sideline in view. Painted on the ground, they cost nothing at
the page's edges, which is exactly where the border went wrong.

## Core Principles

- **Two faces for reading, and one for paint** — IBM Plex Mono for display and labels, Inter for
  prose and section heads, and Chivo 900 for the landing field's markings and nothing else. The
  bar a third face has to clear is a job the two cannot do: a painted field numeral is one, a
  heading is not
- **Rules, not boxes** — three rule weights do the work a card would otherwise do
- **One ground** — every surface is `$backgroundColor`; paper is for controls, not for pages
- **One accent** — a single deep red, spent on hover, focus and error and nothing else
- **One left edge, and now no exception** — the lede, every section head and every entry label
  align to it at every width. The section head was right-aligned in the rail for a while, because
  on the left edge it read as one more item in the list and face and size were losing that argument
  alone. The yard number settles it from the other side of the row: a head is now the left end of a
  marked ten-yard line rather than the first row of a list, and it does not have to leave the
  page's one alignment to say so
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

| Token                | Value     | Use                                                                       |
| -------------------- | --------- | ------------------------------------------------------------------------- |
| `$prose_ink`         | `#17181a` | Headlines, labels, link text                                              |
| `$prose_body`        | `#3d4045` | Running prose                                                             |
| `$prose_muted`       | `#696d72` | Eyebrows, blurbs, notes, placeholders                                     |
| `$prose_paper`       | `#ffffff` | Cards and form controls — **not** page backgrounds                        |
| `$prose_rule`        | `#d7d9dc` | The hairline between two things of the same kind, and every field marking |
| `$prose_rule_strong` | `#c9cbcf` | Link underlines and input borders                                         |
| `$prose_rule_heavy`  | `#17181a` | The band rule that opens a section                                        |
| `$prose_accent`      | `#c1121f` | Hover, focus rings, errors. Nothing else                                  |
| `$prose_action`      | `#636a73` | Filled submits and the floating menu button                               |

Three of these are set against the ground rather than against white. `$prose_rule` was `#e3e4e6`,
four steps off `#f0f0f0`, so rules that were present in the DOM were invisible on screen.
`$prose_muted` was `#6b7075`, which clears AA on white at 5.0:1 and is 4.39:1 on the ground the
pages actually sit on — under the floor, for text set at normal size in every place it appears.
`$prose_action` is deliberately not ink: at near-black a several-hundred-pixel block reads as a
hole punched in the page.

**One paint for every field marking.** The yard numbers, the hash marks and the end zone figure's
bars are all `$prose_rule`, the faintest grey in the palette, and paint is the one thing on the page
that can afford it: a mark at 48px is legible at a contrast a line of prose would vanish at, and
every one of these is decorative by construction, carrying nothing a reader has to make out. The
yard number was a step darker at first, which is the value for a LINE a reader is meant to notice,
and at that size it read as ink competing with the head across the row from it.

**The rule bends in exactly one place, and it is a layering.** The end zone's curve and interval are
`$prose_rule_strong`, one step darker than the bars they are drawn over. Everything else painted on
this page sits on the bare ground; these sit on another marking, and a fit painted at the value of
the thing it is fitted to is not a second mark at all — it reads as an edge on the bars. One step is
enough because the two never coincide: the curve rides above the bar tops wherever the sample fell
short, and that gap is what the difference has to survive. The wordmark that used to sit in this
band took the same step for the same reason, and the reason outlived it.

**Check a grey against the surface it lands on, not against white.** Two of the three above were
first measured on white and shipped failing on `#f0f0f0`. `$prose_action` is the exception that
proves the rule — it is a background, so the ratio that governs it is 5.47:1 against its own white
LABEL, and that is the floor on going lighter.

## Typography

Loaded in `app/index.html`: **IBM Plex Mono 300/400/500/600**, **Inter 400/500/600/700** and
**Chivo 900** — that one weight alone, because 900 is the whole reason it is here.

**The weight facts are asymmetric and both matter.** `$prose_bold` is 600 because Plex Mono has no
700 — asking for it gets a synthesized bold, which on mono reads as a smudge. Inter _does_ load
700, so the sans section label and the yard number are the two places on these pages that can go
heavier, and both are drawn rather than faked.

| Role         | Mixin                   | Face      | Size                               | Weight  |
| ------------ | ----------------------- | --------- | ---------------------------------- | ------- |
| Body         | `prose_page()`          | Inter     | 17px / 1.7                         | 400     |
| Page title   | `prose_title()`         | Plex Mono | `clamp(30px, 4.4vw, 40px)`         | 600     |
| Hero lede    | page-local              | Plex Mono | `clamp(25px, 3.1vw, 34px)`         | 600     |
| Section head | `prose_section_label()` | **Inter** | 0.6875em, `0.12em` tracking, upper | **700** |
| Group label  | `prose_section_title()` | Plex Mono | 0.8125em, `0.14em` tracking, upper | 600     |
| Eyebrow      | `prose_eyebrow()`       | Plex Mono | 0.75em, `0.16em` tracking, upper   | 500     |
| Field label  | `prose_label()`         | Plex Mono | 0.9375em                           | 600     |
| Yard number  | `.landing__yard`        | **Chivo** | 48px, turned `vertical-rl`         | **900** |

Rules:

- **Mono sets loose and even**, so it takes negative tracking (`-0.02em` to `-0.025em`) and tight
  leading at display size, or a headline reads as a terminal dump.
- **A section head is a step off ink**, at `$prose_body`. It and the entry labels were both
  `$prose_ink`, so the head was the same colour as the twelve destinations it names. Ink belongs to
  the entry labels, which are the only things on the page a reader came to click; the head joins
  the wayfinding layer with the blurb and the yard number. Not `$prose_muted` — that is the blurb's
  colour, and a head set in it is a caption.
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
- **The field bought the third face, and Chivo 900 is it.** Inter 700 was the incumbent and reads
  as a user interface — a screen face at a weight meant for labels. The candidates were rendered
  turned, at 48px, in the real grey on the real page, which is the only test that settles it: an
  NFL field numeral is heavy at roughly normal width (six feet by four), so **every condensed
  candidate went thin and stringy once turned** — Anton, Saira Condensed, Barlow Condensed, Oswald,
  Big Shoulders, Fjalla One — and Archivo Black went round. Chivo 900 is the one that reads as
  paint. **It now pays for itself in ONE place**, the yard numbers, since the end zone wordmark it
  also carried is gone. That is a thin margin for a third face and it is worth saying out loud
  rather than leaving to be discovered: if the yard numbers ever go, the face goes with them.

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

| Weight            | Where                                                    | Says                        |
| ----------------- | -------------------------------------------------------- | --------------------------- |
| 2px ink           | `prose_section_band(2px)`, and the last rule on the page | Masthead, and the goal line |
| 1px ink           | `prose_section_band()`                                   | A new section begins        |
| 1px `$prose_rule` | Between entries                                          | Two things of the same kind |

**The hash marks run down the RIGHT edge, outboard of the yard numbers**, hung in the page's own
gutter (`-32px`, `-22px` on a phone) out past the right end of the rules and past the number's
band. The number and the ticks belong to the same sideline: a field numeral is painted to be read
from the sideline nearest it, so a row now reads prose, turned numeral, hashes, which is the order
that sideline puts them in. Split across opposite margins they were two marks facing nothing. The
gutter is the only place the row can sit: inside the measure the left edge is the most spoken-for
column on the page — lede, section heads and entry labels all stand on it — and the right edge is
the numeral's. Two tick lengths on one pseudo-element, the short mark at every yard and the long
one where a five-yard line would fall, so the row reads in fives rather than as a comb; the long
one is anchored to the strip's inner edge and grows away from the measure. These are still not the
ticks that were removed from the bar: those ran ALONG a band rule and decorated it, and these run
down the field between the rules and cross none of them.

**The right band is the numeral and its clearance and nothing else** — 56px, 38px on a phone, being
48px and 30px of turned numeral plus the 8px before the prose. The hash row shares the SIDE but not
the band, because it hangs in the gutter past it. Build a band from its parts rather than guessing:
guessed at the number's own width, back when the hash row was inside the band, the phone's widest
description reached the strip's left edge exactly — a collision one glyph away.

**Every rule runs the full measure, including behind the yard numbers.** The number band is a
`padding-right` on `.landing__section` — 56px, 38px on a phone — and a border spans the padding
box, so the rules keep their length while every row of content stops short of the number. A yard
line running behind a number is what a field does; a rule that stopped at one would read as a
column break. The band is on the SECTION and not on the head row: a turned numeral is taller than
the head, and reserved on the head alone it hung into the first entry and sat on the last word of a
description.

**A page is bracketed by the heavy weight top and bottom.** The 2px rule that opens the first
section closes the last one too, so a reader reaching the end sees the directory finish rather than
run out.

**On the landing page that closing rule is the second goal line, and below it is a real end zone.**
It has two boundaries at the goal line's own weight — the rule above and an end line below — because
a zone with only one of them is an edge with space under it. Its sidelines are where the paint
stops: the figure runs to the measure's edges and ends, closing it left and right without two more
rules. **The zone sets its own depth** (140px, 84px on a phone) because nothing in flow gives it one
any more — it used to inherit whatever a line of the wordmark happened to be.

**What is painted in the zone is a projected distribution**, in `end-zone-figure.js`: a sample as
bars, the log-normal density it was drawn from as a curve over them, and the middle eighty per cent
as a capped interval above that. This is the one place the page says what KIND of site it is rather
than what is on it — the directory above names fourteen destinations and not one of them can say "we
model this". **The end line is its axis**; the bars stand on the 2px rule that already closes the
page, which is the whole argument for putting the figure here and not somewhere else.

**Three marks, three claims, and that is why there are three.** The bars say there is data, the
curve says it is fitted rather than plotted, and the interval says the answer is a range rather than
a number. A histogram alone said only the first, which is what it was before.

What it must keep doing, each learned by getting it wrong on the rendered page:

- **The sample MISSES the curve, and the miss is square-root scaled.** Bar tops sitting exactly on
  the curve make the curve an outline of the bars — one mark drawn twice. Counting noise goes as the
  square root of the count, so a tall bin deviates more absolutely and less relatively; flat jitter
  makes the tail as ragged as the peak, which is what added noise looks like next to sampled noise.
- **The bars are most of the pitch, not a fifth of it.** Thin bars with air between them read as a
  comb or a waveform. Bins abut; the gap is relief and nothing more.
- **The tail decays rather than flooring, and it reaches the far sideline.** A minimum bar height
  set above where the density lands clamps the last third to one value and the tail becomes a
  baseline. A distribution too tight for the band leaves its right third empty, which reads as a
  figure that ran out — the parameters are chosen so the ninetieth percentile lands at four fifths
  of the width.
- **The skew is the point.** A symmetrical bell is the same gesture with the interesting half sanded
  off, and the right tail is the shape a week of fantasy scoring actually takes.
- **Every stroked mark carries `vector-effect="non-scaling-stroke"`.** The svg is stretched with
  `preserveAspectRatio="none"`, so without it a hairline comes out thicker where it runs flat than
  where it runs steep.

**A hatch, then a fine lattice, then a row of diamonds were all here first.** What killed the first
two is worth keeping: at any pitch small enough to tile, a pattern reads as SHADING over the zone
rather than as a marking on it. Whatever goes here has to be made of shapes big enough to be
counted.

**The site's name was painted across this band and is not any more.** It was the obvious thing to
put in an end zone, and it was the second time the page said it — the masthead carries the same
wordmark four screens up, so it repeated rather than added, it sat over the figure, and removing it
is what let the figure use the full depth. This is still not a footer: a footer of links here would
repeat the directory it is closing. The band is `aria-hidden` because it is a shape and not a chart —
there is no series behind it and nothing to read off it.

This is not the border that was tried and removed. That one enclosed the whole page and read as a
container; this bounds the one band on the page with no content in it, which is what a boundary is
for.

The header does **not** carry its own rule. Giving it one puts two parallel rules sixty pixels
apart with nothing between them, which reads as a mistake rather than as two levels of break.

## The Mark

`app/views/pages/landing/route-diagram.js` — the two football routes from `static/images/icon.png`,
redrawn at the icon's own 512×512 coordinates so the two read as one object. Nothing added, nothing
stylised.

It **hangs in the left margin** above 1400px at 104px, and sits above the header text below that.
The text never moves for it: the lede shares its left edge with every section head and every entry
label, and the header is the worst place to lose that alignment.

That breakpoint is set by the **nav drawer**, not by the page gutter. The obvious arithmetic (880px
measure, so the gutter is `(viewport - 880) / 2`) answers the wrong question — the mark hangs into
the column the drawer already occupies, and overlapped it by 24px at 1280px.

**Moving it into the flow was tried and reverted.** It came about honestly: with a hairline frame
around the page there was no margin left to hang in, and the hanging mark sat 8px off the new
sideline. The frame is gone and the premise with it. What that detour is worth keeping for is the
measurement — stacked at 104px the mark pushes the eyebrow 293px down a 1280x900 laptop, which is
the cost of the below-1400px layout and the thing to check before making the stacked range wider.

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
- **No boxes or cards on a prose page**, and **that includes one box around everything.** A band
  with a rule above and below it is not that object — the end zone has two boundaries and no
  verticals, and what it encloses is the only part of the page carrying no content. A
  directory drawn as a grid of cards becomes a marketing page the moment there are three of them,
  and a hairline rectangle around the whole page is the same object drawn once — it was tried on
  the landing page, argued for as a sideline rather than a container, and read as a container
  anyway. The argument to distrust is the one that says a rectangle is not a box because of what it
  is called.
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
- **`document.fonts.check()` returns TRUE for a font that does not exist.** It answers "can the
  browser render this text with this font stack", and a stack always resolves to something — so
  `check('900 48px NotARealFace')` is `true`, measured. A webfont that failed to load is the
  silent-fauxing failure the `index.html` font comment describes, and the one API that looks built
  to detect it cannot. Measure the rendered WIDTH of the same string in the candidate face and in
  the fallback and require them to DIFFER, with a bogus family as the control that must match the
  fallback exactly.
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
  site. **The corollary is that a group of segments cannot be MAPPED**: with no wrapper allowed there
  is nowhere to hang a React `key` but the `Button` itself, and
  `test/app.connected-component-props.spec.mjs` fails a `Button` handed any prop it does not declare,
  `key` included. Write the segments out as separate children, which need no keys at all.
- **Two font sizes centred on each other do not share a baseline.** `align-items: center` aligns
  BOXES, so a smaller neighbour — a `$` before an amount, a unit after one, a caption beside a value
  — sits high by half the difference in the two ascents. That is around 1px at the sizes this app
  uses: invisible in the source, invisible in a computed-style dump because every value is exactly
  what was asked for, and plain in a screenshot as a glyph floating off the text. Nudging the small
  one down is the wrong repair — the offset is a function of two font sizes and the line box they
  share, so it is wrong again when any of the three moves, which is the same argument the rail's
  `align-items: baseline` note makes. Declare ONE `font-size` and ONE `line-height` on the parent
  and let both children inherit; a prefix recedes on weight and colour, which cost no geometry. The
  same applies to a `::placeholder` sized differently from the value it becomes: the text then
  changes size and position on the first keystroke.

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
6. **When the state you changed is unreachable in a browser, build the element a page of its own.**
   Some surfaces need a state a dev server cannot be walked into — an auction control that renders
   only while your team is on the clock in election mode, an error banner behind a failing import.
   Skipping the screenshot there is how a 1px defect ships. A static HTML file loading
   `app/styles/normalize.css`, the font links from `app/index.html`, and the component's compiled
   `.styl` reproduces the box faithfully, because everything that positions it is CSS plus inherited
   font metrics; drive it with `playwright-core` against the installed Chrome (no browser download)
   and screenshot at `deviceScaleFactor: 6`, where a sub-pixel misalignment is plainly visible. Say
   which half you checked: this proves the CSS, not the component's props or its place in the bar.

`yarn dev:live` per `user:guideline/software/develop-league.md`, and note a sibling session may
already have a dev server up — check before starting your own.
