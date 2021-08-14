SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------

--
-- Table structure for table `block`
--

DROP TABLE IF EXISTS `block`;

CREATE TABLE `block` (
  `pid` int(7) NOT NULL,
  `blk` varchar(7) NOT NULL,
  `brcv` varchar(7) DEFAULT NULL,
  `type` varchar(4) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='Blocked Punts, Field Goal Attempts, etc.';

-- --------------------------------------------------------

--
-- Table structure for table `chart`
--

DROP TABLE IF EXISTS `chart`;

CREATE TABLE `chart` (
  `gid` int(5) NOT NULL,
  `pid` int(7) NOT NULL,
  `detail` text NOT NULL,
  `off` varchar(3) NOT NULL,
  `def` varchar(3) NOT NULL,
  `type` varchar(4) NOT NULL,
  `psr` varchar(7) NOT NULL,
  `trg` varchar(7) DEFAULT NULL,
  `bc` varchar(7) DEFAULT NULL,
  `qtr` tinyint(1) NOT NULL,
  `los` varchar(6) NOT NULL,
  `dwn` tinyint(1) NOT NULL,
  `ytg` tinyint(2) NOT NULL,
  `yfog` tinyint(2) NOT NULL,
  `zone` tinyint(1) NOT NULL,
  `yds` varchar(3) DEFAULT NULL,
  `succ` tinyint(1) NOT NULL,
  `fd` tinyint(1) NOT NULL,
  `sg` tinyint(1) NOT NULL,
  `nh` tinyint(1) NOT NULL,
  `comp` tinyint(1) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `back` tinyint(1) NOT NULL,
  `xlm` tinyint(1) NOT NULL,
  `hash` varchar(1) DEFAULT NULL,
  `mot` varchar(2) DEFAULT NULL,
  `db` tinyint(1) NOT NULL,
  `box` tinyint(2) NOT NULL,
  `boxdb` tinyint(1) NOT NULL,
  `pap` tinyint(1) NOT NULL,
  `option` varchar(3) DEFAULT NULL,
  `tlook` tinyint(1) NOT NULL,
  `trick` tinyint(1) NOT NULL,
  `qbp` tinyint(1) NOT NULL,
  `qbhi` tinyint(1) NOT NULL,
  `qbhu` tinyint(1) NOT NULL,
  `qbru` tinyint(1) NOT NULL,
  `sneak` tinyint(1) NOT NULL,
  `scrm` tinyint(1) NOT NULL,
  `ttscrm` decimal(3,1) NOT NULL,
  `htm` tinyint(1) NOT NULL,
  `pru` tinyint(1) NOT NULL,
  `spru` tinyint(1) DEFAULT NULL,
  `blz` tinyint(1) NOT NULL,
  `dblz` tinyint(1) NOT NULL,
  `zblz` tinyint(1) NOT NULL,
  `stnt` tinyint(1) NOT NULL,
  `oop` tinyint(1) NOT NULL,
  `oopd` varchar(2) NOT NULL,
  `avt` tinyint(1) DEFAULT NULL,
  `dotr` tinyint(1) DEFAULT NULL,
  `cov` tinyint(1) NOT NULL,
  `phyb` tinyint(1) NOT NULL,
  `cnb` tinyint(1) NOT NULL,
  `cball` tinyint(1) NOT NULL,
  `qbta` tinyint(1) NOT NULL,
  `shov` tinyint(1) NOT NULL,
  `side` tinyint(1) NOT NULL,
  `high` tinyint(1) NOT NULL,
  `crr` tinyint(1) NOT NULL,
  `intw` tinyint(1) NOT NULL,
  `drp` tinyint(1) NOT NULL,
  `bap` tinyint(1) NOT NULL,
  `avsk` tinyint(1) NOT NULL,
  `fread` tinyint(1) NOT NULL,
  `scre` tinyint(1) NOT NULL,
  `pfp` tinyint(1) NOT NULL,
  `mbt` tinyint(1) NOT NULL,
  `ttp` decimal(3,1) NOT NULL,
  `ttsk` decimal(3,1) NOT NULL,
  `qbsk` tinyint(1) NOT NULL,
  `ttpr` decimal(3,1) NOT NULL,
  `tay` decimal(3,1) NOT NULL,
  `dot` int(3) NOT NULL,
  `yac` int(3) NOT NULL,
  `fcon_bl` varchar(1) DEFAULT NULL,
  `fcon_tck` varchar(1) DEFAULT NULL,
  `yaco` int(3) NOT NULL,
  `ytru` int(3) NOT NULL,
  `covdis1` decimal(3,1) DEFAULT NULL,
  `covdis2` decimal(3,1) DEFAULT NULL,
  `defpr1` varchar(7) DEFAULT NULL,
  `defpr2` varchar(7) DEFAULT NULL,
  `defhi` varchar(7) DEFAULT NULL,
  `defhu1` varchar(7) DEFAULT NULL,
  `defhu2` varchar(7) DEFAULT NULL,
  `rb` tinyint(1) NOT NULL,
  `te` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `conv`
--

DROP TABLE IF EXISTS `conv`;

CREATE TABLE `conv` (
  `pid` int(7) NOT NULL,
  `type` varchar(4) NOT NULL,
  `bc` varchar(7) DEFAULT NULL,
  `psr` varchar(7) DEFAULT NULL,
  `trg` varchar(7) DEFAULT NULL,
  `conv` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='2 Point Conversion Attempts (Y=Success, N=Fail)';

-- --------------------------------------------------------

--
-- Table structure for table `defense`
--

DROP TABLE IF EXISTS `defense`;

CREATE TABLE `defense` (
  `uid` int(6) NOT NULL,
  `gid` int(5) NOT NULL,
  `player` varchar(7) NOT NULL,
  `solo` decimal(3,1) NOT NULL,
  `comb` decimal(3,1) NOT NULL,
  `sck` decimal(2,1) NOT NULL,
  `saf` tinyint(1) NOT NULL,
  `blk` tinyint(1) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `pdef` tinyint(1) NOT NULL,
  `frcv` tinyint(1) NOT NULL,
  `forc` tinyint(1) NOT NULL,
  `tdd` tinyint(1) NOT NULL,
  `rety` int(3) NOT NULL,
  `tdret` tinyint(1) NOT NULL,
  `peny` tinyint(2) NOT NULL,
  `snp` tinyint(2) NOT NULL,
  `fp` decimal(4,2) NOT NULL,
  `fp2` decimal(4,2) NOT NULL,
  `game` tinyint(2) NOT NULL,
  `seas` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `team` varchar(3) NOT NULL,
  `posd` varchar(8) NOT NULL,
  `jnum` tinyint(2) NOT NULL,
  `dcp` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `drive`
--

DROP TABLE IF EXISTS `drive`;

CREATE TABLE `drive` (
  `uid` int(6) NOT NULL,
  `gid` int(7) NOT NULL,
  `fpid` int(7) NOT NULL,
  `tname` varchar(3) NOT NULL,
  `drvn` tinyint(2) NOT NULL,
  `obt` varchar(4) DEFAULT NULL,
  `qtr` tinyint(1) NOT NULL,
  `min` tinyint(2) NOT NULL,
  `sec` tinyint(2) NOT NULL,
  `yfog` tinyint(2) NOT NULL,
  `plays` tinyint(2) NOT NULL,
  `succ` tinyint(2) NOT NULL,
  `rfd` tinyint(2) NOT NULL,
  `pfd` tinyint(2) NOT NULL,
  `ofd` tinyint(2) NOT NULL,
  `ry` int(3) NOT NULL,
  `ra` tinyint(2) NOT NULL,
  `py` int(3) NOT NULL,
  `pa` tinyint(2) NOT NULL,
  `pc` tinyint(2) NOT NULL,
  `peyf` tinyint(2) NOT NULL,
  `peya` tinyint(2) NOT NULL,
  `net` int(3) NOT NULL,
  `res` varchar(4) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `fgxp`
--

DROP TABLE IF EXISTS `fgxp`;

CREATE TABLE `fgxp` (
  `pid` int(7) NOT NULL,
  `fgxp` varchar(2) NOT NULL,
  `fkicker` varchar(7) NOT NULL,
  `dist` tinyint(2) NOT NULL,
  `good` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `fumble`
--

DROP TABLE IF EXISTS `fumble`;

CREATE TABLE `fumble` (
  `pid` int(7) NOT NULL,
  `fum` varchar(7) NOT NULL,
  `frcv` varchar(7) DEFAULT NULL,
  `fry` int(3) NOT NULL,
  `forc` varchar(7) DEFAULT NULL,
  `fuml` varchar(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `game`
--

DROP TABLE IF EXISTS `game`;

CREATE TABLE `game` (
  `gid` int(5) NOT NULL,
  `seas` int(4) NOT NULL,
  `wk` tinyint(2) NOT NULL,
  `day` varchar(3) NOT NULL,
  `v` varchar(3) NOT NULL,
  `h` varchar(3) NOT NULL,
  `stad` varchar(45) NOT NULL,
  `temp` varchar(4) DEFAULT NULL,
  `humd` varchar(4) DEFAULT NULL,
  `wspd` varchar(4) DEFAULT NULL,
  `wdir` varchar(4) DEFAULT NULL,
  `cond` varchar(15) DEFAULT NULL,
  `surf` varchar(30) NOT NULL,
  `ou` decimal(3,1) NOT NULL,
  `sprv` decimal(3,1) NOT NULL,
  `ptsv` tinyint(2) NOT NULL,
  `ptsh` tinyint(2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `injury`
--

DROP TABLE IF EXISTS `injury`;

CREATE TABLE `injury` (
  `uid` int(6) NOT NULL,
  `gid` int(7) NOT NULL,
  `player` varchar(7) NOT NULL,
  `team` varchar(3) NOT NULL,
  `details` varchar(35) DEFAULT NULL,
  `pstat` varchar(35) DEFAULT NULL,
  `gstat` varchar(15) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='Player injury status from official league reports';

-- --------------------------------------------------------

--
-- Table structure for table `intercpt`
--

DROP TABLE IF EXISTS `intercpt`;

CREATE TABLE `intercpt` (
  `pid` int(7) NOT NULL,
  `psr` varchar(7) NOT NULL,
  `ints` varchar(7) NOT NULL,
  `iry` tinyint(3) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='Interceptions';

-- --------------------------------------------------------

--
-- Table structure for table `kicker`
--

DROP TABLE IF EXISTS `kicker`;

CREATE TABLE `kicker` (
  `uid` int(6) NOT NULL,
  `gid` int(5) NOT NULL,
  `player` varchar(7) NOT NULL,
  `pat` tinyint(1) NOT NULL,
  `fgs` tinyint(1) NOT NULL,
  `fgm` tinyint(1) NOT NULL,
  `fgl` tinyint(1) NOT NULL,
  `fp` decimal(3,1) NOT NULL,
  `game` tinyint(2) NOT NULL,
  `seas` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `team` varchar(3) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='FGS: 0 - 39 yds; FGM: 40 - 49 yds; FGL: 50+ yds';

-- --------------------------------------------------------

--
-- Table structure for table `koff`
--

DROP TABLE IF EXISTS `koff`;

CREATE TABLE `koff` (
  `pid` int(7) NOT NULL,
  `kicker` varchar(7) NOT NULL,
  `kgro` tinyint(2) NOT NULL,
  `knet` tinyint(2) NOT NULL,
  `ktb` tinyint(1) NOT NULL,
  `kr` varchar(7) DEFAULT NULL,
  `kry` tinyint(3) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `offense`
--

DROP TABLE IF EXISTS `offense`;

CREATE TABLE `offense` (
  `uid` int(6) NOT NULL,
  `gid` int(5) NOT NULL,
  `player` varchar(7) NOT NULL,
  `pa` tinyint(2) NOT NULL,
  `pc` tinyint(2) NOT NULL,
  `py` int(3) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `tdp` tinyint(1) NOT NULL,
  `ra` tinyint(2) NOT NULL,
  `sra` tinyint(2) NOT NULL,
  `ry` int(3) NOT NULL,
  `tdr` tinyint(1) NOT NULL,
  `trg` tinyint(2) NOT NULL,
  `rec` tinyint(2) NOT NULL,
  `recy` int(3) NOT NULL,
  `tdrec` tinyint(1) NOT NULL,
  `ret` tinyint(2) NOT NULL,
  `rety` int(3) NOT NULL,
  `tdret` tinyint(1) NOT NULL,
  `fuml` tinyint(1) NOT NULL,
  `peny` tinyint(2) NOT NULL,
  `conv` tinyint(1) NOT NULL,
  `snp` tinyint(2) NOT NULL,
  `fp` decimal(4,2) NOT NULL,
  `fp2` decimal(4,2) NOT NULL,
  `fp3` decimal(4,2) NOT NULL,
  `game` tinyint(2) NOT NULL,
  `seas` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `team` varchar(3) NOT NULL,
  `posd` varchar(8) NOT NULL,
  `jnum` tinyint(2) NOT NULL,
  `dcp` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `pass`
--

DROP TABLE IF EXISTS `pass`;

CREATE TABLE `pass` (
  `pid` int(7) NOT NULL,
  `psr` varchar(7) NOT NULL,
  `trg` varchar(7) DEFAULT NULL,
  `loc` varchar(2) NOT NULL,
  `yds` tinyint(3) NOT NULL,
  `comp` tinyint(1) NOT NULL,
  `succ` tinyint(1) NOT NULL,
  `spk` tinyint(1) NOT NULL,
  `dfb` varchar(7) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

-- --------------------------------------------------------

--
-- Table structure for table `penalty`
--

DROP TABLE IF EXISTS `penalty`;

CREATE TABLE `penalty` (
  `uid` int(6) NOT NULL,
  `pid` int(7) NOT NULL,
  `ptm` varchar(3) NOT NULL,
  `pen` varchar(7) DEFAULT NULL,
  `desc` varchar(40) NOT NULL,
  `cat` tinyint(1) NOT NULL,
  `pey` tinyint(2) NOT NULL,
  `act` varchar(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `play`
--

DROP TABLE IF EXISTS `play`;

CREATE TABLE `play` (
  `gid` int(5) NOT NULL,
  `pid` int(7) NOT NULL,
  `off` varchar(3) NOT NULL,
  `def` varchar(3) NOT NULL,
  `type` varchar(4) NOT NULL,
  `dseq` tinyint(2) NOT NULL,
  `len` tinyint(2) NOT NULL,
  `qtr` tinyint(1) NOT NULL,
  `min` tinyint(2) NOT NULL,
  `sec` tinyint(2) NOT NULL,
  `ptso` tinyint(2) NOT NULL,
  `ptsd` tinyint(2) NOT NULL,
  `timo` tinyint(2) NOT NULL,
  `timd` tinyint(2) NOT NULL,
  `dwn` tinyint(1) NOT NULL,
  `ytg` tinyint(2) NOT NULL,
  `yfog` tinyint(2) NOT NULL,
  `zone` tinyint(1) NOT NULL,
  `fd` tinyint(1) NOT NULL,
  `sg` tinyint(1) NOT NULL,
  `nh` tinyint(1) NOT NULL,
  `pts` tinyint(1) NOT NULL,
  `tck` tinyint(1) NOT NULL,
  `sk` tinyint(1) NOT NULL,
  `pen` tinyint(1) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `fum` tinyint(1) NOT NULL,
  `saf` tinyint(1) NOT NULL,
  `blk` tinyint(1) NOT NULL,
  `eps` decimal(3,2) NOT NULL,
  `epa` decimal(4,2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `player`
--

DROP TABLE IF EXISTS `player`;

CREATE TABLE `player` (
  `player` varchar(7) NOT NULL,
  `fname` varchar(20) NOT NULL,
  `lname` varchar(25) NOT NULL,
  `pname` varchar(25) NOT NULL,
  `pos` varchar(3) NOT NULL,
  `pos1` varchar(3) NOT NULL,
  `pos2` varchar(2) DEFAULT NULL,
  `height` tinyint(2) NOT NULL,
  `weight` int(3) NOT NULL,
  `dob` varchar(10) DEFAULT NULL,
  `forty` decimal(3,2) DEFAULT NULL,
  `bench` tinyint(2) DEFAULT NULL,
  `vertical` decimal(3,1) DEFAULT NULL,
  `broad` int(3) DEFAULT NULL,
  `shuttle` decimal(3,2) DEFAULT NULL,
  `cone` decimal(3,2) DEFAULT NULL,
  `arm` decimal(5,3) DEFAULT NULL,
  `hand` decimal(5,3) DEFAULT NULL,
  `dpos` int(3) NOT NULL,
  `col` varchar(35) NOT NULL,
  `dv` varchar(35) DEFAULT NULL,
  `start` int(4) NOT NULL,
  `cteam` varchar(3) NOT NULL,
  `posd` varchar(8) NOT NULL,
  `jnum` tinyint(2) NOT NULL,
  `dcp` tinyint(1) NOT NULL,
  `nflid` int(10) NOT NULL,
  `esbid` varchar(10) DEFAULT NULL,
  `gsisid` varchar(15) DEFAULT NULL,
  `gsispid` varchar(36) DEFAULT NULL,

  `status` varchar(255) DEFAULT NULL,
  `high_school` varchar(255) DEFAULT NULL,

  `sleeper_id` varchar(11) DEFAULT NULL,
  `rotoworld_id` int(11) DEFAULT NULL,
  `rotowire_id` varchar(11) DEFAULT NULL,
  `sportradar_id` varchar(36) DEFAULT NULL,
  `espn_id` int(11) DEFAULT NULL,
  `fantasy_data_id` int(11) DEFAULT NULL,
  `yahoo_id` int(11) DEFAULT NULL,
  FULLTEXT KEY `name` (`fname`,`lname`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `players`
--

DROP TABLE IF EXISTS `players`;

CREATE TABLE `players` (
  `player` varchar(7) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `team` varchar(5) NOT NULL,
  `pos` varchar(5) NOT NULL,
  `birth_country` varchar(255) DEFAULT NULL,
  `birth_city` varchar(255) DEFAULT NULL,
  `cbs_id` varchar(11) DEFAULT NULL,
  `espn_id` varchar(11) DEFAULT NULL,
  `fantasy_data_id` varchar(11) DEFAULT NULL,
  `fleaflicker_id` varchar(11) DEFAULT NULL,
  `gsis_id` varchar(13) DEFAULT NULL,
  `high_school` varchar(255) DEFAULT NULL,
  `nfl_id` varchar(255) DEFAULT NULL,
  `mfl_id` varchar(11) DEFAULT NULL,
  `rotoworld_id` varchar(11) DEFAULT NULL,
  `rotowire_id` varchar(11) DEFAULT NULL,
  `sleeper_id` varchar(11) DEFAULT NULL,
  `stats_id` varchar(11) DEFAULT NULL,
  `stats_global_id` varchar(11) DEFAULT NULL,
  `sportradar_id` varchar(36) DEFAULT NULL,
  `twitter_username` varchar(255) DEFAULT NULL,
  `yahoo_id` varchar(11) DEFAULT NULL,

  `active` tinyint(1) DEFAULT NULL,
  `depth_chart_order` varchar(255) DEFAULT NULL, -- TODO refine
  `depth_chart_position` varchar(255) DEFAULT NULL, -- TODO refine
  `details` varchar(255) DEFAULT NULL,
  `exp_return` varchar(255) DEFAULT NULL,
  `injury_body_part` varchar(255) DEFAULT NULL,
  `injury_start_date` varchar(255) DEFAULT NULL,
  `injury_status` varchar(255) DEFAULT NULL,
  `injury_notes` varchar(255) DEFAULT NULL,
  `practice_participation` varchar(255) DEFAULT NULL, -- TODO refine
  `practice_description` varchar(255) DEFAULT NULL, -- TODO refine
  `status` varchar(255) DEFAULT NULL,
  `search_rank` int(7) DEFAULT NULL,

  KEY `player` (`player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `players_status`
--

DROP TABLE IF EXISTS `players_status`;

CREATE TABLE `players_status` (
  `player` varchar(7) DEFAULT NULL,
  `mfl_id` varchar(11) DEFAULT NULL,
  `sleeper_id` varchar(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `depth_chart_order` varchar(255) DEFAULT NULL, -- TODO refine
  `depth_chart_position` varchar(255) DEFAULT NULL, -- TODO refine
  `details` varchar(255) DEFAULT NULL,
  `exp_return` varchar(255) DEFAULT NULL,
  `injury_body_part` varchar(255) DEFAULT NULL,
  `injury_start_date` varchar(255) DEFAULT NULL,
  `injury_status` varchar(255) DEFAULT NULL,
  `injury_notes` varchar(255) DEFAULT NULL,
  `practice_participation` varchar(255) DEFAULT NULL, -- TODO refine
  `practice_description` varchar(255) DEFAULT NULL, -- TODO refine
  `status` varchar(255) DEFAULT NULL,
  `search_rank` int(7) DEFAULT NULL,
  `timestamp` int(11) NOT NULL,
  KEY `player` (`player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `poaches`
--

DROP TABLE IF EXISTS `poaches`;

CREATE TABLE `poaches` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `player` varchar(7) NOT NULL,
  `userid` int(6) NOT NULL,
  `tid` int(5) NOT NULL,
  `lid` int(6) NOT NULL,
  `succ` tinyint(1) DEFAULT NULL,
  `submitted` int(11) NOT NULL,
  `reason` text DEFAULT NULL,
  `processed` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `poach_releases`
--

DROP TABLE IF EXISTS `poach_releases`;

CREATE TABLE `poach_releases` (
  `poachid` int(11) NOT NULL,
  `player` varchar(7) NOT NULL,
  KEY `poachid` (`poachid`),
  UNIQUE KEY `player` (`poachid`, `player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `punt`
--

DROP TABLE IF EXISTS `punt`;

CREATE TABLE `punt` (
  `pid` int(7) NOT NULL,
  `punter` varchar(7) NOT NULL,
  `pgro` tinyint(2) NOT NULL,
  `pnet` tinyint(2) NOT NULL,
  `ptb` tinyint(1) NOT NULL,
  `pr` varchar(7) DEFAULT NULL,
  `pry` tinyint(3) NOT NULL,
  `pfc` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `redzone`
--

DROP TABLE IF EXISTS `redzone`;

CREATE TABLE `redzone` (
  `uid` int(6) NOT NULL,
  `gid` int(5) NOT NULL,
  `player` varchar(7) NOT NULL,
  `pa` tinyint(2) NOT NULL,
  `pc` tinyint(2) NOT NULL,
  `py` int(3) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `ra` tinyint(2) NOT NULL,
  `sra` tinyint(2) NOT NULL,
  `ry` int(3) NOT NULL,
  `trg` tinyint(2) NOT NULL,
  `rec` tinyint(2) NOT NULL,
  `recy` int(3) NOT NULL,
  `fuml` tinyint(1) NOT NULL,
  `peny` tinyint(2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rush`
--

DROP TABLE IF EXISTS `rush`;

CREATE TABLE `rush` (
  `pid` int(7) NOT NULL,
  `bc` varchar(7) NOT NULL,
  `dir` varchar(2) NOT NULL,
  `yds` tinyint(3) NOT NULL,
  `succ` tinyint(1) NOT NULL,
  `kne` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `sack`
--

DROP TABLE IF EXISTS `sack`;

CREATE TABLE `sack` (
  `uid` int(6) NOT NULL,
  `pid` int(7) NOT NULL,
  `qb` varchar(7) NOT NULL,
  `sk` varchar(7) NOT NULL,
  `value` decimal(2,1) NOT NULL,
  `ydsl` int(3) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `safety`
--

DROP TABLE IF EXISTS `safety`;

CREATE TABLE `safety` (
  `pid` int(7) NOT NULL,
  `saf` varchar(7) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `seasons`
--

DROP TABLE IF EXISTS `seasons`;

CREATE TABLE `seasons` (
  `lid` int(11) NOT NULL,
  `year` int(4) NOT NULL,
  `fqb` mediumint(3) unsigned DEFAULT NULL, -- qb franchise tag amount
  `frb` mediumint(3) unsigned DEFAULT NULL, -- rb franchise tag amount
  `fwr` mediumint(3) unsigned DEFAULT NULL, -- wr franchise tag amount
  `fte` mediumint(3) unsigned DEFAULT NULL, -- te franchise tag amount
  `tran_date` int(11) unsigned DEFAULT NULL,
  `ext_date` int(11) unsigned DEFAULT NULL, -- extension deadline
  UNIQUE KEY `season` (`lid`,`year`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `schedule`
--

DROP TABLE IF EXISTS `schedule`;

CREATE TABLE `schedule` (
  `gid` int(5) NOT NULL,
  `seas` int(4) NOT NULL,
  `wk` tinyint(2) NOT NULL,
  `day` varchar(3) NOT NULL,
  `date` text NOT NULL,
  `v` varchar(3) NOT NULL,
  `h` varchar(3) NOT NULL,
  `stad` varchar(45) NOT NULL,
  `surf` varchar(30) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `snap`
--

DROP TABLE IF EXISTS `snap`;

CREATE TABLE `snap` (
  `uid` int(6) NOT NULL,
  `gid` int(5) NOT NULL,
  `tname` varchar(3) NOT NULL,
  `player` varchar(7) NOT NULL,
  `posd` varchar(8) NOT NULL,
  `poss` varchar(8) DEFAULT NULL,
  `snp` tinyint(2) NOT NULL,
  `percent` int(3) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='Play snaps for offense and defense';

-- --------------------------------------------------------

--
-- Table structure for table `tackle`
--

DROP TABLE IF EXISTS `tackle`;

CREATE TABLE `tackle` (
  `uid` int(7) NOT NULL,
  `pid` int(7) NOT NULL,
  `tck` varchar(7) NOT NULL,
  `value` decimal(2,1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='Special teams tackles are not counted (ie, kickoffs, punts)';

-- --------------------------------------------------------

--
-- Table structure for table `td`
--

DROP TABLE IF EXISTS `td`;

CREATE TABLE `td` (
  `pid` int(7) NOT NULL,
  `qtr` tinyint(1) NOT NULL,
  `min` tinyint(2) NOT NULL,
  `sec` tinyint(2) NOT NULL,
  `dwn` tinyint(1) NOT NULL,
  `yds` tinyint(3) NOT NULL,
  `pts` tinyint(2) NOT NULL,
  `player` varchar(7) DEFAULT NULL,
  `type` varchar(4) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `team`
--

DROP TABLE IF EXISTS `team`;

CREATE TABLE `team` (
  `tid` int(5) NOT NULL,
  `gid` int(5) NOT NULL,
  `tname` varchar(3) NOT NULL,
  `pts` tinyint(2) NOT NULL,
  `q1p` tinyint(2) NOT NULL,
  `q2p` tinyint(2) NOT NULL,
  `q3p` tinyint(2) NOT NULL,
  `q4p` tinyint(2) NOT NULL,
  `rfd` tinyint(2) NOT NULL,
  `pfd` tinyint(2) NOT NULL,
  `ifd` tinyint(2) NOT NULL,
  `ry` int(3) NOT NULL,
  `ra` tinyint(2) NOT NULL,
  `py` int(3) NOT NULL,
  `pa` tinyint(2) NOT NULL,
  `pc` tinyint(2) NOT NULL,
  `sk` tinyint(2) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `fum` tinyint(1) NOT NULL,
  `pu` tinyint(2) NOT NULL,
  `gpy` int(3) NOT NULL,
  `pr` tinyint(2) NOT NULL,
  `pry` int(3) NOT NULL,
  `kr` tinyint(2) NOT NULL,
  `kry` int(3) NOT NULL,
  `ir` tinyint(1) NOT NULL,
  `iry` int(3) NOT NULL,
  `pen` int(3) NOT NULL,
  `top` decimal(3,1) NOT NULL,
  `td` tinyint(1) NOT NULL,
  `tdr` tinyint(1) NOT NULL,
  `tdp` tinyint(1) NOT NULL,
  `tdt` tinyint(1) NOT NULL,
  `fgm` tinyint(1) NOT NULL,
  `fgat` tinyint(2) NOT NULL,
  `fgy` int(3) NOT NULL,
  `rza` tinyint(2) NOT NULL,
  `rzc` tinyint(1) NOT NULL,
  `bry` int(3) NOT NULL,
  `bpy` int(3) NOT NULL,
  `srp` tinyint(2) NOT NULL,
  `s1rp` tinyint(2) NOT NULL,
  `s2rp` tinyint(2) NOT NULL,
  `s3rp` tinyint(2) NOT NULL,
  `spp` tinyint(2) NOT NULL,
  `s1pp` tinyint(2) NOT NULL,
  `s2pp` tinyint(2) NOT NULL,
  `s3pp` tinyint(2) NOT NULL,
  `lea` tinyint(2) NOT NULL,
  `ley` int(3) NOT NULL,
  `lta` tinyint(2) NOT NULL,
  `lty` int(3) NOT NULL,
  `lga` tinyint(2) NOT NULL,
  `lgy` int(3) NOT NULL,
  `mda` tinyint(2) NOT NULL,
  `mdy` int(3) NOT NULL,
  `rga` tinyint(2) NOT NULL,
  `rgy` int(3) NOT NULL,
  `rta` tinyint(2) NOT NULL,
  `rty` int(3) NOT NULL,
  `rea` tinyint(2) NOT NULL,
  `rey` int(3) NOT NULL,
  `r1a` tinyint(2) NOT NULL,
  `r1y` int(3) NOT NULL,
  `r2a` tinyint(2) NOT NULL,
  `r2y` int(3) NOT NULL,
  `r3a` tinyint(2) NOT NULL,
  `r3y` int(3) NOT NULL,
  `qba` tinyint(2) NOT NULL,
  `qby` int(3) NOT NULL,
  `sla` tinyint(2) NOT NULL,
  `sly` int(3) NOT NULL,
  `sma` tinyint(2) NOT NULL,
  `smy` int(3) NOT NULL,
  `sra` tinyint(2) NOT NULL,
  `sry` int(3) NOT NULL,
  `dla` tinyint(2) NOT NULL,
  `dly` int(3) NOT NULL,
  `dma` tinyint(2) NOT NULL,
  `dmy` int(3) NOT NULL,
  `dra` tinyint(2) NOT NULL,
  `dry` int(3) NOT NULL,
  `wr1a` tinyint(2) NOT NULL,
  `wr1y` int(3) NOT NULL,
  `wr3a` tinyint(2) NOT NULL,
  `wr3y` int(3) NOT NULL,
  `tea` tinyint(2) NOT NULL,
  `tey` int(3) NOT NULL,
  `rba` tinyint(2) NOT NULL,
  `rby` int(3) NOT NULL,
  `sga` tinyint(2) NOT NULL,
  `sgy` int(3) NOT NULL,
  `p1a` tinyint(2) NOT NULL,
  `p1y` int(3) NOT NULL,
  `p2a` tinyint(2) NOT NULL,
  `p2y` int(3) NOT NULL,
  `p3a` tinyint(2) NOT NULL,
  `p3y` int(3) NOT NULL,
  `spc` tinyint(2) NOT NULL,
  `mpc` tinyint(2) NOT NULL,
  `lpc` tinyint(2) NOT NULL,
  `q1ra` tinyint(2) NOT NULL,
  `q1ry` int(3) NOT NULL,
  `q1pa` tinyint(2) NOT NULL,
  `q1py` int(3) NOT NULL,
  `lcra` tinyint(2) NOT NULL,
  `lcry` int(3) NOT NULL,
  `lcpa` tinyint(2) NOT NULL,
  `lcpy` int(3) NOT NULL,
  `rzra` tinyint(2) NOT NULL,
  `rzry` int(3) NOT NULL,
  `rzpa` tinyint(2) NOT NULL,
  `rzpy` int(3) NOT NULL,
  `sky` int(3) NOT NULL,
  `lbs` decimal(3,1) NOT NULL,
  `dbs` decimal(3,1) NOT NULL,
  `sfpy` int(3) NOT NULL,
  `drv` tinyint(2) NOT NULL,
  `npy` int(3) NOT NULL,
  `tb` tinyint(1) NOT NULL,
  `i20` tinyint(1) NOT NULL,
  `rtd` tinyint(1) NOT NULL,
  `lnr` decimal(3,1) NOT NULL,
  `lnp` decimal(3,1) NOT NULL,
  `lbr` decimal(3,1) NOT NULL,
  `lbp` decimal(3,1) NOT NULL,
  `dbr` decimal(3,1) NOT NULL,
  `dbp` decimal(3,1) NOT NULL,
  `nha` tinyint(2) NOT NULL,
  `s3a` tinyint(2) NOT NULL,
  `s3c` tinyint(2) NOT NULL,
  `l3a` tinyint(2) NOT NULL,
  `l3c` tinyint(2) NOT NULL,
  `stf` tinyint(2) NOT NULL,
  `dp` tinyint(2) NOT NULL,
  `fsp` tinyint(2) NOT NULL,
  `ohp` tinyint(2) NOT NULL,
  `pbep` tinyint(1) NOT NULL,
  `dlp` tinyint(1) NOT NULL,
  `dsp` tinyint(1) NOT NULL,
  `dum` tinyint(1) NOT NULL,
  `pfn` tinyint(1) NOT NULL,
  `snpo` tinyint(2) NOT NULL,
  `snpd` tinyint(2) NOT NULL,
  `saf` tinyint(1) NOT NULL,
  `blk` tinyint(1) NOT NULL,
  `fp` tinyint(2) NOT NULL,
  `back0p` tinyint(2) NOT NULL,
  `back0py` int(3) NOT NULL,
  `back1p` tinyint(2) NOT NULL,
  `back1py` int(3) NOT NULL,
  `back1r` tinyint(2) NOT NULL,
  `back1ry` int(3) NOT NULL,
  `back2p` tinyint(2) NOT NULL,
  `back2py` int(3) NOT NULL,
  `back2r` tinyint(2) NOT NULL,
  `back2ry` int(3) NOT NULL,
  `back3r` tinyint(2) NOT NULL,
  `back3ry` int(3) NOT NULL,
  `box4p` tinyint(2) NOT NULL,
  `box4py` int(3) NOT NULL,
  `box5p` tinyint(2) NOT NULL,
  `box5py` int(3) NOT NULL,
  `box6p` tinyint(2) NOT NULL,
  `box6py` int(3) NOT NULL,
  `box6r` tinyint(2) NOT NULL,
  `box6ry` int(3) NOT NULL,
  `box7p` tinyint(2) NOT NULL,
  `box7py` int(3) NOT NULL,
  `box7r` tinyint(2) NOT NULL,
  `box7ry` int(3) NOT NULL,
  `box8r` tinyint(2) NOT NULL,
  `box8ry` int(3) NOT NULL,
  `pap` tinyint(2) NOT NULL,
  `papy` int(3) NOT NULL,
  `npr` tinyint(2) NOT NULL,
  `npry` int(3) NOT NULL,
  `qbp` tinyint(2) NOT NULL,
  `qbpy` int(3) NOT NULL,
  `qbhi` tinyint(2) NOT NULL,
  `qbhiy` int(3) NOT NULL,
  `qbhu` tinyint(2) NOT NULL,
  `qbhuy` int(3) NOT NULL,
  `scrm` tinyint(2) NOT NULL,
  `scrmy` int(3) NOT NULL,
  `ttscrm` decimal(3,1) NOT NULL,
  `ttpr` decimal(3,1) NOT NULL,
  `ttsk` decimal(3,1) NOT NULL,
  `pru3` tinyint(2) NOT NULL,
  `pru3y` int(3) NOT NULL,
  `pru4` tinyint(2) NOT NULL,
  `pru4y` int(3) NOT NULL,
  `pru5` tinyint(2) NOT NULL,
  `pru5y` int(3) NOT NULL,
  `pru6` tinyint(2) NOT NULL,
  `pru6y` int(3) NOT NULL,
  `blz0p` tinyint(2) NOT NULL,
  `blz0py` int(3) NOT NULL,
  `blz1` tinyint(2) NOT NULL,
  `blz1y` int(3) NOT NULL,
  `blz2` tinyint(2) NOT NULL,
  `blz2y` int(3) NOT NULL,
  `dblz1` tinyint(2) NOT NULL,
  `dblz1y` int(3) NOT NULL,
  `spru1` tinyint(2) DEFAULT NULL,
  `spru1y` int(3) DEFAULT NULL,
  `oopdes` tinyint(1) DEFAULT NULL,
  `oopdesy` int(3) DEFAULT NULL,
  `ooppr` tinyint(1) DEFAULT NULL,
  `ooppry` int(3) DEFAULT NULL,
  `oopcl` tinyint(1) DEFAULT NULL,
  `oopcly` int(3) DEFAULT NULL,
  `ytg1` int(3) NOT NULL,
  `ytg2` int(3) NOT NULL,
  `ytg3` int(3) NOT NULL,
  `pc1` int(3) NOT NULL,
  `pc2` int(3) NOT NULL,
  `pc3` int(3) NOT NULL,
  `tay1` int(3) NOT NULL,
  `tay2` int(3) NOT NULL,
  `tay3` int(3) NOT NULL,
  `dot1` int(3) NOT NULL,
  `dot2` int(3) NOT NULL,
  `dot3` int(3) NOT NULL,
  `yac1` int(3) NOT NULL,
  `yac2` int(3) NOT NULL,
  `yac3` int(3) NOT NULL,
  `cov0` tinyint(2) NOT NULL,
  `cov0y` int(3) NOT NULL,
  `cov1` tinyint(2) NOT NULL,
  `cov1y` int(3) NOT NULL,
  `cov2` tinyint(2) NOT NULL,
  `cov2y` int(3) NOT NULL,
  `drp` tinyint(2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `pbp`
--

DROP TABLE IF EXISTS `pbp`;

CREATE TABLE `pbp` (
  `gid` int(5) NOT NULL,
  `pid` int(7) NOT NULL,
  `detail` text NOT NULL,
  `off` varchar(3) NOT NULL,
  `def` varchar(3) NOT NULL,
  `type` varchar(4) NOT NULL,
  `dseq` tinyint(2) NOT NULL,
  `len` tinyint(2) NOT NULL,
  `qtr` tinyint(1) NOT NULL,
  `min` tinyint(2) NOT NULL,
  `sec` tinyint(2) NOT NULL,
  `ptso` tinyint(2) NOT NULL,
  `ptsd` tinyint(2) NOT NULL,
  `timo` tinyint(1) NOT NULL,
  `timd` tinyint(1) NOT NULL,
  `dwn` varchar(1) DEFAULT NULL,
  `ytg` varchar(2) DEFAULT NULL,
  `yfog` varchar(2) DEFAULT NULL,
  `zone` varchar(1) DEFAULT NULL,
  `yds` varchar(3) DEFAULT NULL,
  `succ` varchar(1) DEFAULT NULL,
  `fd` varchar(1) DEFAULT NULL,
  `sg` varchar(1) DEFAULT NULL,
  `nh` varchar(1) DEFAULT NULL,
  `pts` varchar(2) DEFAULT NULL,
  `bc` varchar(7) DEFAULT NULL,
  `kne` varchar(1) DEFAULT NULL,
  `dir` varchar(2) DEFAULT NULL,
  `rtck1` varchar(7) DEFAULT NULL,
  `rtck2` varchar(7) DEFAULT NULL,
  `psr` varchar(7) DEFAULT NULL,
  `comp` varchar(1) DEFAULT NULL,
  `spk` varchar(1) DEFAULT NULL,
  `loc` varchar(2) DEFAULT NULL,
  `trg` varchar(7) DEFAULT NULL,
  `dfb` varchar(7) DEFAULT NULL,
  `ptck1` varchar(7) DEFAULT NULL,
  `ptck2` varchar(7) DEFAULT NULL,
  `sk1` varchar(7) DEFAULT NULL,
  `sk2` varchar(7) DEFAULT NULL,
  `ptm1` varchar(3) DEFAULT NULL,
  `pen1` varchar(7) DEFAULT NULL,
  `desc1` varchar(40) DEFAULT NULL,
  `cat1` varchar(1) DEFAULT NULL,
  `pey1` varchar(2) DEFAULT NULL,
  `act1` varchar(1) DEFAULT NULL,
  `ptm2` varchar(3) DEFAULT NULL,
  `pen2` varchar(7) DEFAULT NULL,
  `desc2` varchar(40) DEFAULT NULL,
  `cat2` varchar(1) DEFAULT NULL,
  `pey2` varchar(2) DEFAULT NULL,
  `act2` varchar(1) DEFAULT NULL,
  `ptm3` varchar(3) DEFAULT NULL,
  `pen3` varchar(7) DEFAULT NULL,
  `desc3` varchar(40) DEFAULT NULL,
  `cat3` varchar(1) DEFAULT NULL,
  `pey3` varchar(2) DEFAULT NULL,
  `act3` varchar(1) DEFAULT NULL,
  `ints` varchar(7) DEFAULT NULL,
  `iry` varchar(3) DEFAULT NULL,
  `fum` varchar(7) DEFAULT NULL,
  `frcv` varchar(7) DEFAULT NULL,
  `fry` varchar(3) DEFAULT NULL,
  `forc` varchar(7) DEFAULT NULL,
  `fuml` varchar(1) DEFAULT NULL,
  `saf` varchar(7) DEFAULT NULL,
  `blk` varchar(7) DEFAULT NULL,
  `brcv` varchar(7) DEFAULT NULL,
  `fgxp` varchar(2) DEFAULT NULL,
  `fkicker` varchar(7) DEFAULT NULL,
  `dist` varchar(2) DEFAULT NULL,
  `good` varchar(1) DEFAULT NULL,
  `punter` varchar(7) DEFAULT NULL,
  `pgro` varchar(3) DEFAULT NULL,
  `pnet` varchar(3) DEFAULT NULL,
  `ptb` varchar(1) DEFAULT NULL,
  `pr` varchar(7) DEFAULT NULL,
  `pry` varchar(3) DEFAULT NULL,
  `pfc` varchar(1) DEFAULT NULL,
  `kicker` varchar(7) DEFAULT NULL,
  `kgro` varchar(3) DEFAULT NULL,
  `knet` varchar(3) DEFAULT NULL,
  `ktb` varchar(1) DEFAULT NULL,
  `kr` varchar(7) DEFAULT NULL,
  `kry` varchar(3) DEFAULT NULL,
  `eps` decimal(3,2) NOT NULL,
  `epa` decimal(4,2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Indexes for table `block`
--

ALTER TABLE `block`
  ADD UNIQUE KEY `pid` (`pid`);

--
-- Indexes for table `chart`
--
ALTER TABLE `chart`
  ADD UNIQUE KEY `pid` (`pid`);

--
-- Indexes for table `conv`
--
ALTER TABLE `conv`
  ADD UNIQUE KEY `pid` (`pid`);

--
-- Indexes for table `defense`
--
ALTER TABLE `defense`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `drive`
--
ALTER TABLE `drive`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `fpid` (`fpid`),
  ADD KEY `tname` (`tname`);

--
-- Indexes for table `fgxp`
--
ALTER TABLE `fgxp`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `fgxp` (`fgxp`);

--
-- Indexes for table `fumble`
--
ALTER TABLE `fumble`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `fum` (`fum`);

--
-- Indexes for table `game`
--
ALTER TABLE `game`
  ADD UNIQUE KEY `gid` (`gid`),
  ADD KEY `seas` (`seas`);

--
-- Indexes for table `kicker`
--
ALTER TABLE `injury`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `intercpt`
--
ALTER TABLE `intercpt`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `psr` (`psr`),
  ADD KEY `ints` (`ints`);

--
-- Indexes for table `kicker`
--
ALTER TABLE `kicker`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `koff`
--
ALTER TABLE `koff`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `kicker` (`kicker`);

--
-- Indexes for table `offense`
--
ALTER TABLE `offense`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `pass`
--
ALTER TABLE `pass`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `psr` (`psr`),
  ADD KEY `trg` (`trg`);

--
-- Indexes for table `penalty`
--
ALTER TABLE `penalty`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `pid` (`pid`);

--
-- Indexes for table `play`
--
ALTER TABLE `play`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `gid` (`gid`);

--
-- Indexes for table `player`
--
ALTER TABLE `player`
  ADD UNIQUE KEY `player` (`player`),
  ADD KEY `fname` (`fname`),
  ADD KEY `lname` (`lname`);

--
-- Indexes for table `punt`
--
ALTER TABLE `punt`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `punter` (`punter`);

--
-- Indexes for table `redzone`
--
ALTER TABLE `redzone`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `rush`
--
ALTER TABLE `rush`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `bc` (`bc`);

--
-- Indexes for table `sack`
--
ALTER TABLE `sack`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `pid` (`pid`),
  ADD KEY `qb` (`qb`),
  ADD KEY `sk` (`sk`);

--
-- Indexes for table `safety`
--
ALTER TABLE `safety`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `saf` (`saf`);

--
-- Indexes for table `schedule`
--
ALTER TABLE `schedule`
  ADD UNIQUE KEY `gid` (`gid`);

--
-- Indexes for table `snap`
--
ALTER TABLE `snap`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `tname` (`tname`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `tackle`
--
ALTER TABLE `tackle`
  ADD UNIQUE KEY `uid` (`uid`),
  ADD KEY `pid` (`pid`),
  ADD KEY `tck` (`tck`);

--
-- Indexes for table `td`
--
ALTER TABLE `td`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `player` (`player`);

--
-- Indexes for table `team`
--
ALTER TABLE `team`
  ADD UNIQUE KEY `tid` (`tid`),
  ADD KEY `gid` (`gid`),
  ADD KEY `tname` (`tname`);

--
-- Indexes for table `pbp`
--
ALTER TABLE `pbp`
  ADD UNIQUE KEY `pid` (`pid`),
  ADD KEY `gid` (`gid`),
  ADD FULLTEXT KEY `detail` (`detail`);

-- --------------------------------------------------------

--
-- Table structure for table `draft`
--

DROP TABLE IF EXISTS `draft`;

CREATE TABLE `draft` (
  `uid` int(6) unsigned NOT NULL AUTO_INCREMENT,
  `player` varchar(7) DEFAULT NULL,
  `round` tinyint(1) NOT NULL,
  `pick` tinyint(2) DEFAULT NULL,
  `tid` int(6) NOT NULL,
  `otid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `year` int(4) NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `pick` (`round`,`pick`,`lid`,`year`),
  KEY `lid` (`lid`),
  KEY `tid` (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `leagues`
--

DROP TABLE IF EXISTS `leagues`;

CREATE TABLE `leagues` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `commishid` int(6) NOT NULL,
  `name` varchar(50) NOT NULL,
  `nteams` tinyint(2) NOT NULL,
  `sqb` tinyint(1) NOT NULL,
  `srb` tinyint(1) NOT NULL,
  `swr` tinyint(1) NOT NULL,
  `ste` tinyint(1) NOT NULL,
  `srbwr` tinyint(1) NOT NULL,
  `srbwrte` tinyint(1) NOT NULL,
  `sqbrbwrte` tinyint(1) NOT NULL,
  `swrte` tinyint(1) NOT NULL,
  `sdst` tinyint(1) NOT NULL,
  `sk` tinyint(1) NOT NULL,
  `bench` tinyint(2) NOT NULL,
  `ps` tinyint(1) NOT NULL,
  `ir` tinyint(1) NOT NULL,
  `mqb` tinyint(1) NOT NULL,
  `mrb` tinyint(1) NOT NULL,
  `mwr` tinyint(1) NOT NULL,
  `mte` tinyint(1) NOT NULL,
  `mdst` tinyint(1) NOT NULL,
  `mk` tinyint(1) NOT NULL,
  `faab` int(4) NOT NULL,
  `cap` int(4) NOT NULL,
  `pa` decimal(3,2) NOT NULL,
  `pc` decimal(3,2) NOT NULL,
  `py` decimal(3,2) NOT NULL,
  `ints` tinyint(1) NOT NULL,
  `tdp` tinyint(1) NOT NULL,
  `ra` decimal(2,1) NOT NULL,
  `ry` decimal(2,1) NOT NULL,
  `tdr` tinyint(1) NOT NULL,
  `rec` decimal(2,1) NOT NULL,
  `rbrec` decimal(2,1) NOT NULL,
  `wrrec` decimal(2,1) NOT NULL,
  `terec` decimal(2,1) NOT NULL,
  `recy` decimal(2,1) NOT NULL,
  `twoptc` tinyint(1) NOT NULL,
  `tdrec` tinyint(1) NOT NULL,
  `fuml` tinyint(1) NOT NULL,
  `prtd` tinyint(1) NOT NULL,
  `krtd` tinyint(1) NOT NULL,
  `tag2` tinyint(1) unsigned NOT NULL DEFAULT '1', -- franchise tag count
  `tag3` tinyint(1) unsigned NOT NULL DEFAULT '1', -- rookie tag count
  `tag4` tinyint(1) unsigned NOT NULL DEFAULT '2', -- transition tag count
  `ext1` int(4) DEFAULT 5,
  `ext2` int(4) DEFAULT 10,
  `ext3` int(4) DEFAULT 20,
  `ext4` int(4) DEFAULT 35,
  `ddate` int(11) DEFAULT NULL,
  `adate` int(11) DEFAULT NULL,
  `groupme_token` varchar(45) DEFAULT NULL,
  `groupme_id` varchar(26) DEFAULT NULL,
  `minBid` tinyint(1) DEFAULT 0,
  `hosted` tinyint(1) DEFAULT 0,
  `host` tinyint(1) DEFAULT NULL,
  `tddate` int(11) DEFAULT NULL,
  UNIQUE KEY `uid` (`uid`),
  KEY `commishid` (`commishid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `matchups`
--

DROP TABLE IF EXISTS `matchups`;

CREATE TABLE `matchups` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `aid` int(6) NOT NULL,
  `hid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,

  `hp` decimal(3,2) DEFAULT 0, -- points
  `ap` decimal(3,2) DEFAULT 0,

  `hpp` decimal(3,2) DEFAULT 0, -- potential points
  `app` decimal(3,2) DEFAULT 0,

  `year` int(4) NOT NULL,
  `week` tinyint(2) NOT NULL,
  PRIMARY KEY `uid` (`uid`),
  UNIQUE KEY `aid` (`aid`,`hid`,`year`,`week`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `playoffs`
--

DROP TABLE IF EXISTS `playoffs`;

CREATE TABLE `playoffs` (
  `uid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `year` int(4) NOT NULL,
  `week` tinyint(2) NOT NULL,
  UNIQUE KEY `tid` (`tid`,`uid`,`year`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `projections`
--

DROP TABLE IF EXISTS `projections`;

CREATE TABLE `projections` (
  `player` varchar(7) NOT NULL,
  `sourceid` int(3) DEFAULT NULL,
  `userid` int(4) DEFAULT NULL,
  `pa` decimal(5,1) DEFAULT NULL,
  `pc` decimal(5,1) DEFAULT NULL,
  `py` decimal(5,1) DEFAULT NULL,
  `ints` decimal(3,1) DEFAULT NULL,
  `tdp` decimal(3,1) DEFAULT NULL,
  `ra` decimal(4,1) DEFAULT NULL,
  `ry` decimal(5,1) DEFAULT NULL,
  `tdr` decimal(3,1) DEFAULT NULL,
  `trg` decimal(4,1) DEFAULT NULL,
  `rec` decimal(4,1) DEFAULT NULL,
  `recy` decimal(5,1) DEFAULT NULL,
  `tdrec` decimal(3,1) DEFAULT NULL,
  `fuml` decimal(3,1) DEFAULT NULL,
  `twoptc` decimal(3,1) DEFAULT NULL,
  `snp` decimal(5,1) DEFAULT NULL,
  `fgm` decimal(4,1) DEFAULT NULL,
  `fg19` decimal(3,1) DEFAULT NULL,
  `fg29` decimal(3,1) DEFAULT NULL,
  `fg39` decimal(3,1) DEFAULT NULL,
  `fg49` decimal(3,1) DEFAULT NULL,
  `fg50` decimal(3,1) DEFAULT NULL,
  `xpm` decimal(3,1) DEFAULT NULL,
  `dsk` decimal(4,1) DEFAULT NULL,
  `dint` decimal(4,1) DEFAULT NULL,
  `dff` decimal(4,1) DEFAULT NULL,
  `drf` decimal(4,1) DEFAULT NULL,
  `dtno` decimal(4,1) DEFAULT NULL,
  `dfds` decimal(4,1) DEFAULT NULL,
  `dpa` decimal(4,1) DEFAULT NULL,
  `dya` decimal(5,1) DEFAULT NULL,
  `dblk` decimal(4,1) DEFAULT NULL,
  `dsf` decimal(4,1) DEFAULT NULL,
  `dtpr` decimal(4,1) DEFAULT NULL,
  `dtd` decimal(4,1) DEFAULT NULL,
  `krtd` decimal(4,1) DEFAULT NULL,
  `prtd` decimal(4,1) DEFAULT NULL,
  `week` int(2) NOT NULL,
  `year` int(4) NOT NULL,
  `timestamp` datetime NOT NULL,
  UNIQUE KEY `userid` (`userid`,`player`,`year`,`week`),
  UNIQUE KEY `sourceid` (`sourceid`,`player`,`year`,`week`,`timestamp`),
  KEY `player` (`player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rosters`
--

DROP TABLE IF EXISTS `rosters`;

CREATE TABLE `rosters` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `last_updated` int(11) DEFAULT NULL,
  PRIMARY KEY `uid` (`uid`),
  UNIQUE KEY `teamid` (`tid`,`week`,`year`),
  KEY `tid` (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rosters`
--

DROP TABLE IF EXISTS `rosters_players`;

CREATE TABLE `rosters_players` (
  `rid` int(11) NOT NULL,
  `slot` int(11) NOT NULL,
  `player` varchar(7) NOT NULL,
  `pos` varchar(3) NOT NULL,
  `tag` tinyint(1) unsigned NOT NULL DEFAULT '1',
  UNIQUE KEY `player` (`rid`,`player`),
  KEY `rid` (`rid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `sources`
--

DROP TABLE IF EXISTS `sources`;

CREATE TABLE `sources` (
  `uid` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL DEFAULT '',
  `url` varchar(60) NOT NULL DEFAULT '',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;

CREATE TABLE `teams` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `lid` int(6) NOT NULL,
  `div` tinyint(1) DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  `abbrv` varchar(5) NOT NULL,
  `image` varchar(500) DEFAULT '',
  `cap` int(4) NOT NULL,
  `faab` int(4) NOT NULL,
  `do` tinyint(2) DEFAULT NULL,
  `wo` tinyint(2) DEFAULT NULL,
  `pc` varchar(6) DEFAULT NULL,
  `ac` varchar(6) DEFAULT NULL,
  UNIQUE KEY `uid` (`uid`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `team_stats`
--

DROP TABLE IF EXISTS `team_stats`;

CREATE TABLE `team_stats` (
  `tid` int(6) NOT NULL,
  `year` int(4) NOT NULL,

  `wins` tinyint(2) DEFAULT 0,
  `losses` tinyint(2) DEFAULT 0,
  `ties` tinyint(2) DEFAULT 0,

  `apWins` tinyint(2) DEFAULT 0,
  `apLosses` tinyint(2) DEFAULT 0,
  `apTies` tinyint(2) DEFAULT 0,

  `pf` decimal(6,2) DEFAULT 0,
  `pa` decimal(6,2) DEFAULT 0,
  `pdiff` decimal(6,2) DEFAULT 0,

  `pp` decimal(6,2) DEFAULT 0,
  `ppp` decimal(6,2) DEFAULT 0,
  `pw` tinyint(2) DEFAULT 0,
  `pl` tinyint(2) DEFAULT 0,
  `pp_pct` decimal(5,2) DEFAULT 0,

  `pmax` decimal(5,2) DEFAULT 0,
  `pmin` decimal(5,2) DEFAULT 0,
  `pdev` decimal(5,2) DEFAULT 0,

  `doi` decimal(4,2) DEFAULT 0,

  `pSlot1` decimal(6,2) DEFAULT 0,
  `pSlot2` decimal(6,2) DEFAULT 0,
  `pSlot3` decimal(6,2) DEFAULT 0,
  `pSlot4` decimal(6,2) DEFAULT 0,
  `pSlot5` decimal(6,2) DEFAULT 0,
  `pSlot6` decimal(6,2) DEFAULT 0,
  `pSlot7` decimal(6,2) DEFAULT 0,
  `pSlot8` decimal(6,2) DEFAULT 0,
  `pSlot9` decimal(6,2) DEFAULT 0,
  `pSlot10` decimal(6,2) DEFAULT 0,
  `pSlot11` decimal(6,2) DEFAULT 0,
  `pSlot12` decimal(6,2) DEFAULT 0,
  `pSlot13` decimal(6,2) DEFAULT 0,
  `pSlot14` decimal(6,2) DEFAULT 0,
  `pSlot15` decimal(6,2) DEFAULT 0,

  `pPosQB` decimal(6,2) DEFAULT 0,
  `pPosRB` decimal(6,2) DEFAULT 0,
  `pPosWR` decimal(6,2) DEFAULT 0,
  `pPosTE` decimal(6,2) DEFAULT 0,
  `pPosK` decimal(6,2) DEFAULT 0,
  `pPosDST` decimal(6,2) DEFAULT 0,

  UNIQUE KEY `team` (`tid`, `year`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trades`
--

DROP TABLE IF EXISTS `trades`;

CREATE TABLE `trades` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `pid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `userid` int(6) NOT NULL,
  `year` int(4) NOT NULL,
  `offered` int(11) NOT NULL,
  `cancelled` int(11) DEFAULT NULL,
  `accepted` int(11) DEFAULT NULL,
  `rejected` int(11) DEFAULT NULL,
  `vetoed` int(11) DEFAULT NULL,
  UNIQUE KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trade_releases`
--

DROP TABLE IF EXISTS `trade_releases`;

CREATE TABLE `trade_releases` (
  `tradeid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `player` varchar(7) NOT NULL,
  KEY (`tradeid`),
  UNIQUE KEY `player` (`tradeid`,`player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


-- --------------------------------------------------------

--
-- Table structure for table `trades_players`
--

DROP TABLE IF EXISTS `trades_players`;

CREATE TABLE `trades_players` (
  `tradeid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `player` varchar(7) NOT NULL,
  KEY (`tradeid`),
  UNIQUE KEY `player` (`tradeid`,`player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trades_picks`
--

DROP TABLE IF EXISTS `trades_picks`;

CREATE TABLE `trades_picks` (
  `tradeid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `pickid` int(6) NOT NULL,
  KEY (`tradeid`),
  UNIQUE KEY `pick` (`tradeid`,`pickid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trades_transactions`
--

DROP TABLE IF EXISTS `trades_transactions`;

CREATE TABLE `trades_transactions` (
  `tradeid` int(6) NOT NULL,
  `transactionid` int(6) NOT NULL,
  UNIQUE KEY `transaction` (`tradeid`,`transactionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `cutlist`
--

DROP TABLE IF EXISTS `cutlist`;

CREATE TABLE `cutlist` (
  `player` varchar(7) NOT NULL,
  `tid` int(6) NOT NULL,
  `order` tinyint(2) NOT NULL,
  KEY `player` (`player`),
  KEY `teamid` (`tid`),
  UNIQUE KEY `teamplayer` (`tid`, `player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;

CREATE TABLE `transactions` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `userid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `player` varchar(7) NOT NULL,
  `type` tinyint(2) NOT NULL,
  `value` int(4) NOT NULL,
  `year` int(4) NOT NULL,
  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `uid` (`uid`),
  KEY `player` (`player`),
  KEY `teamid` (`tid`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL DEFAULT '',
  `password` varchar(60) NOT NULL DEFAULT '',
  `vorpw` decimal(2,2) DEFAULT NULL,
  `volsw` decimal(2,2) DEFAULT NULL,
  `vbaseline` varchar(9) NOT NULL DEFAULT 'starter',
  `watchlist` mediumtext,
  `lastvisit` datetime DEFAULT NULL,
  `qbb` varchar(7) DEFAULT NULL,
  `rbb` varchar(7) DEFAULT NULL,
  `wrb` varchar(7) DEFAULT NULL,
  `teb` varchar(7) DEFAULT NULL,
  `phone` varchar(12) DEFAULT NULL,
  `text` tinyint(1) NOT NULL DEFAULT 1,
  `voice` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `users_sources`
--

DROP TABLE IF EXISTS `users_sources`;

CREATE TABLE `users_sources` (
  `userid` int(6) NOT NULL,
  `sourceid` int(6) NOT NULL,
  `weight` decimal(2,2) NOT NULL,
  KEY (`userid`),
  UNIQUE KEY `sourceid` (`userid`,`sourceid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `users_teams`
--

DROP TABLE IF EXISTS `users_teams`;

CREATE TABLE `users_teams` (
  `userid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `teamtext` tinyint(1) NOT NULL DEFAULT 1,
  `teamvoice` tinyint(1) NOT NULL DEFAULT 1,
  `leaguetext` tinyint(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `userid` (`userid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `waivers`
--

DROP TABLE IF EXISTS `waivers`;

CREATE TABLE `waivers` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `userid` int(6) NOT NULL,
  `player` varchar(7) NOT NULL,
  `drop` varchar(7) DEFAULT NULL,
  `tid` int(5) NOT NULL,
  `lid` int(6) NOT NULL,
  `submitted` int(11) NOT NULL,
  `bid` int(4) DEFAULT NULL,
  `po` int(4) DEFAULT 0, -- priority order
  `type` tinyint(1) NOT NULL,
  `succ` tinyint(1) DEFAULT NULL,
  `reason` text DEFAULT NULL,

  `deadline` int(11) DEFAULT NULL,

  `processed` int(11) DEFAULT NULL,
  `cancelled` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `waiver_release`
--

DROP TABLE IF EXISTS `waiver_releases`;

CREATE TABLE `waiver_releases` (
  `waiverid` int(11) NOT NULL,
  `player` varchar(7) NOT NULL,
  KEY `waiverid` (`waiverid`),
  UNIQUE KEY `player` (`waiverid`, `player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;

CREATE TABLE `jobs` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(1) NOT NULL,
  `succ` tinyint(1) NOT NULL,
  `reason` text DEFAULT NULL,
  `timestamp` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `changelog`
--

DROP TABLE IF EXISTS `changelog`;

CREATE TABLE `changelog` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `id` text NOT NULL,
  `type` tinyint(2) NOT NULL,
  `prop` text DEFAULT NULL,
  `prev` text DEFAULT NULL,
  `new` text DEFAULT NULL,
  `timestamp` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `changelog`
--

DROP TABLE IF EXISTS `nflSchedule`;

CREATE TABLE `nflSchedule` (
  `gid` int(5) NOT NULL,
  `esbid` int(10) NOT NULL,
  `gsisid` int(5) NOT NULL,
  `season` int(4) NOT NULL,
  `seasonType` varchar(10) NOT NULL,
  `week` int(2) NOT NULL,
  `gameShieldId` varchar(36) NOT NULL,
  `gameDetailId` varchar(36) DEFAULT NULL,
  `homeTeamId` varchar(36) NOT NULL,
  `homeTeamAbbr` varchar(36) NOT NULL,
  `homeScore` int(5) DEFAULT 0,
  `awayTeamId` varchar(36) NOT NULL,
  `awayTeamAbbr` varchar(36) NOT NULL,
  `awayScore` int(5) DEFAULT 0,
  `gameClock` varchar(10) DEFAULT NULL,
  `gameStatus` varchar(10) DEFAULT NULL,
  `possessionTeamId` varchar(36) DEFAULT NULL,
  `possessionTeamAbbr` varchar(36) DEFAULT NULL,
  `gameDate` varchar(10) NOT NULL,
  `gameTimeEastern` varchar(8) NOT NULL,
  UNIQUE KEY `gid` (`gid`),
  UNIQUE KEY `esbid` (`esbid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nflPlay`
--

DROP TABLE IF EXISTS `nflPlay`;

CREATE TABLE `nflPlay` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) DEFAULT NULL,
  `sequence` int(10) DEFAULT NULL,
  `playState` varchar(36) DEFAULT NULL,
  `down` int(1) DEFAULT NULL,
  `homeScore` int(5) DEFAULT NULL,
  `isBigPlay` tinyint(1) DEFAULT NULL,
  `isSTPlay` tinyint(1) DEFAULT NULL,
  `isScoring` tinyint(1) DEFAULT NULL,
  `playDescription` text DEFAULT NULL,
  `playType` text DEFAULT NULL,
  `possessionTeam` varchar(10) DEFAULT NULL,
  `possessionTeamId` varchar(36) DEFAULT NULL,
  `quarter` int(1) DEFAULT NULL,
  `season` int(4) DEFAULT NULL,
  `seasonType` varchar(36) DEFAULT NULL,
  `visitorScore` int(4) DEFAULT NULL,
  `week` int(2) DEFAULT NULL,
  `yardlineNumber` int(4) DEFAULT NULL,
  `yardlineSide` varchar(10) DEFAULT NULL,
  `yardsToGo` int(3) DEFAULT NULL,
  `isRedzonePlay` tinyint(1) DEFAULT NULL,
  `offenseFormation` varchar(100) DEFAULT NULL,
  `offensePersonnel` varchar(100) DEFAULT NULL,
  `defendersInTheBox` int(3) DEFAULT NULL,
  `numberOfPassRushers` int(3) DEFAULT NULL,
  `defensePersonnel` varchar(36) DEFAULT NULL,

  `driveNetYards` int(3) DEFAULT NULL,
  `drivePlayCount` int(3) DEFAULT NULL,
  `clockTime` varchar(10) DEFAULT NULL,
  `driveSequenceNumber` int(4) DEFAULT NULL,
  `startYardLine` varchar(10) DEFAULT NULl,
  `endYardLine` varchar(10) DEFAULT NULl,
  `firstDown` tinyint(1) DEFAULT NULL,
  `goalToGo` tinyint(1) DEFAULT NULL,
  `nextPlayType` varchar(36) DEFAULT NULL,
  `orderSequence` int(10) DEFAULT NULL,
  `penaltyOnPlay` tinyint(1) DEFAULT NULL,
  `playClock` varchar(10) DEFAULT NULL,
  `playDeleted` tinyint(1) DEFAULT NULL,
  `playReviewStatus` text DEFAULT NULL,
  `scoringPlay` tinyint(1) DEFAULT NULL,
  `scoringPlayType` varchar(10) DEFAULT NULL,
  `scoringTeam` varchar(4) DEFAULT NULL,
  `stPlayType` text DEFAULT NULL,
  `timeOfDay` varchar(10) DEFAULT NULL,
  `playTypeNFL` varchar(36) DEFAULT NULL,

  `updated` int(11) NOT NULL,
  UNIQUE KEY `gamePlay` (`esbid`,`playId`),
  KEY `esbid` (`esbid`),
  KEY `playId` (`playId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nflPlayStat`
--

DROP TABLE IF EXISTS `nflPlayStat`;

CREATE TABLE `nflPlayStat` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) NOT NULL,
  `clubCode` varchar(10) DEFAULT NULL,
  `playerName` varchar(36) DEFAULT NULL,
  `statId` int(10) NOT NULL,
  `yards` int(3) DEFAULT NULL,
  `gsisId` varchar(36) DEFAULT NULL,
  `gsispid` varchar(47) DEFAULT NULL,
  `teamid` varchar(36) DEFAULT NULL,
  `valid` tinyint(1) DEFAULT NULL,
  KEY `playId` (`playId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nflSnap`
--

DROP TABLE IF EXISTS `nflSnap`;

CREATE TABLE `nflSnap` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) NOT NULL,
  `nflId` int(10) NOT NULL,
  KEY `playId` (`playId`),
  UNIQUE KEY `snap` (`playId`,`nflId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `practice`
--

DROP TABLE IF EXISTS `practice`;

CREATE TABLE `practice` (
  `player` varchar(7) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `status` varchar(100) DEFAULT NULL,
  `inj` varchar(100) DEFAULT NULL,
  `m` varchar(20) DEFAULT NULL,
  `tu` varchar(20) DEFAULT NULL,
  `w` varchar(20) DEFAULT NULL,
  `th` varchar(20) DEFAULT NULL,
  `f` varchar(20) DEFAULT NULL,
  `s` varchar(20) DEFAULT NULL,
  `su` varchar(20) DEFAULT NULL,
  UNIQUE KEY `player` (`player`, `week`, `year`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `gamelogs`
--

DROP TABLE IF EXISTS `gamelogs`;

CREATE TABLE `gamelogs` (
  `player` varchar(7) NOT NULL,
  `tm` varchar(3) NOT NULL,
  `opp` varchar(3) NOT NULL,
  `pos` varchar(3) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,

  `pa` tinyint(2) DEFAULT 0,
  `pc` tinyint(2) DEFAULT 0,
  `py` int(3) DEFAULT 0,
  `ints` tinyint(1) DEFAULT 0,
  `tdp` tinyint(1) DEFAULT 0,

  `ra` tinyint(2) DEFAULT 0,
  `ry` int(3) DEFAULT 0,
  `tdr` tinyint(1) DEFAULT 0,
  `fuml` tinyint(1) DEFAULT 0,

  `trg` tinyint(2) DEFAULT 0,
  `rec` tinyint(2) DEFAULT 0,
  `recy` int(3) DEFAULT 0,
  `tdrec` tinyint(1) DEFAULT 0,

  `twoptc` tinyint(1) DEFAULT 0,

  `prtd` tinyint(1) DEFAULT 0,
  `krtd` tinyint(1) DEFAULT 0,

  `snp` tinyint(3) DEFAULT 0,

  `fgm` tinyint(1) DEFAULT 0,
  `fgy` int(3) DEFAULT 0,
  `fg19` tinyint(1) DEFAULT 0,
  `fg29` tinyint(1) DEFAULT 0,
  `fg39` tinyint(1) DEFAULT 0,
  `fg49` tinyint(1) DEFAULT 0,
  `fg50` tinyint(1) DEFAULT 0,
  `xpm` tinyint(1) DEFAULT 0,

  `dsk` tinyint(2) DEFAULT 0,
  `dint` tinyint(2) DEFAULT 0,
  `dff` tinyint(2) DEFAULT 0,
  `drf` tinyint(2) DEFAULT 0,
  `dtno` tinyint(2) DEFAULT 0,
  `dfds` tinyint(2) DEFAULT 0,
  `dpa` tinyint(2) DEFAULT 0,
  `dya` int(4) DEFAULT 0,
  `dblk` tinyint(2) DEFAULT 0,
  `dsf` tinyint(2) DEFAULT 0,
  `dtpr` tinyint(2) DEFAULT 0,
  `dtd` tinyint(2) DEFAULT 0,

  UNIQUE KEY `player` (`player`, `week`, `year`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `footballoutsiders`
--

DROP TABLE IF EXISTS `footballoutsiders`;

CREATE TABLE `footballoutsiders` (
  `week` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `team` varchar(3) NOT NULL,

  `ork` tinyint(2) DEFAULT NULL,
  `drk` tinyint(2) DEFAULT NULL,
  `odvoa` decimal(3,1) DEFAULT NULL,
  `ddvoa` decimal(3,1) DEFAULT NULL,
  `olw` tinyint(2) DEFAULT NULL,
  `dlw` tinyint(2) DEFAULT NULL,
  `odave` decimal(3,1) DEFAULT NULL,
  `ddave` decimal(3,1) DEFAULT NULL,
  `opass` decimal(3,1) DEFAULT NULL,
  `dpass` decimal(3,1) DEFAULT NULL,
  `orun` decimal(3,1) DEFAULT NULL,
  `drun` decimal(3,1) DEFAULT NULL,

  `olrunaly` decimal(4,2) DEFAULT NULL,
  `dlrunaly` decimal(4,2) DEFAULT NULL,
  `olrby` decimal(4,2) DEFAULT NULL,
  `dlrby` decimal(4,2) DEFAULT NULL,
  `olpwr` int(3) DEFAULT NULL,
  `dlpwr` int(3) DEFAULT NULL,
  `olstf` int(3) DEFAULT NULL,
  `dlstf` int(3) DEFAULT NULL,
  `olrun2y` decimal(4,2) DEFAULT NULL,
  `dlrun2y` decimal(4,2) DEFAULT NULL,
  `olrunofy` decimal(4,2) DEFAULT NULL,
  `dlrunofy` decimal(4,2) DEFAULT NULL,
  `olpassrk` tinyint(2) DEFAULT NULL,
  `dlpassrk` tinyint(2) DEFAULT NULL,
  `olskrk` tinyint(2) DEFAULT NULL,
  `dlskrk` tinyint(2) DEFAULT NULL,
  `olskrt` decimal(3,1) DEFAULT NULL,
  `dlskrt` decimal(3,1) DEFAULT NULL,

  `olrunley` decimal(4,2) DEFAULT NULL,
  `dlrunley` decimal(4,2) DEFAULT NULL,

  `olrunlty` decimal(4,2) DEFAULT NULL,
  `dlrunlty` decimal(4,2) DEFAULT NULL,

  `olrunmgy` decimal(4,2) DEFAULT NULL,
  `dlrunmgy` decimal(4,2) DEFAULT NULL,

  `olrunrty` decimal(4,2) DEFAULT NULL,
  `dlrunrty` decimal(4,2) DEFAULT NULL,

  `olrunrey` decimal(4,2) DEFAULT NULL,
  `dlrunrey` decimal(4,2) DEFAULT NULL,

  `odrv` int(3) DEFAULT NULL,
  `ddrv` int(3) DEFAULT NULL,
  `oypdrv` decimal(4,2) DEFAULT NULL,
  `dypdrv` decimal(4,2) DEFAULT NULL,
  `optspdrv` decimal(3,2) DEFAULT NULL,
  `dptspdrv` decimal(3,2) DEFAULT NULL,
  `otopdrv` decimal(4,3) DEFAULT NULL,
  `dtopdrv` decimal(4,3) DEFAULT NULL,
  `ointpdrv` decimal(4,3) DEFAULT NULL,
  `dintpdrv` decimal(4,3) DEFAULT NULL,
  `ofumpdrv` decimal(4,3) DEFAULT NULL,
  `dfumpdrv` decimal(4,3) DEFAULT NULL,
  `olospdrv` decimal(4,2) DEFAULT NULL,
  `dlospdrv` decimal(4,2) DEFAULT NULL,
  `oplypdrv` decimal(4,2) DEFAULT NULL,
  `dplypdrv` decimal(4,2) DEFAULT NULL,
  `otoppdrv` varchar(10) DEFAULT NULL,
  `dtoppdrv` varchar(10) DEFAULT NULL,
  `odrvsucc` decimal(4,3) DEFAULT NULL,
  `ddrvsucc` decimal(4,3) DEFAULT NULL,

  `otdpdrv` decimal(4,3) DEFAULT NULL,
  `dtdpdrv` decimal(4,3) DEFAULT NULL,
  `ofgpdrv` decimal(4,3) DEFAULT NULL,
  `dfgpdrv` decimal(4,3) DEFAULT NULL,
  `opntpdrv` decimal(4,3) DEFAULT NULL,
  `dpntpdrv` decimal(4,3) DEFAULT NULL,
  `o3opdrv` decimal(4,3) DEFAULT NULL,
  `d3opdrv` decimal(4,3) DEFAULT NULL,
  `olosko` decimal(4,2) DEFAULT NULL,
  `dlosko` decimal(4,2) DEFAULT NULL,
  `otdfg` decimal(5,2) DEFAULT NULL,
  `dtdfg` decimal(5,2) DEFAULT NULL,
  `optsprz` decimal(3,2) DEFAULT NULL,
  `dptsprz` decimal(3,2) DEFAULT NULL,
  `otdprz` decimal(4,3) DEFAULT NULL,
  `dtdprz` decimal(4,3) DEFAULT NULL,
  `oavgld` decimal(4,2) DEFAULT NULL,
  `davgld` decimal(4,2) DEFAULT NULL,
  UNIQUE KEY `team` (`team`, `week`, `year`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rankings`
--

DROP TABLE IF EXISTS `rankings`;

CREATE TABLE `rankings` (
  `player` varchar(7) NOT NULL,
  `pos` varchar(3) NOT NULL,
  `wk` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `min` int(4) DEFAULT NULL,
  `max` int(4) DEFAULT NULL,
  `avg` decimal(5,2) DEFAULT NULL,
  `std` decimal(5,2) DEFAULT NULL,
  `ornk` int(4) DEFAULT NULL,
  `prnk` int(4) DEFAULT NULL,
  `type` int(1) NOT NULL,
  `adp` tinyint(1) DEFAULT NULL,
  `ppr` int(1) DEFAULT NULL,
  `sf` tinyint(1) DEFAULT NULL,
  `dynasty` tinyint(1) DEFAULT NULL,
  `rookie` tinyint(2) DEFAULT NULL,
  `sourceid` int(6) NOT NULL,
  `timestamp` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


-- --------------------------------------------------------

--
-- Table structure for table `props`
--

DROP TABLE IF EXISTS `props`;

CREATE TABLE `props` (
  `player` varchar(7) NOT NULL,
  `wk` tinyint(2) NOT NULL,
  `year` int(4) NOT NULL,
  `type` tinyint(3) NOT NULL,
  `id` varchar(100) DEFAULT NULL,
  `ln` decimal(4,1) NOT NULL,
  `o` decimal(5,2) NOT NULL,
  `u` decimal(5,2) NOT NULL,
  `sourceid` int(6) NOT NULL,
  `timestamp` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `transition_bids`
--

DROP TABLE IF EXISTS `transition_bids`;

CREATE TABLE `transition_bids` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `player` varchar(7) NOT NULL,
  `userid` int(6) NOT NULL,
  `bid` int(4) DEFAULT NULL,
  `tid` int(5) NOT NULL,
  `year` int(4) NOT NULL,
  `player_tid` int(5) NOT NULL,
  `lid` int(6) NOT NULL,
  `succ` tinyint(1) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `submitted` int(11) NOT NULL,
  `processed` int(11) DEFAULT NULL,
  `cancelled` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  KEY `lid` (`lid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `poach_releases`
--

DROP TABLE IF EXISTS `transition_releases`;

CREATE TABLE `transition_releases` (
  `transitionid` int(11) NOT NULL,
  `player` varchar(7) NOT NULL,
  KEY `transitionid` (`transitionid`),
  UNIQUE KEY `player` (`transitionid`, `player`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
