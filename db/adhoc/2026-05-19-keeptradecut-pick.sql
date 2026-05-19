CREATE TABLE public.keeptradecut_pick (
  pid varchar(25) PRIMARY KEY,
  ktc_player_id integer NOT NULL UNIQUE,
  ktc_player_name text NOT NULL,
  year smallint NOT NULL,
  round smallint NOT NULL,
  slot smallint NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  CONSTRAINT keeptradecut_pick_slot_chk CHECK (slot BETWEEN 1 AND 3),
  CONSTRAINT keeptradecut_pick_round_chk CHECK (round BETWEEN 1 AND 4)
);
CREATE INDEX idx_keeptradecut_pick_yrs ON public.keeptradecut_pick (year, round, slot);
GRANT SELECT ON TABLE public.keeptradecut_pick TO league_readonly;
