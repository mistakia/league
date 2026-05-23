-- Creates the historical_injury_index parent table and per-year
-- partitions for 2009-2025. Populated by
-- scripts/generate-historical-injury-index.mjs (Phase C2).
--
-- Partitioning strategy: RANGE on year. Per-year partitions let the
-- processor rebuild a single season cheaply (DROP partition + recreate
-- + INSERT) and let consumers prune by year cleanly.
--
-- Primary key: (pid, year, week, esbid). year is in the PK because
-- Postgres requires the partition key to appear in every uniqueness
-- constraint on a partitioned table.
--
-- Revert:
--   DROP TABLE historical_injury_index CASCADE;

CREATE TABLE historical_injury_index (
  pid                            varchar(25) NOT NULL,
  year                           smallint    NOT NULL,
  week                           smallint    NOT NULL,
  esbid                          integer     NOT NULL,
  tm                             varchar(3),

  played                         boolean,
  snap_count                     integer,
  snaps_off                      smallint,
  snaps_def                      smallint,
  snaps_st                       smallint,

  gamelog_active                 boolean,
  ruled_out_in_game              boolean,
  practice_listed_injury         boolean,
  practice_questionable_or_worse boolean,
  practice_designation           varchar(16),
  changelog_injury_event         boolean,
  changelog_unavailable          boolean,
  changelog_nfl_reserve_event    boolean,

  missed_reason                  varchar(24),
  source_concurrence             smallint,
  confidence                     varchar(8),

  inserted_at                    integer NOT NULL,
  updated_at                     integer NOT NULL,

  PRIMARY KEY (pid, year, week, esbid)
)
PARTITION BY RANGE (year);

-- Per-year partitions, 2009 through 2025 inclusive. Upper bound on a
-- RANGE partition is exclusive, so each partition covers exactly its
-- year value.
CREATE TABLE historical_injury_index_2009 PARTITION OF historical_injury_index FOR VALUES FROM (2009) TO (2010);
CREATE TABLE historical_injury_index_2010 PARTITION OF historical_injury_index FOR VALUES FROM (2010) TO (2011);
CREATE TABLE historical_injury_index_2011 PARTITION OF historical_injury_index FOR VALUES FROM (2011) TO (2012);
CREATE TABLE historical_injury_index_2012 PARTITION OF historical_injury_index FOR VALUES FROM (2012) TO (2013);
CREATE TABLE historical_injury_index_2013 PARTITION OF historical_injury_index FOR VALUES FROM (2013) TO (2014);
CREATE TABLE historical_injury_index_2014 PARTITION OF historical_injury_index FOR VALUES FROM (2014) TO (2015);
CREATE TABLE historical_injury_index_2015 PARTITION OF historical_injury_index FOR VALUES FROM (2015) TO (2016);
CREATE TABLE historical_injury_index_2016 PARTITION OF historical_injury_index FOR VALUES FROM (2016) TO (2017);
CREATE TABLE historical_injury_index_2017 PARTITION OF historical_injury_index FOR VALUES FROM (2017) TO (2018);
CREATE TABLE historical_injury_index_2018 PARTITION OF historical_injury_index FOR VALUES FROM (2018) TO (2019);
CREATE TABLE historical_injury_index_2019 PARTITION OF historical_injury_index FOR VALUES FROM (2019) TO (2020);
CREATE TABLE historical_injury_index_2020 PARTITION OF historical_injury_index FOR VALUES FROM (2020) TO (2021);
CREATE TABLE historical_injury_index_2021 PARTITION OF historical_injury_index FOR VALUES FROM (2021) TO (2022);
CREATE TABLE historical_injury_index_2022 PARTITION OF historical_injury_index FOR VALUES FROM (2022) TO (2023);
CREATE TABLE historical_injury_index_2023 PARTITION OF historical_injury_index FOR VALUES FROM (2023) TO (2024);
CREATE TABLE historical_injury_index_2024 PARTITION OF historical_injury_index FOR VALUES FROM (2024) TO (2025);
CREATE TABLE historical_injury_index_2025 PARTITION OF historical_injury_index FOR VALUES FROM (2025) TO (2026);

-- Secondary indexes on the parent table propagate to every partition.
-- (year, week) for the dominant analyst-query shape (all weeks of a season).
-- (pid, year) for per-player career-trajectory queries.
CREATE INDEX idx_historical_injury_index_year_week ON historical_injury_index (year, week);
CREATE INDEX idx_historical_injury_index_pid_year ON historical_injury_index (pid, year);
