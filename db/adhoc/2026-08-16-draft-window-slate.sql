-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Redesign the rookie draft's pick windows as a published daily slate.
--
-- The calculator stops re-anchoring on every selection and instead publishes a
-- schedule once a day, at the daily band's close, frozen until the next
-- publication. Two schema consequences follow, plus the 2026 config election.
--
-- 1. seasons.rookie_draft_end_at replaces the projection getDraftDates used to
--    derive from the cadence.
--
--    The old end was window(total_picks + 1) quantized to the end of its day.
--    Under the slate that expression is a function of the CURRENT publication,
--    so a derived end would move every midnight -- unstable, not merely
--    awkward. The hard end is an announced fact about a league's calendar and
--    now reads as one.
--
--    Nullable because 116 of the 122 seasons rows describe a season with no
--    draft configured at all. The real invariant is conditional, so it is a
--    CHECK rather than a NOT NULL: a row that has a draft_start has a hard end.
--
--    For league 1 / 2026 this REPAIRS a live divergence rather than
--    introducing one. Executing the current getDraftDates against that row's
--    config puts draftEnd at Wed 2026-09-02 23:59 ET and waiverEnd at
--    Thu 2026-09-03, while the league was told Mon 2026-08-31 -- so the code
--    has been enforcing an end two days later than the announcement, sitting on
--    the Sep 2 free-agency period start. Setting the column to Aug 31 moves the
--    enforced end EARLIER by two days and waiverEnd from Sep 3 to Sep 1.
--
-- 2. The ORDER of the three statements below is forced by the constraint.
--
--    A plain ADD CONSTRAINT validates every existing row, and all six rows that
--    carry a draft_start hold a NULL rookie_draft_end_at until the backfill
--    lands -- so adding the CHECK before the backfill aborts the whole
--    transaction. Verified 2026-08-16 on a scratch database against the live
--    row shape.
--
-- 3. The 2026 election, and the day-cadence rows the calculator no longer reads
--    a mode flag for.
--
--    league 1 / 2026 goes to a 3-hour interval on an 11:00-24:00 Eastern band:
--    five slots a day (11, 14, 17, 20, 23), the last of them 8:00 PM Pacific so
--    the coast fairness the 4-hour election was built around holds, and a
--    publication boundary on midnight Eastern, which is the constitution's own
--    default.
--
--    The calculator now takes hours unconditionally, so the four draft_type =
--    'day' rows move to draft_pick_interval = 24 on their existing [0, 24)
--    band and keep computing correctly. draft_type is NOT dropped here: two SPA
--    predicates still branch on it (app/core/selectors.js:421 and :582), and
--    dropping it silently takes every window label with it. That is deferred to
--    user:task/league/retire-draft-type-and-conform-draft-window-naming.md,
--    which must update both predicates in the same change.

alter table seasons add column rookie_draft_end_at timestamptz;

comment on column seasons.rookie_draft_end_at is
  'Hard cutoff for the rookie draft. The draft route refuses a selection past it and every pick still unmade is forfeited to practice-squad waivers. Announced rather than derived: under the published-slate rule a projected end would move at every publication boundary.';

-- Backfill BEFORE the CHECK. A completed draft ended when it completed; the one
-- live draft takes its announced hard end.
update seasons
   set rookie_draft_end_at = rookie_draft_completed_at
 where draft_start is not null
   and rookie_draft_completed_at is not null;

update seasons
   set rookie_draft_end_at = timestamptz '2026-08-31 23:59:59 America/New_York'
 where lid = 1
   and season_year = 2026;

alter table seasons
  add constraint seasons_rookie_draft_end_at_set_with_start
  check (draft_start is null or rookie_draft_end_at is not null);

-- The 2026 election.
update seasons
   set draft_pick_interval = 3,
       draft_hour_max = 24
 where lid = 1
   and season_year = 2026;

-- One day-cadence step is 24 hours of the calculator's only unit.
update seasons
   set draft_pick_interval = 24
 where draft_type = 'day';
