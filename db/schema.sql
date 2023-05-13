SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------

--
-- Table structure for table `player`
--

DROP TABLE IF EXISTS `player`;

CREATE TABLE `player` (
  `pid` varchar(25) NOT NULL,
  `fname` varchar(20) NOT NULL,
  `lname` varchar(25) NOT NULL,
  `pname` varchar(25) NOT NULL,
  `formatted` varchar(30) NOT NULL,
  `pos` varchar(4) NOT NULL,
  `pos1` varchar(4) NOT NULL,
  `pos2` varchar(4) DEFAULT NULL,
  `height` tinyint(2) unsigned NOT NULL,
  `weight` int(3) unsigned NOT NULL,
  `dob` varchar(10) NOT NULL,
  `forty` decimal(3,2) DEFAULT NULL,
  `bench` tinyint(2) DEFAULT NULL,
  `vertical` decimal(3,1) DEFAULT NULL,
  `broad` int(3) DEFAULT NULL,
  `shuttle` decimal(3,2) DEFAULT NULL,
  `cone` decimal(3,2) DEFAULT NULL,
  `arm` decimal(5,3) DEFAULT NULL,
  `hand` decimal(5,3) DEFAULT NULL,
  `dpos` int(3) NOT NULL DEFAULT '0', -- draft position
  `round` tinyint(1) NOT NULL DEFAULT '0', -- draft round
  `col` varchar(255) DEFAULT NULL,
  `dv` varchar(35) DEFAULT NULL,
  `start` int(4) NOT NULL,
  `cteam` varchar(3) NOT NULL DEFAULT 'INA',
  `posd` varchar(8) NOT NULL DEFAULT 'INA',
  `jnum` tinyint(2) NOT NULL DEFAULT 0,
  `dcp` tinyint(1) NOT NULL DEFAULT 0,

  `nflid` int(10) DEFAULT NULL,
  `esbid` varchar(10) DEFAULT NULL,
  `gsisid` varchar(15) DEFAULT NULL,
  `gsispid` varchar(47) DEFAULT NULL,
  `gsisItId` mediumint(8) DEFAULT NULL,

  `status` varchar(255) DEFAULT NULL,
  `nfl_status` varchar(10) DEFAULT NULL,
  `injury_status` varchar(255) DEFAULT NULL,
  `high_school` varchar(255) DEFAULT NULL,

  `sleeper_id` varchar(11) DEFAULT NULL,
  `rotoworld_id` int(11) DEFAULT NULL,
  `rotowire_id` int(11) DEFAULT NULL,
  `sportradar_id` varchar(36) DEFAULT NULL,
  `espn_id` int(11) DEFAULT NULL,
  `fantasy_data_id` int(11) DEFAULT NULL,
  `yahoo_id` int(11) DEFAULT NULL,
  `keeptradecut_id` int(11) DEFAULT NULL,

  FULLTEXT KEY `name` (`fname`,`lname`),

  -- UNIQUE KEY `nflid` (`nflid`), TODO
  UNIQUE KEY `esbid` (`esbid`),
  UNIQUE KEY `gsisid` (`gsisid`),
  UNIQUE KEY `gsispid` (`gsispid`),
  UNIQUE KEY `gsisItId` (`gsisItId`),

  UNIQUE KEY `sleeper_id` (`sleeper_id`),
  UNIQUE KEY `rotoworld_id` (`rotoworld_id`),
  UNIQUE KEY `rotowire_id` (`rotowire_id`),
  UNIQUE KEY `sportradar_id` (`sportradar_id`),
  UNIQUE KEY `espn_id` (`espn_id`),
  UNIQUE KEY `fantasy_data_id` (`fantasy_data_id`),
  UNIQUE KEY `yahoo_id` (`yahoo_id`),
  UNIQUE KEY `keeptradecut_id` (`keeptradecut_id`),
  UNIQUE KEY `pid` (`pid`),
  KEY `fname` (`fname`),
  KEY `lname` (`lname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `players_status`
--

DROP TABLE IF EXISTS `players_status`;

CREATE TABLE `players_status` (
  `pid` varchar(25) NOT NULL,
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
  KEY `pid` (`pid`),
  UNIQUE KEY `status` (`pid`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `poaches`
--

DROP TABLE IF EXISTS `poaches`;

CREATE TABLE `poaches` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `pid` varchar(25) NOT NULL,
  `userid` int(6) NOT NULL,
  `tid` int(5) NOT NULL,
  `player_tid` int(5) NOT NULL,
  `lid` int(6) NOT NULL,
  `succ` tinyint(1) DEFAULT NULL,
  `submitted` int(11) NOT NULL,
  `reason` text DEFAULT NULL,
  `processed` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `poach_releases`
--

DROP TABLE IF EXISTS `poach_releases`;

CREATE TABLE `poach_releases` (
  `poachid` int(11) NOT NULL,
  `pid` varchar(25) NOT NULL,
  KEY `poachid` (`poachid`),
  UNIQUE KEY `pid` (`poachid`, `pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `seasons`
--

DROP TABLE IF EXISTS `seasons`;

CREATE TABLE `seasons` (
  `lid` int(11) NOT NULL,
  `year` smallint(4) NOT NULL,
  `season_started_at` int(11) unsigned DEFAULT NULL,

  `league_format_hash` varchar(64) NOT NULL,
  `scoring_format_hash` varchar(64) NOT NULL,

  `mqb` tinyint(1) NOT NULL,
  `mrb` tinyint(1) NOT NULL,
  `mwr` tinyint(1) NOT NULL,
  `mte` tinyint(1) NOT NULL,
  `mdst` tinyint(1) NOT NULL,
  `mk` tinyint(1) NOT NULL,

  `faab` int(4) NOT NULL,

  `tag2` tinyint(1) unsigned NOT NULL DEFAULT '1', -- franchise tag count
  `tag3` tinyint(1) unsigned NOT NULL DEFAULT '1', -- rookie tag count
  `tag4` tinyint(1) unsigned NOT NULL DEFAULT '2', -- transition tag count

  `ext1` int(4) DEFAULT 5,
  `ext2` int(4) DEFAULT 10,
  `ext3` int(4) DEFAULT 20,
  `ext4` int(4) DEFAULT 35,

  `fqb` mediumint(3) unsigned DEFAULT NULL, -- qb franchise tag amount
  `frb` mediumint(3) unsigned DEFAULT NULL, -- rb franchise tag amount
  `fwr` mediumint(3) unsigned DEFAULT NULL, -- wr franchise tag amount
  `fte` mediumint(3) unsigned DEFAULT NULL, -- te franchise tag amount

  `tran_start` int(11) unsigned DEFAULT NULL, -- start of restricted free agency
  `tran_end` int(11) unsigned DEFAULT NULL, -- end of restricted free agency

  `ext_date` int(11) unsigned DEFAULT NULL, -- extension deadline

  `draft_start` int(11) unsigned DEFAULT NULL,
  `draft_type` varchar(10) DEFAULT NULL, -- `hour`, `day`
  `draft_hour_min` tinyint(2) unsigned DEFAULT NULL,
  `draft_hour_max` tinyint(2) unsigned DEFAULT NULL,

  `adate` int(11) unsigned DEFAULT NULL,
  `tddate` int(11) unsigned DEFAULT NULL,
  UNIQUE KEY `season` (`lid`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_games`
--

DROP TABLE IF EXISTS `nfl_games`;

CREATE TABLE `nfl_games` (
  `esbid` int(10) DEFAULT NULL,
  `gsisid` int(5) DEFAULT NULL,
  `gameid` varchar(20) DEFAULT NULL,
  `espnid` int(15) DEFAULT NULL,
  `ngsid` int(10) DEFAULT NULL,
  `shieldid` varchar(36) DEFAULT NULL,
  `detailid` varchar(36) DEFAULT NULL,
  `pfrid` varchar(20) DEFAULT NULL,

  `year` smallint(4) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `day` varchar(3) DEFAULT NULL, -- FRI, MN, SAT, SN, SUN, THU, TUE, WED, SB, PRO
  `date` varchar(10) DEFAULT NULL,
  `time_est` varchar(8) DEFAULT NULL,
  `time_tz_offset` tinyint(2) DEFAULT NULL,
  `time_start` varchar(36) DEFAULT NULL,
  `time_end` varchar(36) DEFAULT NULL,
  `timestamp` int(11) DEFAULT NULL,

  `v` varchar(3) NOT NULL,
  `h` varchar(3) NOT NULL,

  `seas_type` varchar(10) NOT NULL, -- PRE, REG, POST
  `week_type` varchar(10) DEFAULT NULL,
  `ot` tinyint(1) DEFAULT NULL, -- overtime
  `div` tinyint(1) DEFAULT NULL, -- division game

  `home_team_id` varchar(36) DEFAULT NULL,
  `away_team_id` varchar(36) DEFAULT NULL,
  `home_ngsid` varchar(10) DEFAULT NULL,
  `away_ngsid` varchar(10) DEFAULT NULL,

  `home_score` int(5) DEFAULT 0,
  `away_score` int(5) DEFAULT 0,

  `stad` varchar(45) DEFAULT NULL,
  `stad_nflid` varchar(8) DEFAULT NULL,
  `site_ngsid` int(5) DEFAULT NULL,

  `clock` varchar(10) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,

  `away_rest` int(1) DEFAULT NULL,
  `home_rest` int(1) DEFAULT NULL,
  `home_moneyline` int(5) DEFAULT NULL,
  `away_moneyline` int(5) DEFAULT NULL,
  `spread_line` int(3) DEFAULT NULL,
  `total_line` int(3) DEFAULT NULL,

  `roof` varchar(30) DEFAULT NULL,
  `surf` varchar(30) DEFAULT NULL,

  `temp` int(3) DEFAULT NULL,
  `wind` int(3) DEFAULT NULL,

  `away_coach` varchar(36) DEFAULT NULL,
  `home_coach` varchar(36) DEFAULT NULL,
  `off_play_caller` varchar(36) DEFAULT NULL,

  `referee` varchar(36) DEFAULT NULL,

  UNIQUE KEY `game` (`v`, `h`, `week`, `year`, `seas_type`),
  UNIQUE KEY `esbid` (`esbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `draft`
--

DROP TABLE IF EXISTS `draft`;

CREATE TABLE `draft` (
  `uid` int(6) unsigned NOT NULL AUTO_INCREMENT,
  `pid` varchar(25) DEFAULT NULL,
  `round` tinyint(1) NOT NULL,
  `comp` tinyint(1) DEFAULT 0,
  `pick` tinyint(2) DEFAULT NULL,
  `tid` int(6) NOT NULL,
  `otid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `year` smallint(4) NOT NULL,
  `selection_timestamp` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `pick` (`round`,`pick`,`lid`,`year`),
  KEY `lid` (`lid`),
  KEY `tid` (`tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `leagues`
--

DROP TABLE IF EXISTS `leagues`;

CREATE TABLE `leagues` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `commishid` int(6) NOT NULL,
  `name` varchar(50) NOT NULL,

  `espn_id` int unsigned DEFAULT NULL,
  `sleeper_id` int unsigned DEFAULT NULL,
  `mfl_id` int unsigned DEFAULT NULL,
  `fleaflicker_id` int unsigned DEFAULT NULL,

  `discord_webhook_url` varchar(255) DEFAULT NULL,
  `groupme_token` varchar(45) DEFAULT NULL,
  `groupme_id` varchar(26) DEFAULT NULL,

  `hosted` tinyint(1) DEFAULT 0,
  `host` tinyint(1) DEFAULT NULL,

  `processed_at` int(11) DEFAULT NULL,
  `archived_at` int(11) DEFAULT NULL,

  UNIQUE KEY `uid` (`uid`),
  KEY `commishid` (`commishid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_formats`
--

DROP TABLE IF EXISTS `league_formats`;

CREATE TABLE `league_formats` (
  `league_format_hash` varchar(64) NOT NULL,
  `scoring_format_hash` varchar(64) NOT NULL,

  `num_teams` tinyint(2) NOT NULL,

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

  `cap` int(4) NOT NULL,
  `min_bid` tinyint(1) DEFAULT 0,

  `b_QB` decimal(2,1) unsigned DEFAULT NULL, -- baseline qb pts/game
  `b_RB` decimal(2,1) unsigned DEFAULT NULL, -- baseline rb pts/game
  `b_WR` decimal(2,1) unsigned DEFAULT NULL, -- baseline wr pts/game
  `b_TE` decimal(2,1) unsigned DEFAULT NULL, -- baseline te pts/game
  `b_K` decimal(2,1) unsigned DEFAULT NULL, -- baseline k pts/game
  `b_DST` decimal(2,1) unsigned DEFAULT NULL, -- baseline dst pts/game

  UNIQUE KEY `league_format_hash` (`league_format_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_scoring_formats`
--

DROP TABLE IF EXISTS `league_scoring_formats`;

CREATE TABLE `league_scoring_formats` (
  `scoring_format_hash` varchar(64) NOT NULL,

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

  UNIQUE KEY `scoring_format_hash` (`scoring_format_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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

  `year` smallint(4) NOT NULL,
  `week` tinyint(2) NOT NULL,
  PRIMARY KEY `uid` (`uid`),
  UNIQUE KEY `aid` (`aid`,`hid`,`year`,`week`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `playoffs`
--

DROP TABLE IF EXISTS `playoffs`;

CREATE TABLE `playoffs` (
  `uid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `year` smallint(4) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `points` decimal(7,4) DEFAULT NULL,
  UNIQUE KEY `tid` (`tid`,`uid`,`year`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `projections`
--

DROP TABLE IF EXISTS `projections`;

CREATE TABLE `projections` (
  `pid` varchar(25) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `sourceid` int NOT NULL DEFAULT '0',
  `userid` int NOT NULL DEFAULT '0',
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
  `snp` decimal(5,1) DEFAULT NULL,
  `twoptc` decimal(3,1) DEFAULT NULL,
  `week` tinyint NOT NULL,
  `year` smallint NOT NULL,
  `timestamp` datetime NOT NULL,
  `fgm` decimal(4,1) DEFAULT NULL,
  `fgy` int DEFAULT '0',
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
  UNIQUE KEY `projection` (`sourceid`,`pid`,`userid`,`timestamp`,`week`,`year`),
  KEY `pid` (`pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `projections_archive`
--

DROP TABLE IF EXISTS `projections_archive`;

CREATE TABLE `projections_archive` (
  `pid` varchar(25) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `sourceid` int NOT NULL DEFAULT '0',
  `userid` int NOT NULL DEFAULT '0',
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
  `snp` decimal(5,1) DEFAULT NULL,
  `twoptc` decimal(3,1) DEFAULT NULL,
  `week` tinyint NOT NULL,
  `year` smallint NOT NULL,
  `timestamp` datetime NOT NULL,
  `fgm` decimal(4,1) DEFAULT NULL,
  `fgy` int DEFAULT '0',
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
  UNIQUE KEY `projection` (`sourceid`,`pid`,`userid`,`week`,`year`,`timestamp`),
  KEY `pid` (`pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `ros_projections`
--

DROP TABLE IF EXISTS `ros_projections`;

CREATE TABLE `ros_projections` (
  `pid` varchar(25) NOT NULL,
  `sourceid` int(3) NOT NULL,
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
  `fgy` int(3) DEFAULT 0,
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
  `year` smallint(4) NOT NULL,
  `timestamp` datetime NOT NULL,
  UNIQUE KEY `sourceid` (`sourceid`,`pid`,`year`),
  KEY `pid` (`pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `scoring_format_player_projection_points`
--

DROP TABLE IF EXISTS `scoring_format_player_projection_points`;

CREATE TABLE `scoring_format_player_projection_points` (
  `pid` varchar(25) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `scoring_format_hash` varchar(64) NOT NULL,

  `total` decimal(5,2) DEFAULT NULL,

  `pa` decimal(5,1) DEFAULT NULL,
  `pc` decimal(5,1) DEFAULT NULL,
  `py` decimal(5,1) DEFAULT NULL,
  `ints` decimal(3,1) DEFAULT NULL,
  `tdp` decimal(4,1) DEFAULT NULL,
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
  KEY `pid` (`pid`),
  UNIQUE KEY `player_league_points` (`pid`, `scoring_format_hash`, `week`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_player_projection_values`
--

DROP TABLE IF EXISTS `league_player_projection_values`;

CREATE TABLE `league_player_projection_values` (
  `pid` varchar(25) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `lid` int(6) NOT NULL,

  `vorp_adj` decimal(5,2) DEFAULT NULL,
  `market_salary_adj` decimal(6,2) DEFAULT NULL,
  KEY `pid` (`pid`),
  UNIQUE KEY `player_value` (`pid`, `lid`, `week`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_format_player_projection_values`
--

DROP TABLE IF EXISTS `league_format_player_projection_values`;

CREATE TABLE `league_format_player_projection_values` (
  `pid` varchar(25) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `league_format_hash` varchar(64) NOT NULL,

  `vorp` decimal(5,2) DEFAULT NULL,
  `market_salary` decimal(6,2) DEFAULT NULL,
  KEY `pid` (`pid`),
  UNIQUE KEY `player_value` (`pid`, `league_format_hash`, `week`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
  `year` smallint(4) NOT NULL,
  `last_updated` int(11) DEFAULT NULL,
  PRIMARY KEY `uid` (`uid`),
  UNIQUE KEY `teamid` (`tid`,`week`,`year`),
  KEY `tid` (`tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rosters`
--

DROP TABLE IF EXISTS `rosters_players`;

CREATE TABLE `rosters_players` (
  `rid` int(11) NOT NULL,
  `slot` int(11) NOT NULL,
  `pid` varchar(25) NOT NULL,
  `pos` varchar(3) NOT NULL,
  `tag` tinyint(1) unsigned NOT NULL DEFAULT '1',
  `extensions` tinyint(1) unsigned NOT NULL DEFAULT '0',
  UNIQUE KEY `pid` (`rid`,`pid`),
  KEY `rid` (`rid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;

CREATE TABLE `teams` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `year` smallint(4) NOT NULL,
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
  UNIQUE KEY `team_year` (`uid`, `year`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `team_stats`
--

DROP TABLE IF EXISTS `team_stats`;

CREATE TABLE `team_stats` (
  `lid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `div` tinyint(1) DEFAULT NULL,
  `year` smallint(4) NOT NULL,

  `wins` tinyint(2) DEFAULT 0,
  `losses` tinyint(2) DEFAULT 0,
  `ties` tinyint(2) DEFAULT 0,

  `apWins` smallint(3) DEFAULT 0,
  `apLosses` smallint(3) DEFAULT 0,
  `apTies` smallint(3) DEFAULT 0,

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
  `pSlot16` decimal(6,2) DEFAULT 0,
  `pSlot17` decimal(6,2) DEFAULT 0,

  `pPosQB` decimal(6,2) DEFAULT 0,
  `pPosRB` decimal(6,2) DEFAULT 0,
  `pPosWR` decimal(6,2) DEFAULT 0,
  `pPosTE` decimal(6,2) DEFAULT 0,
  `pPosK` decimal(6,2) DEFAULT 0,
  `pPosDST` decimal(6,2) DEFAULT 0,

  UNIQUE KEY `team` (`tid`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trades`
--

DROP TABLE IF EXISTS `trades`;

CREATE TABLE `trades` (
  `uid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `propose_tid` int(6) NOT NULL,
  `accept_tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `userid` int(6) NOT NULL,
  `year` smallint(4) NOT NULL,
  `offered` int(11) NOT NULL,
  `cancelled` int(11) DEFAULT NULL,
  `accepted` int(11) DEFAULT NULL,
  `rejected` int(11) DEFAULT NULL,
  `vetoed` int(11) DEFAULT NULL,
  UNIQUE KEY `uid` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trade_releases`
--

DROP TABLE IF EXISTS `trade_releases`;

CREATE TABLE `trade_releases` (
  `tradeid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `pid` varchar(25) NOT NULL,
  KEY (`tradeid`),
  UNIQUE KEY `pid` (`tradeid`,`pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


-- --------------------------------------------------------

--
-- Table structure for table `trades_players`
--

DROP TABLE IF EXISTS `trades_players`;

CREATE TABLE `trades_players` (
  `tradeid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `pid` varchar(25) NOT NULL,
  KEY (`tradeid`),
  UNIQUE KEY `pid` (`tradeid`,`pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `trades_transactions`
--

DROP TABLE IF EXISTS `trades_transactions`;

CREATE TABLE `trades_transactions` (
  `tradeid` int(6) NOT NULL,
  `transactionid` int(6) NOT NULL,
  UNIQUE KEY `transaction` (`tradeid`,`transactionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_cutlist`
--

DROP TABLE IF EXISTS `league_cutlist`;

CREATE TABLE `league_cutlist` (
  `pid` varchar(25) NOT NULL,
  `tid` int(6) NOT NULL,
  `order` tinyint(2) NOT NULL,
  KEY `pid` (`pid`),
  KEY `teamid` (`tid`),
  UNIQUE KEY `tid_pid` (`tid`, `pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
  `pid` varchar(25) NOT NULL,
  `type` tinyint(2) NOT NULL,
  `value` int(4) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` smallint(4) NOT NULL,
  `timestamp` int(11) NOT NULL,
  `waiverid` int(11) DEFAULT NULL,
  UNIQUE KEY `uid` (`uid`),
  KEY `pid` (`pid`),
  KEY `teamid` (`tid`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL DEFAULT '',
  `password` varchar(60) NOT NULL DEFAULT '',
  `vbaseline` varchar(9) NOT NULL DEFAULT 'default',
  `watchlist` mediumtext,
  `lastvisit` datetime DEFAULT NULL,
  `phone` varchar(12) DEFAULT NULL,
  `text` tinyint(1) NOT NULL DEFAULT 1,
  `voice` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `waivers`
--

DROP TABLE IF EXISTS `waivers`;

CREATE TABLE `waivers` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `userid` int(6) NOT NULL,
  `pid` varchar(25) NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `waiver_release`
--

DROP TABLE IF EXISTS `waiver_releases`;

CREATE TABLE `waiver_releases` (
  `waiverid` int(11) NOT NULL,
  `pid` varchar(25) NOT NULL,
  KEY `waiverid` (`waiverid`),
  UNIQUE KEY `waiverid_pid` (`waiverid`, `pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `player_changelog`
--

DROP TABLE IF EXISTS `player_changelog`;

CREATE TABLE `player_changelog` (
  `uid` int NOT NULL AUTO_INCREMENT,
  `pid` varchar(25) NOT NULL,
  `prop` varchar(100) NOT NULL,
  `prev` varchar(400) NOT NULL,
  `new` varchar(400) DEFAULT NULL,
  `timestamp` int NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `field value` (`pid`,`prop`,`prev`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_plays`
--

DROP TABLE IF EXISTS `nfl_plays`;

CREATE TABLE `nfl_plays` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) NOT NULL,
  `sequence` int(10) DEFAULT NULL,
  `state` varchar(36) DEFAULT NULL,

  `week` tinyint(2) DEFAULT NULL,
  `dwn` int(1) DEFAULT NULL,
  `qtr` int(1) DEFAULT NULL,
  `year` smallint(4) NOT NULL,
  `seas_type` varchar(36) DEFAULT NULL, -- PRE, REG, POST

  `desc` text DEFAULT NULL,

  `ydl_num` int(4) DEFAULT NULL,
  `ydl_side` varchar(10) DEFAULT NULL,
  `ydl_start` varchar(10) DEFAULT NULL,     -- String indicating the start field position for a given play.
  `ydl_end` varchar(10) DEFAULT NULL,       -- String indicating the end field position for a given play.
  `ydl_100` int(3) DEFAULT NULL,            -- Numeric distance in the number of yards from the opponent's endzone for the posteam.

  `hash` varchar(1) DEFAULT NULL,           -- hash location, values: (L)eft hash, (R)ight hash or in-between (M)
  `mot` varchar(2) DEFAULT NULL,            -- motion, There are 2 types of motion: Pre-snap (P) which starts and stops before the snap and the more aggressive type of motion that is occurring during the snap (S). When both occur we mark 'PS'

  `ytg` int(3) DEFAULT NULL,                -- yards to go
  `yfog` int(3) DEFAULT NULL,               -- yards from own goal (1-99)

  `off_formation` varchar(100) DEFAULT NULL,
  `off_personnel` varchar(100) DEFAULT NULL,
  `def_personnel` varchar(36) DEFAULT NULL,
  `box_ngs` int(3) DEFAULT NULL,
  `pru_ngs` int(3) DEFAULT NULL,

  `drive_seq` int(4) DEFAULT NULL,                  -- drive count
  `drive_yds` int(3) DEFAULT NULL,
  `drive_play_count` int(3) DEFAULT NULL,           -- Numeric value of how many regular plays happened in a given drive.
  `drive_result` varchar(30) DEFAULT NULL,          -- drive result
  `drive_top` varchar(10) DEFAULT NULL,             -- Time of possession in a given drive.
  `drive_fds` int(2) DEFAULT NULL,                  -- Number of first downs in a given drive.
  `drive_inside20` tinyint(1) DEFAULT NULL,         -- Binary indicator if the offense was able to get inside the opponents 20 yard line.
  `drive_score` tinyint(1) DEFAULT NULL, -- Binary indicator the drive ended with a score.
  `drive_start_qtr` tinyint(1) DEFAULT NULL,       -- Numeric value indicating in which quarter the given drive has started.
  `drive_end_qtr` tinyint(1) DEFAULT NULL,         -- Numeric value indicating in which quarter the given drive has ended.
  `drive_yds_penalized` int(3) DEFAULT NULL,       -- Numeric value of how many yards the offense gained or lost through penalties in the given drive.
  `drive_start_transition` varchar(30) DEFAULT NULL,  -- String indicating how the offense got the ball.
  `drive_end_transition` varchar(30) DEFAULT NULL,    -- String indicating how the offense lost the ball.
  `drive_game_clock_start` varchar(10) DEFAULT NULL,   -- Game time at the beginning of a given drive.
  `drive_game_clock_end` varchar(10) DEFAULT NULL,     -- Game time at the end of a given drive.
  `drive_start_ydl` varchar(10) DEFAULT NULL,      -- String indicating where a given drive started consisting of team half and yard line number.
  `drive_end_ydl` varchar(10) DEFAULT NULL,        -- String indicating where a given drive ended consisting of team half and yard line number.
  `drive_start_play_id` int(10) DEFAULT NULL,      -- Play_id of the first play in the given drive.
  `drive_end_play_id` int(10) DEFAULT NULL,        -- Play_id of the last play in the given drive.

  `series_seq` int(3) DEFAULT NULL,                -- Starts at 1, each new first down increments, numbers shared across both teams NA: kickoffs, extra point/two point conversion attempts, non-plays, no posteam
  `series_suc` tinyint(1) DEFAULT NULL,            -- 1: scored touchdown, gained enough yards for first down.
  `series_result` varchar(100) DEFAULT NULL,       -- Possible values: First down, Touchdown, Opp touchdown, Field goal, Missed field goal, Safety, Turnover, Punt, Turnover on downs, QB kneel, End of half

  `gtg` tinyint(1) DEFAULT NULL,                    -- Binary indicator for whether or not the posteam is in a goal down situation.

  `score` tinyint(1) DEFAULT NULL,                     -- Binary indicator for whether or not a score occurred on the play.
  `score_type` varchar(10) DEFAULT NULL,               -- Scoring play type: FG, PAT, PAT2, SFTY, TD
  `score_team` varchar(4) DEFAULT NULL,                -- Scoring play team

  `timestamp` varchar(10) DEFAULT NULL,

  `play_clock` varchar(10) DEFAULT NULL,        -- Time on the playclock when the ball was snapped.

  `game_clock_start` varchar(10) DEFAULT NULL,  -- Time at start of play provided in string format as minutes:seconds remaining in the quarter.
  `game_clock_end` varchar(10) DEFAULT NULL,    -- Game time at the end of a given play.
  `sec_rem_qtr` int(4) DEFAULT NULL,            -- Numeric seconds remaining in the quarter.
  `sec_rem_half` int(4) DEFAULT NULL,           -- Numeric seconds remaining in the half.
  `sec_rem_gm` int(4) DEFAULT NULL,             -- Numeric seconds remaining in the game.

  `pos_team` varchar(4) DEFAULT NULL,
  `pos_team_id` varchar(36) DEFAULT NULL,

  `off` varchar(3) DEFAULT NULL,                    -- offense
  `def` varchar(3) DEFAULT NULL,                    -- defense

  `deleted` tinyint(1) DEFAULT NULL,
  `review` text DEFAULT NULL,

  `type` varchar(4) DEFAULT NULL,                   -- RUSH, PASS, FGXP, PUNT, KOFF, ONSD, NOPL, CONV
  `type_nfl` varchar(36) DEFAULT NULL,
  `type_ngs` text DEFAULT NULL,

  `next_play_type` varchar(36) DEFAULT NULL,

  `player_fuml` varchar(7) DEFAULT NULL,                -- fumbling player
  `player_fuml_gsis` varchar(36) DEFAULT NULL,          -- fumbling player gsis
  `bc` varchar(7) DEFAULT NULL,                 -- ball carrier
  `bc_gsis` varchar(36) DEFAULT NULL,           -- ball carrier gsis
  `psr` varchar(7) DEFAULT NULL,                -- passer
  `psr_gsis` varchar(36) DEFAULT NULL,          -- passer gsis
  `trg` varchar(7) DEFAULT NULL,                -- targeted player
  `trg_gsis` varchar(36) DEFAULT NULL,          -- targeted player gsis
  `intp` varchar(7) DEFAULT NULL,               -- intercepting player
  `intp_gsis` varchar(36) DEFAULT NULL,         -- intercepting player gsis

  `yds` tinyint(3) DEFAULT NULL,                -- yardage
  `yds_gained` tinyint(3) DEFAULT NULL,         -- yardage gained (or lost) by the possessing team, excluding yards gained via fumble recoveries and laterals

  `fum` tinyint(1) DEFAULT NULL,                -- fumble occured
  `fuml` tinyint(1) DEFAULT NULL,               -- fumble lost
  `int` tinyint(1) DEFAULT NULL,                -- interception
  `sk` tinyint(1) DEFAULT NULL,                 -- sack
  `succ` tinyint(1) DEFAULT NULL,               -- successful play
  `comp` tinyint(1) DEFAULT NULL,               -- completion
  `incomp` tinyint(1) DEFAULT NULL,             -- incompletion
  `trick` tinyint(1) DEFAULT NULL,              -- trick play
  `touchback` tinyint(1) DEFAULT NULL,          -- touchback
  `safety` tinyint(1) DEFAULT NULL,             -- safety
  `penalty` tinyint(1) DEFAULT NULL,            -- penalty
  `oob` tinyint(1) DEFAULT NULL,                -- 1 if play description contains ran ob, pushed ob, or sacked ob; 0 otherwise.
  `tfl` tinyint(1) DEFAULT NULL,                -- Binary indicator for whether or not a tackle for loss on a run play occurred.
  `rush` tinyint(1) DEFAULT NULL,               -- Binary indicator for if the play was a run.
  `pass` tinyint(1) DEFAULT NULL,               -- Binary indicator for if the play was a pass attempt (includes sacks).
  `solo_tk` tinyint(1) DEFAULT NULL,            -- Binary indicator if the play had a solo tackle (could be multiple due to fumbles).
  `assist_tk` tinyint(1) DEFAULT NULL,          -- Binary indicator for if an assist tackle occurred.

  `special` tinyint(1) DEFAULT NULL,                 -- special teams
  `special_type` varchar(10) DEFAULT NULL,            -- special teams play type

  `pen_team` varchar(3) DEFAULT NULL,           -- String abbreviation of the team with the penalty.
  `pen_yds` int(3) DEFAULT NULL,                -- Yards gained (or lost) by the posteam from the penalty.

  `td` tinyint(1) DEFAULT NULL,                 -- touchdown
  `ret_td` tinyint(1) DEFAULT NULL,             -- return touchdown
  `pass_td` tinyint(1) DEFAULT NULL,            -- passing touchdown
  `rush_td` tinyint(1) DEFAULT NULL,            -- rushing touchdown
  `td_tm` varchar(5) DEFAULT NULL,              -- touchdown team abbreviation

  `pass_yds` int(3) DEFAULT NULL,               -- Numeric yards by the passer_player_name, including yards gained in pass plays with laterals. This should equal official passing statistics.
  `recv_yds` int(3) DEFAULT NULL,               -- Numeric yards by the receiver_player_name, excluding yards gained in pass plays with laterals. This should equal official receiving statistics but could miss yards gained in pass plays with laterals. Please see the description of `lateral_receiver_player_name` for further information.
  `rush_yds` int(3) DEFAULT NULL,               -- Numeric yards by the rusher_player_name, excluding yards gained in rush plays with laterals. This should equal official rushing statistics but could miss yards gained in rush plays with laterals. Please see the description of `lateral_rusher_player_name` for further information.

  `dot` int(3) DEFAULT NULL,                    -- depth of target
  `tay` tinyint(1) DEFAULT NULL,                -- true air yards, Distance ball travels in the air from point of throw to a receivers hands; back of endzone or sideline.
  `yac` int(3) DEFAULT NULL,                    -- yard after catch
  `yaco` int(3) DEFAULT NULL,                   -- yards after contact
  `ret_yds` int(3) DEFAULT NULL,                -- return yardage
  `ret_tm` varchar(5) DEFAULT NULL,             -- return team abbrevation

  `sg` tinyint(1) DEFAULT NULL,                 -- shotgun
  `nh` tinyint(1) DEFAULT NULL,                 -- no huddle
  `pap` tinyint(1) DEFAULT NULL,                -- play action pass
  `qbd` tinyint(1) DEFAULT NULL,                -- QB dropped back on the play (pass attempt, sack, or scrambled).
  `qbk` tinyint(1) DEFAULT NULL,                -- QB took a knee.
  `qbs` tinyint(1) DEFAULT NULL,                -- QB spiked the ball.
  `qbru` tinyint(1) DEFAULT NULL,               -- QB run, a designed running play for the QB. These are only marked on runs by a natural QB where he lined up as a QB. Also, sneaks and kneel-downs are not counted.
  `sneak` tinyint(1) DEFAULT NULL,              -- QB sneak
  `scrm` tinyint(1) DEFAULT NULL,               -- QB scramble

  `qbp` tinyint(2) DEFAULT NULL,                -- QB pressure
  `qbhi` tinyint(2) DEFAULT NULL,               -- QB hit
  `qbhu` tinyint(2) DEFAULT NULL,               -- QB hurry

  `intw` tinyint(1) DEFAULT NULL,               -- interception worthy
  `cball` tinyint(1) DEFAULT NULL,              -- catchable ball, A pass in which an eligible receiver has the opportunity to get his hands on the football with reasonable movement, timing, and opportunity.
  `qbta` tinyint(1) DEFAULT NULL,               -- QB Throw Away
  `shov` tinyint(1) DEFAULT NULL,               -- Shovel/Touch Pass
  `side` tinyint(1) DEFAULT NULL,               -- Sideline pass, Balls outside of the field but catchable when the receiver extends body/arms.
  `high` tinyint(1) DEFAULT NULL,               -- Highlight pass, Perfect pass that only the receiver can reach. Features perfect placement in a tight window.

  `drp` tinyint(1) DEFAULT NULL,                -- dropped pass
  `cnb` tinyint(1) DEFAULT NULL,                -- contested ball, Passes into close coverage that involve a physical battle between receiver and defender for control of the ball.
  `crr` tinyint(1) DEFAULT NULL,                -- Created Reception, Difficult catches that require exceptional body control; hands; acrobatics, or any combination thereof.

  `mbt` tinyint(1) DEFAULT NULL,                -- missed or broken tackles
  `avsk` tinyint(1) DEFAULT NULL,               -- number of avoided sacks

  `run_location` varchar(10) DEFAULT NULL,      -- String indicator for location of run: left, middle, or right.
  `run_gap` varchar(10) DEFAULT NULL,           -- String indicator for line gap of run: end, guard, or tackle

  `option` varchar(3) DEFAULT NULL,             -- option play, values: RPO (run/pass), RUN (run/qbrun)
  `tlook` tinyint(1) DEFAULT NULL,              -- trick look

  `fd` tinyint(1) DEFAULT NULL,                 -- first down
  `fd_rush` tinyint(1) DEFAULT NULL,            -- Binary indicator for if a running play converted the first down.
  `fd_pass` tinyint(1) DEFAULT NULL,            -- Binary indicator for if a passing play converted the first down.
  `fd_penalty` tinyint(1) DEFAULT NULL,         -- Binary indicator for if a penalty converted the first down.

  `third_down_converted` tinyint(1) DEFAULT NULL,  -- Binary indicator for if the first down was converted on third down.
  `third_down_failed` tinyint(1) DEFAULT NULL,     -- Binary indicator for if the posteam failed to convert first down on third down.
  `fourth_down_converted` tinyint(1) DEFAULT NULL, -- Binary indicator for if the first down was converted on fourth down.
  `fourth_down_failed` tinyint(1) DEFAULT NULL,    -- Binary indicator for if the posteam failed to convert first down on fourth down.

  `htm` tinyint(1) DEFAULT NULL,                -- hindered throwing motion
  `zblz` tinyint(1) DEFAULT NULL,               -- zone blitz, at least one Off-Ball LB rushed the passer instead of a DL who dropped into coverage
  `stnt` tinyint(1) DEFAULT NULL,               -- stunt, when any two pass rushers cross, trading pass rush lanes on a passing down
  `oop` tinyint(1) DEFAULT NULL,                -- out of pocket pass
  `phyb` tinyint(1) DEFAULT NULL,               -- physical ball, Pass target takes significant punishment whether the pass is caught or not. Most 'Contested Balls' will also be a 'Physical Ball'.
  `bap` tinyint(1) DEFAULT NULL,                -- batted pass
  `fread` tinyint(1) DEFAULT NULL,              -- first read
  `scre` tinyint(1) DEFAULT NULL,               -- screen pass
  `pfp` tinyint(1) DEFAULT NULL,                -- pain free play, Ball carrier is only lightly touched by a defender on the field (ie QB slide) or runs out of bounds with little or no physical contact with the defender or sideline personnel/equipment. Includes TD's
  `qbsk` tinyint(1) DEFAULT NULL,               -- qb sack, QB was to blame for the sack: held ball too long; missed wide open receiver etc

  `ttscrm` decimal(3,1) DEFAULT NULL,           -- time to scramble
  `ttp` decimal(3,1) DEFAULT NULL,              -- time to pass
  `ttsk` decimal(3,1) DEFAULT NULL,             -- time to sack
  `ttpr` decimal(3,1) DEFAULT NULL,             -- time to pressure

  `back` tinyint(2) DEFAULT NULL,               -- number in backfield (wr, rb, te, fb)
  `xlm` tinyint(1) DEFAULT NULL,                -- extra men on the line, Number of players lined up on either side of the Offensive Tackles - usually a Tight End.
  `db` tinyint(2) DEFAULT NULL,                 -- number of defensive backs
  `box` tinyint(2) DEFAULT NULL,                -- number of defenders in the box
  `boxdb` tinyint(2) DEFAULT NULL,              -- number of dbs in the box
  `pru` tinyint(1) DEFAULT NULL,                -- pass rushers
  `blz` tinyint(1) DEFAULT NULL,                -- number of LB's and DB's blitzing
  `dblz` tinyint(1) DEFAULT NULL,               -- Number of DB's blitzing
  `oopd` varchar(2) DEFAULT NULL,               -- out of pocket pass details, Clean [C], Pressure [P], Designed [D], Designed Rollout [DR]
  `cov` tinyint(1) DEFAULT NULL,                -- coverage on target, Uncovered is 0, single coverage is 1, double is 2.

  `ep` decimal(22,20) DEFAULT NULL,             -- Using the scoring event probabilities, the estimated expected points with respect to the possession team for the given play.
  `epa` decimal(22,20) DEFAULT NULL,            -- Expected points added (EPA) by the posteam for the given play.
  `ep_succ` tinyint(1) DEFAULT NULL,            -- Binary indicator wheter epa > 0 in the given play.

  `total_home_epa` decimal(22,20) DEFAULT NULL,             -- Cumulative total EPA for the home team in the game so far.
  `total_away_epa` decimal(22,20) DEFAULT NULL,             -- Cumulative total EPA for the away team in the game so far.
  `total_home_rush_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total rushing EPA for the home team in the game so far.
  `total_away_rush_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total rushing EPA for the away team in the game so far.
  `total_home_pass_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total passing EPA for the home team in the game so far.
  `total_away_pass_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total passing EPA for the away team in the game so far.

  `qb_epa` decimal(22,20) DEFAULT NULL,                     -- Gives QB credit for EPA for up to the point where a receiver lost a fumble after a completed catch and makes EPA work more like passing yards on plays with fumbles.
  `air_epa` decimal(22,20) DEFAULT NULL,                    -- EPA from the air yards alone. For completions this represents the actual value provided through the air. For incompletions this represents the hypothetical value that could've been added through the air if the pass was completed.
  `yac_epa` decimal(22,20) DEFAULT NULL,                    -- EPA from the yards after catch alone. For completions this represents the actual value provided after the catch. For incompletions this represents the difference between the hypothetical air_epa and the play's raw observed EPA (how much the incomplete pass cost the posteam).
  `comp_air_epa` decimal(22,20) DEFAULT NULL,               -- EPA from the air yards alone only for completions.
  `comp_yac_epa` decimal(22,20) DEFAULT NULL,               -- EPA from the yards after catch alone only for completions.
  `xyac_epa` decimal(22,20) DEFAULT NULL,                   -- Expected value of EPA gained after the catch, starting from where the catch was made. Zero yards after the catch would be listed as zero EPA.
  `total_home_comp_air_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions air EPA for the home team in the game so far.
  `total_away_comp_air_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions air EPA for the away team in the game so far.
  `total_home_comp_yac_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions yac EPA for the home team in the game so far.
  `total_away_comp_yac_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions yac EPA for the away team in the game so far.
  `total_home_raw_air_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw air EPA for the home team in the game so far.
  `total_away_raw_air_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw air EPA for the away team in the game so far.
  `total_home_raw_yac_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw yac EPA for the home team in the game so far.
  `total_away_raw_yac_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw yac EPA for the away team in the game so far.

  `wp` decimal(22,20) DEFAULT NULL,             -- Estimated win probabiity for the posteam given the current situation at the start of the given play.
  `wpa` decimal(22,20) DEFAULT NULL,            -- Win probability added (WPA) for the posteam.
  `home_wp` decimal(22,20) DEFAULT NULL,        -- Estimated win probability for the home team.
  `away_wp` decimal(22,20) DEFAULT NULL,        -- Estimated win probability for the away team.
  `vegas_wpa` decimal(22,20) DEFAULT NULL,      -- Win probability added (WPA) for the posteam: spread_adjusted model.
  `vegas_home_wpa` decimal(22,20) DEFAULT NULL, -- Win probability added (WPA) for the home team: spread_adjusted model.
  `home_wp_post` decimal(22,20) DEFAULT NULL,   -- Estimated win probability for the home team at the end of the play.
  `away_wp_post` decimal(22,20) DEFAULT NULL,   -- Estimated win probability for the away team at the end of the play.
  `vegas_wp` decimal(22,20) DEFAULT NULL,       -- Estimated win probabiity for the posteam given the current situation at the start of the given play, incorporating pre-game Vegas line.
  `vegas_home_wp` decimal(22,20) DEFAULT NULL,  -- Estimated win probability for the home team incorporating pre-game Vegas line.
  `total_home_rush_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total rushing WPA for the home team in the game so far.
  `total_away_rush_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total rushing WPA for the away team in the game so far.
  `total_home_pass_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total passing WPA for the home team in the game so far.
  `total_away_pass_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total passing WPA for the away team in the game so far.
  `air_wpa` decimal(22,20) DEFAULT NULL,       -- WPA through the air (same logic as air_epa).
  `yac_wpa` decimal(22,20) DEFAULT NULL,       -- WPA from yards after the catch (same logic as yac_epa).
  `comp_air_wpa` decimal(22,20) DEFAULT NULL,  -- The air_wpa for completions only.
  `comp_yac_wpa` decimal(22,20) DEFAULT NULL,  -- The yac_wpa for completions only.
  `total_home_comp_air_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions air WPA for the home team in the game so far.
  `total_away_comp_air_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions air WPA for the away team in the game so far.
  `total_home_comp_yac_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions yac WPA for the home team in the game so far.
  `total_away_comp_yac_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions yac WPA for the away team in the game so far.
  `total_home_raw_air_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw air WPA for the home team in the game so far.
  `total_away_raw_air_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw air WPA for the away team in the game so far.
  `total_home_raw_yac_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw yac WPA for the home team in the game so far.
  `total_away_raw_yac_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw yac WPA for the away team in the game so far.

  `xyac_mean_yds` decimal(22,20) DEFAULT NULL,    -- Average expected yards after the catch based on where the ball was caught.
  `xyac_median_yds` decimal(22,20) DEFAULT NULL,  -- Median expected yards after the catch based on where the ball was caught.
  `xyac_succ_prob` decimal(22,20) DEFAULT NULL,   -- Probability play earns positive EPA (relative to where play started) based on where ball was caught.
  `xyac_fd_prob` decimal(22,20) DEFAULT NULL,     -- Probability play earns a first down based on where the ball was caught.

  `ep_att` tinyint(1) DEFAULT NULL,       -- Binary indicator for extra point attempt.
  `two_att` tinyint(1) DEFAULT NULL,      -- Binary indicator for two point conversion attempt.
  `fg_att` tinyint(1) DEFAULT NULL,       -- Binary indicator for field goal attempt.
  `kickoff_att` tinyint(1) DEFAULT NULL,     -- Binary indicator for kickoff.
  `punt_att` tinyint(1) DEFAULT NULL,        -- Binary indicator for punts.

  `fg_result` varchar(10) DEFAULT NULL,         -- String indicator for result of field goal attempt: made, missed, or blocked.
  `kick_distance` int(3) DEFAULT NULL,          -- Numeric distance in yards for kickoffs, field goals, and punts.
  `ep_result` varchar(10) DEFAULT NULL,         -- String indicator for the result of the extra point attempt: good, failed, blocked, safety (touchback in defensive endzone is 1 point apparently), or aborted.
  `tp_result` varchar(10) DEFAULT NULL,         -- String indicator for result of two point conversion attempt: success, failure, safety (touchback in defensive endzone is 1 point apparently), or return.
  `punt_blocked` tinyint(1) DEFAULT NULL,       -- Binary indicator for if the punt was blocked.

  `home_to_rem` tinyint(1) DEFAULT NULL,        -- Numeric timeouts remaining in the half for the home team.
  `away_to_rem` tinyint(1) DEFAULT NULL,        -- Numeric timeouts remaining in the half for the away team.
  `pos_to_rem` tinyint(1) DEFAULT NULL,         -- Number of timeouts remaining for the possession team.
  `def_to_rem` tinyint(1) DEFAULT NULL,         -- Number of timeouts remaining for the team on defense.
  `to` tinyint(1) DEFAULT NULL,                 -- Binary indicator for whether or not a timeout was called by either team.
  `to_team` varchar(3) DEFAULT NULL,            -- String abbreviation for which team called the timeout.

  `home_score` tinyint(2) DEFAULT NULL,             -- Score for the home team at the end of the play.
  `away_score` tinyint(2) DEFAULT NULL,             -- Score for the away team at the end of the play.
  `pos_score` tinyint(2) DEFAULT NULL,              -- Score the posteam at the start of the play.
  `def_score` tinyint(2) DEFAULT NULL,              -- Score the defteam at the start of the play.
  `score_diff` tinyint(2) DEFAULT NULL,             -- Score differential between the posteam and defteam at the start of the play.
  `pos_score_post` tinyint(2) DEFAULT NULL,         -- Score for the posteam at the end of the play.
  `def_score_post` tinyint(2) DEFAULT NULL,         -- Score for the defteam at the end of the play.
  `score_diff_post` tinyint(2) DEFAULT NULL,        -- Score differential between the posteam and defteam at the end of the play.

  `no_score_prob` tinyint(2) DEFAULT NULL,          -- Predicted probability of no score occurring for the rest of the half based on the expected points model.
  `opp_fg_prob` decimal(22,20) DEFAULT NULL,        -- Predicted probability of the defteam scoring a FG next.
  `opp_safety_prob` decimal(22,20) DEFAULT NULL,    -- Predicted probability of the defteam scoring a safety next.
  `opp_td_prob` decimal(22,20) DEFAULT NULL,        -- Predicted probability of the defteam scoring a TD next.
  `fg_prob` decimal(22,20) DEFAULT NULL,            -- Predicted probability of the posteam scoring a FG next.
  `safety_prob` decimal(22,20) DEFAULT NULL,        -- Predicted probability of the posteam scoring a safety next.
  `td_prob` decimal(22,20) DEFAULT NULL,            -- Predicted probability of the posteam scoring a TD next.
  `extra_point_prob` decimal(22,20) DEFAULT NULL,   -- Predicted probability of the posteam scoring an extra point.
  `two_conv_prob` decimal(22,20) DEFAULT NULL,      -- Predicted probability of the posteam scoring the two point conversion.

  `xpass_prob` decimal(21,20) DEFAULT NULL,         -- Probability of dropback scaled from 0 to 1.
  `pass_oe` decimal(22,20) DEFAULT NULL,            -- Dropback percent over expected on a given play scaled from 0 to 100.

  `cp` decimal(22,20) DEFAULT NULL,                 -- Numeric value indicating the probability for a complete pass based on comparable game situations.
  `cpoe` decimal(22,20) DEFAULT NULL,               -- For a single pass play this is 1 - cp when the pass was completed or 0 - cp when the pass was incomplete. Analyzed for a whole game or season an indicator for the passer how much over or under expectation his completion percentage was.

  `charted` tinyint(1) DEFAULT NULL,
  `updated` int(11) NOT NULL,
  UNIQUE KEY `gamePlay` (`esbid`,`playId`),
  KEY `esbid` (`esbid`),
  KEY `playId` (`playId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_play_stats`
--

DROP TABLE IF EXISTS `nfl_play_stats`;

CREATE TABLE `nfl_play_stats` (
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
  KEY `playId` (`playId`),
  UNIQUE KEY `esbid` (`esbid`,`playId`,`statId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_snaps`
--

DROP TABLE IF EXISTS `nfl_snaps`;

CREATE TABLE `nfl_snaps` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) NOT NULL,
  `nflId` int(10) NOT NULL comment 'ngs nflId/gsisItId',
  UNIQUE KEY `snap` (`playId`,`nflId`,`esbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_plays_current_week`
--

DROP TABLE IF EXISTS `nfl_plays_current_week`;

CREATE TABLE `nfl_plays_current_week` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) NOT NULL,
  `sequence` int(10) DEFAULT NULL,
  `state` varchar(36) DEFAULT NULL,

  `week` tinyint(2) DEFAULT NULL,
  `dwn` int(1) DEFAULT NULL,
  `qtr` int(1) DEFAULT NULL,
  `year` smallint(4) DEFAULT NULL,
  `seas_type` varchar(36) DEFAULT NULL, -- PRE, REG, POST

  `desc` text DEFAULT NULL,

  `ydl_num` int(4) DEFAULT NULL,
  `ydl_side` varchar(10) DEFAULT NULL,
  `ydl_start` varchar(10) DEFAULT NULL,     -- String indicating the start field position for a given play.
  `ydl_end` varchar(10) DEFAULT NULL,       -- String indicating the end field position for a given play.
  `ydl_100` int(3) DEFAULT NULL,            -- Numeric distance in the number of yards from the opponent's endzone for the posteam.

  `hash` varchar(1) DEFAULT NULL,           -- hash location, values: (L)eft hash, (R)ight hash or in-between (M)
  `mot` varchar(2) DEFAULT NULL,            -- motion, There are 2 types of motion: Pre-snap (P) which starts and stops before the snap and the more aggressive type of motion that is occurring during the snap (S). When both occur we mark 'PS'

  `ytg` int(3) DEFAULT NULL,                -- yards to go
  `yfog` int(3) DEFAULT NULL,               -- yards from own goal (1-99)

  `off_formation` varchar(100) DEFAULT NULL,
  `off_personnel` varchar(100) DEFAULT NULL,
  `def_personnel` varchar(36) DEFAULT NULL,
  `box_ngs` int(3) DEFAULT NULL,
  `pru_ngs` int(3) DEFAULT NULL,

  `drive_seq` int(4) DEFAULT NULL,                  -- drive count
  `drive_yds` int(3) DEFAULT NULL,
  `drive_play_count` int(3) DEFAULT NULL,           -- Numeric value of how many regular plays happened in a given drive.
  `drive_result` varchar(30) DEFAULT NULL,          -- drive result
  `drive_top` varchar(10) DEFAULT NULL,             -- Time of possession in a given drive.
  `drive_fds` int(2) DEFAULT NULL,                  -- Number of first downs in a given drive.
  `drive_inside20` tinyint(1) DEFAULT NULL,         -- Binary indicator if the offense was able to get inside the opponents 20 yard line.
  `drive_score` tinyint(1) DEFAULT NULL, -- Binary indicator the drive ended with a score.
  `drive_start_qtr` tinyint(1) DEFAULT NULL,       -- Numeric value indicating in which quarter the given drive has started.
  `drive_end_qtr` tinyint(1) DEFAULT NULL,         -- Numeric value indicating in which quarter the given drive has ended.
  `drive_yds_penalized` int(3) DEFAULT NULL,       -- Numeric value of how many yards the offense gained or lost through penalties in the given drive.
  `drive_start_transition` varchar(30) DEFAULT NULL,  -- String indicating how the offense got the ball.
  `drive_end_transition` varchar(30) DEFAULT NULL,    -- String indicating how the offense lost the ball.
  `drive_game_clock_start` varchar(10) DEFAULT NULL,   -- Game time at the beginning of a given drive.
  `drive_game_clock_end` varchar(10) DEFAULT NULL,     -- Game time at the end of a given drive.
  `drive_start_ydl` varchar(10) DEFAULT NULL,      -- String indicating where a given drive started consisting of team half and yard line number.
  `drive_end_ydl` varchar(10) DEFAULT NULL,        -- String indicating where a given drive ended consisting of team half and yard line number.
  `drive_start_play_id` int(10) DEFAULT NULL,      -- Play_id of the first play in the given drive.
  `drive_end_play_id` int(10) DEFAULT NULL,        -- Play_id of the last play in the given drive.

  `series_seq` int(3) DEFAULT NULL,                -- Starts at 1, each new first down increments, numbers shared across both teams NA: kickoffs, extra point/two point conversion attempts, non-plays, no posteam
  `series_suc` tinyint(1) DEFAULT NULL,            -- 1: scored touchdown, gained enough yards for first down.
  `series_result` varchar(100) DEFAULT NULL,       -- Possible values: First down, Touchdown, Opp touchdown, Field goal, Missed field goal, Safety, Turnover, Punt, Turnover on downs, QB kneel, End of half

  `gtg` tinyint(1) DEFAULT NULL,                    -- Binary indicator for whether or not the posteam is in a goal down situation.

  `score` tinyint(1) DEFAULT NULL,                     -- Binary indicator for whether or not a score occurred on the play.
  `score_type` varchar(10) DEFAULT NULL,               -- Scoring play type: FG, PAT, PAT2, SFTY, TD
  `score_team` varchar(4) DEFAULT NULL,                -- Scoring play team

  `timestamp` varchar(10) DEFAULT NULL,

  `play_clock` varchar(10) DEFAULT NULL,        -- Time on the playclock when the ball was snapped.

  `game_clock_start` varchar(10) DEFAULT NULL,  -- Time at start of play provided in string format as minutes:seconds remaining in the quarter.
  `game_clock_end` varchar(10) DEFAULT NULL,    -- Game time at the end of a given play.
  `sec_rem_qtr` int(4) DEFAULT NULL,            -- Numeric seconds remaining in the quarter.
  `sec_rem_half` int(4) DEFAULT NULL,           -- Numeric seconds remaining in the half.
  `sec_rem_gm` int(4) DEFAULT NULL,             -- Numeric seconds remaining in the game.

  `pos_team` varchar(4) DEFAULT NULL,
  `pos_team_id` varchar(36) DEFAULT NULL,

  `off` varchar(3) DEFAULT NULL,                    -- offense
  `def` varchar(3) DEFAULT NULL,                    -- defense

  `deleted` tinyint(1) DEFAULT NULL,
  `review` text DEFAULT NULL,

  `type` varchar(4) DEFAULT NULL,                   -- RUSH, PASS, FGXP, PUNT, KOFF, ONSD, NOPL, CONV
  `type_nfl` varchar(36) DEFAULT NULL,
  `type_ngs` text DEFAULT NULL,

  `next_play_type` varchar(36) DEFAULT NULL,

  `player_fuml` varchar(7) DEFAULT NULL,                -- fumbling player
  `player_fuml_gsis` varchar(36) DEFAULT NULL,          -- fumbling player gsis
  `bc` varchar(7) DEFAULT NULL,                 -- ball carrier
  `bc_gsis` varchar(36) DEFAULT NULL,           -- ball carrier gsis
  `psr` varchar(7) DEFAULT NULL,                -- passer
  `psr_gsis` varchar(36) DEFAULT NULL,          -- passer gsis
  `trg` varchar(7) DEFAULT NULL,                -- targeted player
  `trg_gsis` varchar(36) DEFAULT NULL,          -- targeted player gsis
  `intp` varchar(7) DEFAULT NULL,               -- intercepting player
  `intp_gsis` varchar(36) DEFAULT NULL,         -- intercepting player gsis

  `yds` varchar(3) DEFAULT NULL,                -- yardage
  `yds_gained` varchar(3) DEFAULT NULL,         -- yardage gained (or lost) by the possessing team, excluding yards gained via fumble recoveries and laterals

  `fum` tinyint(1) DEFAULT NULL,                -- fumble occured
  `fuml` tinyint(1) DEFAULT NULL,               -- fumble lost
  `int` tinyint(1) DEFAULT NULL,                -- interception
  `sk` tinyint(1) DEFAULT NULL,                 -- sack
  `succ` tinyint(1) DEFAULT NULL,               -- successful play
  `comp` tinyint(1) DEFAULT NULL,               -- completion
  `incomp` tinyint(1) DEFAULT NULL,             -- incompletion
  `trick` tinyint(1) DEFAULT NULL,              -- trick play
  `touchback` tinyint(1) DEFAULT NULL,          -- touchback
  `safety` tinyint(1) DEFAULT NULL,             -- safety
  `penalty` tinyint(1) DEFAULT NULL,            -- penalty
  `oob` tinyint(1) DEFAULT NULL,                -- 1 if play description contains ran ob, pushed ob, or sacked ob; 0 otherwise.
  `tfl` tinyint(1) DEFAULT NULL,                -- Binary indicator for whether or not a tackle for loss on a run play occurred.
  `rush` tinyint(1) DEFAULT NULL,               -- Binary indicator for if the play was a run.
  `pass` tinyint(1) DEFAULT NULL,               -- Binary indicator for if the play was a pass attempt (includes sacks).
  `solo_tk` tinyint(1) DEFAULT NULL,            -- Binary indicator if the play had a solo tackle (could be multiple due to fumbles).
  `assist_tk` tinyint(1) DEFAULT NULL,          -- Binary indicator for if an assist tackle occurred.

  `special` tinyint(1) DEFAULT NULL,                 -- special teams
  `special_type` varchar(10) DEFAULT NULL,            -- special teams play type

  `pen_team` varchar(3) DEFAULT NULL,           -- String abbreviation of the team with the penalty.
  `pen_yds` int(3) DEFAULT NULL,                -- Yards gained (or lost) by the posteam from the penalty.

  `td` tinyint(1) DEFAULT NULL,                 -- touchdown
  `ret_td` tinyint(1) DEFAULT NULL,             -- return touchdown
  `pass_td` tinyint(1) DEFAULT NULL,            -- passing touchdown
  `rush_td` tinyint(1) DEFAULT NULL,            -- rushing touchdown
  `td_tm` varchar(5) DEFAULT NULL,              -- touchdown team abbreviation

  `pass_yds` int(3) DEFAULT NULL,               -- Numeric yards by the passer_player_name, including yards gained in pass plays with laterals. This should equal official passing statistics.
  `recv_yds` int(3) DEFAULT NULL,               -- Numeric yards by the receiver_player_name, excluding yards gained in pass plays with laterals. This should equal official receiving statistics but could miss yards gained in pass plays with laterals. Please see the description of `lateral_receiver_player_name` for further information.
  `rush_yds` int(3) DEFAULT NULL,               -- Numeric yards by the rusher_player_name, excluding yards gained in rush plays with laterals. This should equal official rushing statistics but could miss yards gained in rush plays with laterals. Please see the description of `lateral_rusher_player_name` for further information.

  `dot` int(3) DEFAULT NULL,                    -- depth of target
  `tay` tinyint(1) DEFAULT NULL,                -- true air yards, Distance ball travels in the air from point of throw to a receivers hands; back of endzone or sideline.
  `yac` int(3) DEFAULT NULL,                    -- yard after catch
  `yaco` int(3) DEFAULT NULL,                   -- yards after contact
  `ret_yds` int(3) DEFAULT NULL,                -- return yardage
  `ret_tm` varchar(5) DEFAULT NULL,             -- return team abbrevation

  `sg` tinyint(1) DEFAULT NULL,                 -- shotgun
  `nh` tinyint(1) DEFAULT NULL,                 -- no huddle
  `pap` tinyint(1) DEFAULT NULL,                -- play action pass
  `qbd` tinyint(1) DEFAULT NULL,                -- QB dropped back on the play (pass attempt, sack, or scrambled).
  `qbk` tinyint(1) DEFAULT NULL,                -- QB took a knee.
  `qbs` tinyint(1) DEFAULT NULL,                -- QB spiked the ball.
  `qbru` tinyint(1) DEFAULT NULL,               -- QB run, a designed running play for the QB. These are only marked on runs by a natural QB where he lined up as a QB. Also, sneaks and kneel-downs are not counted.
  `sneak` tinyint(1) DEFAULT NULL,              -- QB sneak
  `scrm` tinyint(1) DEFAULT NULL,               -- QB scramble

  `qbp` tinyint(2) DEFAULT NULL,                -- QB pressure
  `qbhi` tinyint(2) DEFAULT NULL,               -- QB hit
  `qbhu` tinyint(2) DEFAULT NULL,               -- QB hurry

  `intw` tinyint(1) DEFAULT NULL,               -- interception worthy
  `cball` tinyint(1) DEFAULT NULL,              -- catchable ball, A pass in which an eligible receiver has the opportunity to get his hands on the football with reasonable movement, timing, and opportunity.
  `qbta` tinyint(1) DEFAULT NULL,               -- QB Throw Away
  `shov` tinyint(1) DEFAULT NULL,               -- Shovel/Touch Pass
  `side` tinyint(1) DEFAULT NULL,               -- Sideline pass, Balls outside of the field but catchable when the receiver extends body/arms.
  `high` tinyint(1) DEFAULT NULL,               -- Highlight pass, Perfect pass that only the receiver can reach. Features perfect placement in a tight window.

  `drp` tinyint(1) DEFAULT NULL,                -- dropped pass
  `cnb` tinyint(1) DEFAULT NULL,                -- contested ball, Passes into close coverage that involve a physical battle between receiver and defender for control of the ball.
  `crr` tinyint(1) DEFAULT NULL,                -- Created Reception, Difficult catches that require exceptional body control; hands; acrobatics, or any combination thereof.

  `mbt` tinyint(1) DEFAULT NULL,                -- missed or broken tackles
  `avsk` tinyint(1) DEFAULT NULL,               -- number of avoided sacks

  `run_location` varchar(10) DEFAULT NULL,      -- String indicator for location of run: left, middle, or right.
  `run_gap` varchar(10) DEFAULT NULL,           -- String indicator for line gap of run: end, guard, or tackle

  `option` varchar(3) DEFAULT NULL,             -- option play, values: RPO (run/pass), RUN (run/qbrun)
  `tlook` tinyint(1) DEFAULT NULL,              -- trick look

  `fd` tinyint(1) DEFAULT NULL,                 -- first down
  `fd_rush` tinyint(1) DEFAULT NULL,            -- Binary indicator for if a running play converted the first down.
  `fd_pass` tinyint(1) DEFAULT NULL,            -- Binary indicator for if a passing play converted the first down.
  `fd_penalty` tinyint(1) DEFAULT NULL,         -- Binary indicator for if a penalty converted the first down.

  `third_down_converted` tinyint(1) DEFAULT NULL,  -- Binary indicator for if the first down was converted on third down.
  `third_down_failed` tinyint(1) DEFAULT NULL,     -- Binary indicator for if the posteam failed to convert first down on third down.
  `fourth_down_converted` tinyint(1) DEFAULT NULL, -- Binary indicator for if the first down was converted on fourth down.
  `fourth_down_failed` tinyint(1) DEFAULT NULL,    -- Binary indicator for if the posteam failed to convert first down on fourth down.

  `htm` tinyint(1) DEFAULT NULL,                -- hindered throwing motion
  `zblz` tinyint(1) DEFAULT NULL,               -- zone blitz, at least one Off-Ball LB rushed the passer instead of a DL who dropped into coverage
  `stnt` tinyint(1) DEFAULT NULL,               -- stunt, when any two pass rushers cross, trading pass rush lanes on a passing down
  `oop` tinyint(1) DEFAULT NULL,                -- out of pocket pass
  `phyb` tinyint(1) DEFAULT NULL,               -- physical ball, Pass target takes significant punishment whether the pass is caught or not. Most 'Contested Balls' will also be a 'Physical Ball'.
  `bap` tinyint(1) DEFAULT NULL,                -- batted pass
  `fread` tinyint(1) DEFAULT NULL,              -- first read
  `scre` tinyint(1) DEFAULT NULL,               -- screen pass
  `pfp` tinyint(1) DEFAULT NULL,                -- pain free play, Ball carrier is only lightly touched by a defender on the field (ie QB slide) or runs out of bounds with little or no physical contact with the defender or sideline personnel/equipment. Includes TD's
  `qbsk` tinyint(1) DEFAULT NULL,               -- qb sack, QB was to blame for the sack: held ball too long; missed wide open receiver etc

  `ttscrm` decimal(3,1) DEFAULT NULL,           -- time to scramble
  `ttp` decimal(3,1) DEFAULT NULL,              -- time to pass
  `ttsk` decimal(3,1) DEFAULT NULL,             -- time to sack
  `ttpr` decimal(3,1) DEFAULT NULL,             -- time to pressure

  `back` tinyint(2) DEFAULT NULL,               -- number in backfield (wr, rb, te, fb)
  `xlm` tinyint(1) DEFAULT NULL,                -- extra men on the line, Number of players lined up on either side of the Offensive Tackles - usually a Tight End.
  `db` tinyint(2) DEFAULT NULL,                 -- number of defensive backs
  `box` tinyint(2) DEFAULT NULL,                -- number of defenders in the box
  `boxdb` tinyint(2) DEFAULT NULL,              -- number of dbs in the box
  `pru` tinyint(1) DEFAULT NULL,                -- pass rushers
  `blz` tinyint(1) DEFAULT NULL,                -- number of LB's and DB's blitzing
  `dblz` tinyint(1) DEFAULT NULL,               -- Number of DB's blitzing
  `oopd` varchar(2) DEFAULT NULL,               -- out of pocket pass details, Clean [C], Pressure [P], Designed [D], Designed Rollout [DR]
  `cov` tinyint(1) DEFAULT NULL,                -- coverage on target, Uncovered is 0, single coverage is 1, double is 2.

  `ep` decimal(22,20) DEFAULT NULL,             -- Using the scoring event probabilities, the estimated expected points with respect to the possession team for the given play.
  `epa` decimal(22,20) DEFAULT NULL,            -- Expected points added (EPA) by the posteam for the given play.
  `ep_succ` tinyint(1) DEFAULT NULL,            -- Binary indicator wheter epa > 0 in the given play.

  `total_home_epa` decimal(22,20) DEFAULT NULL,             -- Cumulative total EPA for the home team in the game so far.
  `total_away_epa` decimal(22,20) DEFAULT NULL,             -- Cumulative total EPA for the away team in the game so far.
  `total_home_rush_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total rushing EPA for the home team in the game so far.
  `total_away_rush_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total rushing EPA for the away team in the game so far.
  `total_home_pass_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total passing EPA for the home team in the game so far.
  `total_away_pass_epa` decimal(22,20) DEFAULT NULL,        -- Cumulative total passing EPA for the away team in the game so far.

  `qb_epa` decimal(22,20) DEFAULT NULL,                     -- Gives QB credit for EPA for up to the point where a receiver lost a fumble after a completed catch and makes EPA work more like passing yards on plays with fumbles.
  `air_epa` decimal(22,20) DEFAULT NULL,                    -- EPA from the air yards alone. For completions this represents the actual value provided through the air. For incompletions this represents the hypothetical value that could've been added through the air if the pass was completed.
  `yac_epa` decimal(22,20) DEFAULT NULL,                    -- EPA from the yards after catch alone. For completions this represents the actual value provided after the catch. For incompletions this represents the difference between the hypothetical air_epa and the play's raw observed EPA (how much the incomplete pass cost the posteam).
  `comp_air_epa` decimal(22,20) DEFAULT NULL,               -- EPA from the air yards alone only for completions.
  `comp_yac_epa` decimal(22,20) DEFAULT NULL,               -- EPA from the yards after catch alone only for completions.
  `xyac_epa` decimal(22,20) DEFAULT NULL,                   -- Expected value of EPA gained after the catch, starting from where the catch was made. Zero yards after the catch would be listed as zero EPA.
  `total_home_comp_air_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions air EPA for the home team in the game so far.
  `total_away_comp_air_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions air EPA for the away team in the game so far.
  `total_home_comp_yac_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions yac EPA for the home team in the game so far.
  `total_away_comp_yac_epa` decimal(22,20) DEFAULT NULL,    -- Cumulative total completions yac EPA for the away team in the game so far.
  `total_home_raw_air_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw air EPA for the home team in the game so far.
  `total_away_raw_air_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw air EPA for the away team in the game so far.
  `total_home_raw_yac_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw yac EPA for the home team in the game so far.
  `total_away_raw_yac_epa` decimal(22,20) DEFAULT NULL,     -- Cumulative total raw yac EPA for the away team in the game so far.

  `wp` decimal(22,20) DEFAULT NULL,             -- Estimated win probabiity for the posteam given the current situation at the start of the given play.
  `wpa` decimal(22,20) DEFAULT NULL,            -- Win probability added (WPA) for the posteam.
  `home_wp` decimal(22,20) DEFAULT NULL,        -- Estimated win probability for the home team.
  `away_wp` decimal(22,20) DEFAULT NULL,        -- Estimated win probability for the away team.
  `vegas_wpa` decimal(22,20) DEFAULT NULL,      -- Win probability added (WPA) for the posteam: spread_adjusted model.
  `vegas_home_wpa` decimal(22,20) DEFAULT NULL, -- Win probability added (WPA) for the home team: spread_adjusted model.
  `home_wp_post` decimal(22,20) DEFAULT NULL,   -- Estimated win probability for the home team at the end of the play.
  `away_wp_post` decimal(22,20) DEFAULT NULL,   -- Estimated win probability for the away team at the end of the play.
  `vegas_wp` decimal(22,20) DEFAULT NULL,       -- Estimated win probabiity for the posteam given the current situation at the start of the given play, incorporating pre-game Vegas line.
  `vegas_home_wp` decimal(22,20) DEFAULT NULL,  -- Estimated win probability for the home team incorporating pre-game Vegas line.
  `total_home_rush_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total rushing WPA for the home team in the game so far.
  `total_away_rush_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total rushing WPA for the away team in the game so far.
  `total_home_pass_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total passing WPA for the home team in the game so far.
  `total_away_pass_wpa` decimal(22,20) DEFAULT NULL, -- Cumulative total passing WPA for the away team in the game so far.
  `air_wpa` decimal(22,20) DEFAULT NULL,       -- WPA through the air (same logic as air_epa).
  `yac_wpa` decimal(22,20) DEFAULT NULL,       -- WPA from yards after the catch (same logic as yac_epa).
  `comp_air_wpa` decimal(22,20) DEFAULT NULL,  -- The air_wpa for completions only.
  `comp_yac_wpa` decimal(22,20) DEFAULT NULL,  -- The yac_wpa for completions only.
  `total_home_comp_air_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions air WPA for the home team in the game so far.
  `total_away_comp_air_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions air WPA for the away team in the game so far.
  `total_home_comp_yac_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions yac WPA for the home team in the game so far.
  `total_away_comp_yac_wpa` decimal(22,20) DEFAULT NULL,      -- Cumulative total completions yac WPA for the away team in the game so far.
  `total_home_raw_air_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw air WPA for the home team in the game so far.
  `total_away_raw_air_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw air WPA for the away team in the game so far.
  `total_home_raw_yac_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw yac WPA for the home team in the game so far.
  `total_away_raw_yac_wpa` decimal(22,20) DEFAULT NULL,       -- Cumulative total raw yac WPA for the away team in the game so far.

  `xyac_mean_yds` decimal(22,20) DEFAULT NULL,    -- Average expected yards after the catch based on where the ball was caught.
  `xyac_median_yds` decimal(22,20) DEFAULT NULL,  -- Median expected yards after the catch based on where the ball was caught.
  `xyac_succ_prob` decimal(22,20) DEFAULT NULL,   -- Probability play earns positive EPA (relative to where play started) based on where ball was caught.
  `xyac_fd_prob` decimal(22,20) DEFAULT NULL,     -- Probability play earns a first down based on where the ball was caught.

  `ep_att` tinyint(1) DEFAULT NULL,       -- Binary indicator for extra point attempt.
  `two_att` tinyint(1) DEFAULT NULL,      -- Binary indicator for two point conversion attempt.
  `fg_att` tinyint(1) DEFAULT NULL,       -- Binary indicator for field goal attempt.
  `kickoff_att` tinyint(1) DEFAULT NULL,     -- Binary indicator for kickoff.
  `punt_att` tinyint(1) DEFAULT NULL,        -- Binary indicator for punts.

  `fg_result` varchar(10) DEFAULT NULL,         -- String indicator for result of field goal attempt: made, missed, or blocked.
  `kick_distance` int(3) DEFAULT NULL,          -- Numeric distance in yards for kickoffs, field goals, and punts.
  `ep_result` varchar(10) DEFAULT NULL,         -- String indicator for the result of the extra point attempt: good, failed, blocked, safety (touchback in defensive endzone is 1 point apparently), or aborted.
  `tp_result` varchar(10) DEFAULT NULL,         -- String indicator for result of two point conversion attempt: success, failure, safety (touchback in defensive endzone is 1 point apparently), or return.
  `punt_blocked` tinyint(1) DEFAULT NULL,       -- Binary indicator for if the punt was blocked.

  `home_to_rem` tinyint(1) DEFAULT NULL,        -- Numeric timeouts remaining in the half for the home team.
  `away_to_rem` tinyint(1) DEFAULT NULL,        -- Numeric timeouts remaining in the half for the away team.
  `pos_to_rem` tinyint(1) DEFAULT NULL,         -- Number of timeouts remaining for the possession team.
  `def_to_rem` tinyint(1) DEFAULT NULL,         -- Number of timeouts remaining for the team on defense.
  `to` tinyint(1) DEFAULT NULL,                 -- Binary indicator for whether or not a timeout was called by either team.
  `to_team` varchar(3) DEFAULT NULL,            -- String abbreviation for which team called the timeout.

  `home_score` tinyint(2) DEFAULT NULL,             -- Score for the home team at the end of the play.
  `away_score` tinyint(2) DEFAULT NULL,             -- Score for the away team at the end of the play.
  `pos_score` tinyint(2) DEFAULT NULL,              -- Score the posteam at the start of the play.
  `def_score` tinyint(2) DEFAULT NULL,              -- Score the defteam at the start of the play.
  `score_diff` tinyint(2) DEFAULT NULL,             -- Score differential between the posteam and defteam at the start of the play.
  `pos_score_post` tinyint(2) DEFAULT NULL,         -- Score for the posteam at the end of the play.
  `def_score_post` tinyint(2) DEFAULT NULL,         -- Score for the defteam at the end of the play.
  `score_diff_post` tinyint(2) DEFAULT NULL,        -- Score differential between the posteam and defteam at the end of the play.

  `no_score_prob` tinyint(2) DEFAULT NULL,          -- Predicted probability of no score occurring for the rest of the half based on the expected points model.
  `opp_fg_prob` decimal(22,20) DEFAULT NULL,        -- Predicted probability of the defteam scoring a FG next.
  `opp_safety_prob` decimal(22,20) DEFAULT NULL,    -- Predicted probability of the defteam scoring a safety next.
  `opp_td_prob` decimal(22,20) DEFAULT NULL,        -- Predicted probability of the defteam scoring a TD next.
  `fg_prob` decimal(22,20) DEFAULT NULL,            -- Predicted probability of the posteam scoring a FG next.
  `safety_prob` decimal(22,20) DEFAULT NULL,        -- Predicted probability of the posteam scoring a safety next.
  `td_prob` decimal(22,20) DEFAULT NULL,            -- Predicted probability of the posteam scoring a TD next.
  `extra_point_prob` decimal(22,20) DEFAULT NULL,   -- Predicted probability of the posteam scoring an extra point.
  `two_conv_prob` decimal(22,20) DEFAULT NULL,      -- Predicted probability of the posteam scoring the two point conversion.

  `xpass_prob` decimal(21,20) DEFAULT NULL,         -- Probability of dropback scaled from 0 to 1.
  `pass_oe` decimal(22,20) DEFAULT NULL,            -- Dropback percent over expected on a given play scaled from 0 to 100.

  `cp` decimal(22,20) DEFAULT NULL,                 -- Numeric value indicating the probability for a complete pass based on comparable game situations.
  `cpoe` decimal(22,20) DEFAULT NULL,               -- For a single pass play this is 1 - cp when the pass was completed or 0 - cp when the pass was incomplete. Analyzed for a whole game or season an indicator for the passer how much over or under expectation his completion percentage was.

  `charted` tinyint(1) DEFAULT NULL,
  `updated` int(11) NOT NULL,
  UNIQUE KEY `gamePlay` (`esbid`,`playId`),
  KEY `esbid` (`esbid`),
  KEY `playId` (`playId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_play_stats_current_week`
--

DROP TABLE IF EXISTS `nfl_play_stats_current_week`;

CREATE TABLE `nfl_play_stats_current_week` (
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
  KEY `playId` (`playId`),
  UNIQUE KEY `esbid` (`esbid`,`playId`,`statId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_snaps`
--

DROP TABLE IF EXISTS `nfl_snaps_current_week`;

CREATE TABLE `nfl_snaps_current_week` (
  `esbid` int(10) NOT NULL,
  `playId` int(10) NOT NULL,
  `nflId` int(10) NOT NULL,
  KEY `playId` (`playId`),
  UNIQUE KEY `snap` (`playId`,`nflId`,`esbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `practice`
--

DROP TABLE IF EXISTS `practice`;

CREATE TABLE `practice` (
  `pid` varchar(25) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` smallint(4) NOT NULL,
  `status` varchar(100) DEFAULT NULL,
  `inj` varchar(100) DEFAULT NULL,
  `m` varchar(20) DEFAULT NULL,
  `tu` varchar(20) DEFAULT NULL,
  `w` varchar(20) DEFAULT NULL,
  `th` varchar(20) DEFAULT NULL,
  `f` varchar(20) DEFAULT NULL,
  `s` varchar(20) DEFAULT NULL,
  `su` varchar(20) DEFAULT NULL,
  UNIQUE KEY `pid` (`pid`, `week`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `player_gamelogs`
--

DROP TABLE IF EXISTS `player_gamelogs`;

CREATE TABLE `player_gamelogs` (
  `esbid` int(10) NOT NULL,
  `pid` varchar(25) NOT NULL,
  `tm` varchar(3) NOT NULL,
  `opp` varchar(3) NOT NULL,
  `pos` varchar(3) NOT NULL,

  `jnum` tinyint(2) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `started` tinyint(1) DEFAULT NULL,

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
  UNIQUE KEY `pid` (`pid`, `esbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `player_snaps_game`
--

DROP TABLE IF EXISTS `player_snaps_game`;

CREATE TABLE `player_snaps_game` (
  `esbid` int(10) NOT NULL,
  `pid` varchar(25) NOT NULL,

  `snaps_off` tinyint(3) unsigned DEFAULT NULL comment 'Offensive snaps',
  `snaps_def` tinyint(3) unsigned DEFAULT NULL comment 'Defensive snaps',
  `snaps_st` tinyint(3) unsigned DEFAULT NULL comment 'Special teams snaps',
  `snaps_pass` tinyint(3) unsigned DEFAULT NULL comment 'Passing snaps (Pass attempts, sacks, scrambles)',
  `snaps_run` tinyint(3) unsigned DEFAULT NULL comment 'Rushing snaps',
  UNIQUE KEY `pid` (`pid`, `esbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `player_seasonlogs`
--

DROP TABLE IF EXISTS `player_seasonlogs`;

CREATE TABLE `player_seasonlogs` (
  `pid` varchar(25) NOT NULL,
  `year` smallint(4) NOT NULL,
  `seas_type` varchar(10) NOT NULL, -- PRE, REG, POST
  `pos` varchar(3) NOT NULL,


  `pa` smallint(4) DEFAULT 0,
  `pc` smallint(4) DEFAULT 0,
  `py` int(4) DEFAULT 0,
  `ints` tinyint(2) DEFAULT 0,
  `tdp` tinyint(2) DEFAULT 0,

  `ra` smallint(3) DEFAULT 0,
  `ry` int(4) DEFAULT 0,
  `tdr` tinyint(2) DEFAULT 0,
  `fuml` tinyint(2) DEFAULT 0,

  `trg` smallint(3) DEFAULT 0,
  `rec` smallint(3) DEFAULT 0,
  `recy` int(4) DEFAULT 0,
  `tdrec` tinyint(2) DEFAULT 0,

  `twoptc` tinyint(2) DEFAULT 0,

  `prtd` tinyint(2) DEFAULT 0,
  `krtd` tinyint(2) DEFAULT 0,

  `snp` smallint(4) DEFAULT 0,

  `fgm` smallint(3) DEFAULT 0,
  `fgy` int(5) DEFAULT 0,
  `fg19` tinyint(2) DEFAULT 0,
  `fg29` tinyint(2) DEFAULT 0,
  `fg39` tinyint(2) DEFAULT 0,
  `fg49` tinyint(2) DEFAULT 0,
  `fg50` tinyint(2) DEFAULT 0,
  `xpm` smallint(3) DEFAULT 0,

  `dsk` smallint(3) DEFAULT 0,
  `dint` smallint(3) DEFAULT 0,
  `dff` smallint(3) DEFAULT 0,
  `drf` smallint(3) DEFAULT 0,
  `dtno` smallint(3) DEFAULT 0,
  `dfds` smallint(3) DEFAULT 0,
  `dpa` smallint(3) DEFAULT 0,
  `dya` int(5) DEFAULT 0,
  `dblk` smallint(3) DEFAULT 0,
  `dsf` smallint(3) DEFAULT 0,
  `dtpr` smallint(3) DEFAULT 0,
  `dtd` smallint(3) DEFAULT 0,
  UNIQUE KEY `pid` (`pid`, `year`, `seas_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_format_player_gamelogs`
--

DROP TABLE IF EXISTS `league_format_player_gamelogs`;

CREATE TABLE `league_format_player_gamelogs` (
  `pid` varchar(25) NOT NULL,
  `esbid` int(10) NOT NULL,

  `league_format_hash` varchar(64) NOT NULL,
  `points` decimal(4,1) DEFAULT NULL,
  `points_added` decimal(4,1) DEFAULT NULL,
  `pos_rnk` tinyint(2) unsigned DEFAULT NULL,

  UNIQUE KEY `pid` (`pid`, `esbid`, `league_format_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_player_seasonlogs`
--

DROP TABLE IF EXISTS `league_player_seasonlogs`;

CREATE TABLE `league_player_seasonlogs` (
  `pid` varchar(25) NOT NULL,
  `year` smallint(4) NOT NULL,
  `lid` int(6) NOT NULL,
  `start_tid` int(6) DEFAULT NULL,
  `start_acquisition_type` tinyint(2) DEFAULT NULL,
  `end_tid` int(6) DEFAULT NULL,
  `end_acquisition_type` tinyint(2) DEFAULT NULL,
  `salary` int(4) DEFAULT NULL,
  UNIQUE KEY `pid` (`pid`, `year`, `lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------
--
-- Table structure for table `league_format_player_seasonlogs`
--

DROP TABLE IF EXISTS `league_format_player_seasonlogs`;

CREATE TABLE `league_format_player_seasonlogs` (
  `pid` varchar(25) NOT NULL,
  `year` smallint(4) NOT NULL,
  `league_format_hash` varchar(64) NOT NULL,
  `startable_games` tinyint(2) DEFAULT NULL,
  `points` decimal(4,1) DEFAULT NULL,
  `points_per_game` decimal(3,1) DEFAULT NULL,
  `points_added` decimal(4,1) DEFAULT NULL,
  `points_added_per_game` decimal(3,1) DEFAULT NULL,
  `games` tinyint(2) DEFAULT NULL,
  `points_rnk` SMALLINT(5) DEFAULT NULL,
  `points_pos_rnk` SMALLINT(5) DEFAULT NULL,
  `points_added_rnk` SMALLINT(5) DEFAULT NULL,
  `points_added_pos_rnk` SMALLINT(5) DEFAULT NULL,
  UNIQUE KEY `pid` (`pid`, `year`, `league_format_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_format_player_careerlogs`
--

DROP TABLE IF EXISTS `league_format_player_careerlogs`;

CREATE TABLE `league_format_player_careerlogs` (
  `pid` varchar(25) NOT NULL,
  `league_format_hash` varchar(64) NOT NULL,
  `draft_rank` smallint(3) DEFAULT NULL,
  `startable_games` smallint(3) DEFAULT NULL,
  `points` decimal(6,1) DEFAULT NULL,
  `points_per_game` decimal(3,1) DEFAULT NULL,
  `points_added` decimal(6,1) DEFAULT NULL,
  `points_added_per_game` decimal(3,1) DEFAULT NULL,
  `best_season_points_added_per_game` decimal(3,1) DEFAULT NULL,
  `points_added_first_three_seas` decimal(6,1) DEFAULT NULL,
  `points_added_first_four_seas` decimal(6,1) DEFAULT NULL,
  `points_added_first_five_seas` decimal(6,1) DEFAULT NULL,
  `points_added_first_seas` decimal(6,1) DEFAULT NULL,
  `points_added_second_seas` decimal(6,1) DEFAULT NULL,
  `points_added_third_seas` decimal(6,1) DEFAULT NULL,
  `games` smallint(3) DEFAULT NULL,
  `top_3` TINYINT(2) DEFAULT NULL,
  `top_6` TINYINT(2) DEFAULT NULL,
  `top_12` TINYINT(2) DEFAULT NULL,
  `top_24` TINYINT(2) DEFAULT NULL,
  `top_36` TINYINT(2) DEFAULT NULL,

  UNIQUE KEY `pid` (`pid`, `league_format_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_format_draft_pick_value`
--

DROP TABLE IF EXISTS `league_format_draft_pick_value`;

CREATE TABLE `league_format_draft_pick_value` (
  `league_format_hash` varchar(64) NOT NULL,
  `rank` smallint(3) NOT null,
  `median_best_season_points_added_per_game` decimal(3,1) DEFAULT NULL,
  `median_career_points_added_per_game` decimal(3,1) DEFAULT NULL,

  UNIQUE KEY `pick` (`rank`, `league_format_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `footballoutsiders`
--

DROP TABLE IF EXISTS `footballoutsiders`;

CREATE TABLE `footballoutsiders` (
  `week` tinyint(2) NOT NULL,
  `year` smallint(4) NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rankings`
--

DROP TABLE IF EXISTS `rankings`;

CREATE TABLE `rankings` (
  `pid` varchar(25) NOT NULL,
  `pos` varchar(3) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` smallint(4) NOT NULL,
  `min` int(4) DEFAULT NULL,
  `max` int(4) DEFAULT NULL,
  `avg` decimal(5,2) DEFAULT NULL,
  `std` decimal(5,2) DEFAULT NULL,
  `ornk` int(4) DEFAULT NULL,
  `prnk` int(4) DEFAULT NULL,
  `type` int(1) NOT NULL,
  `adp` tinyint(1) NOT NULL,
  `ppr` int(1) NOT NULL,
  `sf` tinyint(1) NOT NULL,
  `dynasty` tinyint(1) NOT NULL,
  `rookie` tinyint(2) NOT NULL,
  `sourceid` int(6) NOT NULL,
  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `ranking` (`pid`, `sourceid`, `type`, `adp`, `ppr`, `sf`, `dynasty`, `rookie`, `week`, `year`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


-- --------------------------------------------------------

--
-- Table structure for table `props`
--

DROP TABLE IF EXISTS `props`;

CREATE TABLE `props` (
  `pid` varchar(25) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` smallint(4) NOT NULL,
  `esbid` int(10) unsigned DEFAULT NULL,
  `prop_type` tinyint(3) NOT NULL,
  `id` varchar(100) NOT NULL,
  `ln` decimal(4,1) DEFAULT NULL,
  `o` decimal(5,2) DEFAULT NULL,
  `u` decimal(5,2) DEFAULT NULL,
  `o_am` MEDIUMINT DEFAULT NULL,
  `u_am` MEDIUMINT DEFAULT NULL,
  `sourceid` int(6) NOT NULL,
  `timestamp` int(11) NOT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `live` tinyint(1) DEFAULT NULL,
  UNIQUE KEY `prop` (`sourceid`, `id`, `pid`, `week`, `year`, `prop_type`, `ln`, `timestamp`) -- TODO remove week, year and add esbid
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `props_index`
--

DROP TABLE IF EXISTS `props_index`;

CREATE TABLE `props_index` (
  `prop_id` int unsigned NOT NULL AUTO_INCREMENT,
  `pid` varchar(25) NOT NULL,
  `week` tinyint(2) NOT NULL,
  `year` smallint(4) NOT NULL,
  `prop_type` tinyint(3) NOT NULL,
  `ln` decimal(4,1) DEFAULT NULL,
  `o` decimal(5,2) DEFAULT NULL,
  `u` decimal(5,2) DEFAULT NULL,
  `o_am` MEDIUMINT DEFAULT NULL,
  `u_am` MEDIUMINT DEFAULT NULL,
  `sourceid` int(6) NOT NULL,
  `timestamp` int(11) NOT NULL,
  `time_type` tinyint(3) NOT NULL,

  `name` varchar(50) DEFAULT NULL,
  `team` varchar(3) DEFAULT NULL,
  `opp` varchar(3) DEFAULT NULL,
  `esbid` int(10) unsigned DEFAULT NULL,
  `pos` varchar(3) DEFAULT NULL,
  `hits_soft` tinyint(2) unsigned DEFAULT NULL,
  `hit_weeks_soft` json DEFAULT NULL,
  `hits_hard` tinyint(2) unsigned DEFAULT NULL,
  `hit_weeks_hard` json DEFAULT NULL,
  `hits_opp` tinyint(2) unsigned DEFAULT NULL,
  `opp_hit_weeks` json DEFAULT NULL,
  `hist_rate_soft` decimal(5,4) DEFAULT NULL,
  `hist_rate_hard` decimal(5,4) DEFAULT NULL,
  `opp_allow_rate` decimal(5,4) DEFAULT NULL,
  `hist_edge_soft` decimal(6,5) DEFAULT NULL,
  `hist_edge_hard` decimal(6,5) DEFAULT NULL,
  `market_prop` decimal(5,4) DEFAULT NULL,
  `is_pending` tinyint(1) unsigned DEFAULT NULL,
  `is_success` tinyint(1) unsigned DEFAULT NULL,
  `risk` decimal(7,4) DEFAULT NULL,
  `payout` decimal(7,4) DEFAULT NULL,
  `all_weeks` json DEFAULT NULL,
  `opp_weeks` json DEFAULT NULL,
  PRIMARY KEY (`prop_id`),
  UNIQUE KEY `prop` (`sourceid`, `pid`, `week`, `year`, `prop_type`, `ln`, `time_type`), -- TODO remove week, year and add esbid
  KEY `hits_soft` (`hits_soft`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_markets`
--

DROP TABLE IF EXISTS `prop_markets`;

CREATE TABLE `prop_markets` (
  `market_id` varchar(255) NOT NULL,
  `source_id` tinyint(1) unsigned NOT NULL,
  `source_event_id` varchar(255) DEFAULT NULL,
  `source_market_name` varchar(255) DEFAULT NULL,
  `market_type` tinyint(1) unsigned DEFAULT NULL,
  `market_name` varchar(255) DEFAULT NULL,
  `open` tinyint(1) DEFAULT NULL,
  `live` tinyint(1) DEFAULT NULL,
  `runners` smallint unsigned DEFAULT NULL,
  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `market` (`source_id`, `market_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_markets_index`
--

DROP TABLE IF EXISTS `prop_markets_index`;

CREATE TABLE `prop_markets_index` (
  `market_id` varchar(255) NOT NULL,
  `source_id` tinyint(1) unsigned NOT NULL,
  `source_event_id` varchar(255) DEFAULT NULL,
  `source_market_name` varchar(255) DEFAULT NULL,
  `market_type` tinyint(1) unsigned DEFAULT NULL,
  `market_name` varchar(255) DEFAULT NULL,
  `open` tinyint(1) DEFAULT NULL,
  `live` tinyint(1) DEFAULT NULL,
  `runners` smallint unsigned DEFAULT NULL,
  UNIQUE KEY `market` (`source_id`, `market_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_pairings`
--

DROP TABLE IF EXISTS `prop_pairings`;

CREATE TABLE `prop_pairings` (
  `pairing_id` varchar(30) NOT NULL,
  `sourceid` int NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `team` varchar(3) DEFAULT NULL,
  `week` tinyint(2) NOT NULL,
  `size` tinyint(1) NOT NULL,
  `market_prob` decimal(5,4) DEFAULT NULL,
  `risk_total` decimal(6,3) DEFAULT NULL,
  `payout_total` decimal(7,3) DEFAULT NULL,
  `hist_rate_soft` decimal(5,4) DEFAULT NULL,
  `hist_rate_hard` decimal(5,4) DEFAULT NULL,
  `opp_allow_rate` decimal(5,4) DEFAULT NULL,
  `total_games` tinyint(2) DEFAULT NULL,
  `week_last_hit` tinyint(2) DEFAULT NULL,
  `week_first_hit` tinyint(2) DEFAULT NULL,
  `joint_hist_rate` decimal(5,4) DEFAULT NULL,
  `joint_games` tinyint(2) DEFAULT NULL,
  `hist_edge_soft` decimal(6,5) DEFAULT NULL,
  `hist_edge_hard` decimal(6,5) DEFAULT NULL,
  `is_pending` tinyint(1) unsigned DEFAULT NULL,
  `is_success` tinyint(1) unsigned DEFAULT NULL,
  `highest_payout` MEDIUMINT DEFAULT NULL,
  `lowest_payout` MEDIUMINT DEFAULT NULL,
  PRIMARY KEY (`pairing_id`),
  KEY `sourceid` (`sourceid`),
  KEY `market_prob` (`market_prob`),
  KEY `hist_rate_soft` (`hist_rate_soft`),
  KEY `opp_allow_rate` (`opp_allow_rate`),
  KEY `joint_hist_rate` (`joint_hist_rate`),
  KEY `highest_payout` (`highest_payout`),
  KEY `lowest_payout` (`lowest_payout`),
  KEY `hist_edge_soft` (`hist_edge_soft`),
  KEY `total_games` (`total_games`),
  KEY `team` (`team`),
  KEY `week` (`week`),
  KEY `risk_total` (`risk_total`),
  KEY `size` (`size`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_pairing_props`
--

DROP TABLE IF EXISTS `prop_pairing_props`;

CREATE TABLE `prop_pairing_props` (
  `pairing_id` varchar(30) NOT NULL,
  `prop_id` int unsigned NOT NULL,
  UNIQUE KEY `pairing_prop` (`pairing_id`,`prop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `transition_bids`
--

DROP TABLE IF EXISTS `transition_bids`;

CREATE TABLE `transition_bids` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `pid` varchar(25) NOT NULL,
  `userid` int(6) NOT NULL,
  `bid` int(4) DEFAULT NULL,
  `tid` int(5) NOT NULL,
  `year` smallint(4) NOT NULL,
  `player_tid` int(5) NOT NULL,
  `lid` int(6) NOT NULL,
  `succ` tinyint(1) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `submitted` int(11) NOT NULL,
  `processed` int(11) DEFAULT NULL,
  `cancelled` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `poach_releases`
--

DROP TABLE IF EXISTS `transition_releases`;

CREATE TABLE `transition_releases` (
  `transitionid` int(11) NOT NULL,
  `pid` varchar(25) NOT NULL,
  KEY `transitionid` (`transitionid`),
  UNIQUE KEY `pid` (`transitionid`, `pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_team_lineups`
--

DROP TABLE IF EXISTS `league_team_lineups`;

CREATE TABLE `league_team_lineups` (
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `total` decimal(5,2) DEFAULT NULL,
  `baseline_total` decimal(5,2) DEFAULT NULL,
  UNIQUE KEY `lineup` (`tid`,`year`, `week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_team_lineup_contributions`
--

DROP TABLE IF EXISTS `league_team_lineup_contributions`;

CREATE TABLE `league_team_lineup_contributions` (
  `pid` varchar(25) NOT NULL,
  `year` smallint(4) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `starts` tinyint(2) NOT NULL,
  `sp` decimal(5,2) NOT NULL,
  `bp` decimal(5,2) NOT NULL,
  UNIQUE KEY `contribution` (`lid`,`pid`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_team_lineup_contribution_weeks`
--

DROP TABLE IF EXISTS `league_team_lineup_contribution_weeks`;

CREATE TABLE `league_team_lineup_contribution_weeks` (
  `pid` varchar(25) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `start` tinyint(1) NOT NULL,
  `sp` decimal(5,2) NOT NULL,
  `bp` decimal(5,2) NOT NULL,
  UNIQUE KEY `contribution` (`lid`,`pid`,`year`, `week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_team_lineup_starters`
--

DROP TABLE IF EXISTS `league_team_lineup_starters`;

CREATE TABLE `league_team_lineup_starters` (
  `pid` varchar(25) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  UNIQUE KEY `starter` (`lid`,`pid`,`year`, `week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_team_forecast`
--

DROP TABLE IF EXISTS `league_team_forecast`;

CREATE TABLE `league_team_forecast` (
  `tid` int(6) NOT NULL,
  `lid` int(6) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `day` int(3) NOT NULL,
  `playoff_odds` decimal(5,4) NOT NULL,
  `division_odds` decimal(5,4) NOT NULL,
  `bye_odds` decimal(5,4) NOT NULL,
  `championship_odds` decimal(5,4) NOT NULL,
  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `team_forecast_day` (`tid`,`year`,`week`,`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_baselines`
--

DROP TABLE IF EXISTS `league_baselines`;

CREATE TABLE `league_baselines` (
  `lid` int(6) NOT NULL,
  `week` varchar(3) NOT NULL,
  `year` smallint(4) NOT NULL,
  `pid` varchar(25) NOT NULL,
  `type` varchar(10) NOT NULL,
  `pos` varchar(3) NOT NULL,
  UNIQUE KEY `baseline` (`lid`,`week`,`pos`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `keeptradecut_rankings`
--

DROP TABLE IF EXISTS `keeptradecut_rankings`;

CREATE TABLE `keeptradecut_rankings` (
  `pid` varchar(25) NOT NULL,
  `qb` tinyint(1) NOT NULL,
  `d` int(11) NOT NULL,
  `v` int(5) NOT NULL,
  `type` tinyint(1) NOT NULL,
  UNIQUE KEY `player_value` (`pid`,`d`,`qb`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_team_seasonlogs`
--

DROP TABLE IF EXISTS `nfl_team_seasonlogs`;

CREATE TABLE `nfl_team_seasonlogs` (
  `tm` varchar(7) NOT NULL,
  `stat_key` varchar(100) NOT NULL,
  `year` int(4) NOT NULL,

  `pa` decimal(5,2) DEFAULT 0,
  `pc` decimal(5,2) DEFAULT 0,
  `py` decimal(6,2) DEFAULT 0,
  `ints` decimal(4,2) DEFAULT 0,
  `tdp` decimal(4,2) DEFAULT 0,

  `ra` decimal(5,2) DEFAULT 0,
  `ry` decimal(6,2) DEFAULT 0,
  `tdr` decimal(4,2) DEFAULT 0,
  `fuml` decimal(4,2) DEFAULT 0,

  `trg` decimal(5,2) DEFAULT 0,
  `rec` decimal(5,2) DEFAULT 0,
  `recy` decimal(6,2) DEFAULT 0,
  `tdrec` decimal(4,2) DEFAULT 0,

  `twoptc` decimal(4,2) DEFAULT 0,

  `prtd` decimal(4,2) DEFAULT 0,
  `krtd` decimal(4,2) DEFAULT 0,

  `snp` decimal(6,2) DEFAULT 0,

  `fgm` decimal(4,2) DEFAULT 0,
  `fgy` decimal(6,2) DEFAULT 0,
  `fg19` decimal(4,2) DEFAULT 0,
  `fg29` decimal(4,2) DEFAULT 0,
  `fg39` decimal(4,2) DEFAULT 0,
  `fg49` decimal(4,2) DEFAULT 0,
  `fg50` decimal(4,2) DEFAULT 0,
  `xpm` decimal(5,2) DEFAULT 0,

  `dsk` decimal(5,2) DEFAULT 0,
  `dint` decimal(5,2) DEFAULT 0,
  `dff` decimal(5,2) DEFAULT 0,
  `drf` decimal(5,2) DEFAULT 0,
  `dtno` decimal(5,2) DEFAULT 0,
  `dfds` decimal(5,2) DEFAULT 0,
  `dpa` decimal(5,2) DEFAULT 0,
  `dya` decimal(8,2) DEFAULT 0,
  `dblk` decimal(5,2) DEFAULT 0,
  `dsf` decimal(5,2) DEFAULT 0,
  `dtpr` decimal(5,2) DEFAULT 0,
  `dtd` decimal(5,2) DEFAULT 0,

  UNIQUE KEY `stat` (`stat_key`, `year`, `tm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `league_nfl_team_seasonlogs`
--

DROP TABLE IF EXISTS `league_nfl_team_seasonlogs`;

CREATE TABLE `league_nfl_team_seasonlogs` (
  `tm` varchar(7) NOT NULL,
  `stat_key` varchar(100) NOT NULL,
  `year` int(4) NOT NULL,
  `lid` int(6) NOT NULL,

  `pts` decimal(5,1) DEFAULT NULL,
  `rnk` tinyint(1) DEFAULT NULL,

  UNIQUE KEY `league_stat` (`lid`, `stat_key`, `year`, `tm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `percentiles`
--

DROP TABLE IF EXISTS `percentiles`;

CREATE TABLE `percentiles` (
  `percentile_key` varchar(100) NOT NULL,
  `field` varchar(100) NOT NULL,
  `p25` decimal(8,2) NOT NULL,
  `p50` decimal(8,2) NOT NULL,
  `p75` decimal(8,2) NOT NULL,
  `p90` decimal(8,2) NOT NULL,
  `p95` decimal(8,2) NOT NULL,
  `p98` decimal(8,2) NOT NULL,
  `p99` decimal(8,2) NOT NULL,
  `min` decimal(8,2) NOT NULL,
  `max` decimal(8,2) NOT NULL,
  UNIQUE KEY `percentile_key` (`percentile_key`, `field`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
