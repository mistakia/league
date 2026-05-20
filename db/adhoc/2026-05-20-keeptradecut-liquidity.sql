CREATE TABLE public.keeptradecut_liquidity (
  pid varchar(25) NOT NULL,
  superflex boolean NOT NULL,
  d integer NOT NULL,
  raw_liquidity numeric NOT NULL,
  std_liquidity numeric NOT NULL,
  trade_count integer NOT NULL,
  CONSTRAINT keeptradecut_liquidity_pkey PRIMARY KEY (pid, superflex, d)
);
CREATE INDEX idx_keeptradecut_liquidity_d_superflex
  ON public.keeptradecut_liquidity (d, superflex);
GRANT SELECT ON TABLE public.keeptradecut_liquidity TO league_readonly;
