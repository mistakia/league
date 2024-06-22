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
  `pid` varchar(25) NOT NULL COMMENT 'player id',
  `fname` varchar(20) NOT NULL COMMENT 'first name',
  `lname` varchar(25) NOT NULL COMMENT 'last name',
  `pname` varchar(25) NOT NULL COMMENT 'f.last name',
  `formatted` varchar(30) NOT NULL COMMENT 'formatted name',
  `pos` varchar(4) NOT NULL COMMENT 'primary position',
  `pos1` varchar(4) NOT NULL COMMENT 'secondary position',
  `pos2` varchar(4) DEFAULT NULL COMMENT 'tertiary position',
  `height` tinyint(2) unsigned NOT NULL COMMENT 'height in inches',
  `weight` int(3) unsigned NOT NULL COMMENT 'weight in pounds',
  `dob` varchar(10) NOT NULL COMMENT 'date of birth',
  `forty` decimal(3,2) DEFAULT NULL COMMENT '40-yard dash time',
  `bench` tinyint(2) DEFAULT NULL COMMENT 'bench press reps',
  `vertical` decimal(3,1) DEFAULT NULL COMMENT 'vertical jump height',
  `broad` int(3) DEFAULT NULL COMMENT 'broad jump distance',
  `shuttle` decimal(3,2) DEFAULT NULL COMMENT 'shuttle run time',
  `cone` decimal(3,2) DEFAULT NULL COMMENT '3-cone drill time',
  `arm` decimal(5,3) DEFAULT NULL COMMENT 'arm length',
  `hand` decimal(5,3) DEFAULT NULL COMMENT 'hand size',
  `dpos` int(3) NOT NULL DEFAULT '0' COMMENT 'draft position',
  `round` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'draft round',
  `col` varchar(255) DEFAULT NULL COMMENT 'college',
  `dv` varchar(35) DEFAULT NULL COMMENT 'college division',
  `start` int(4) NOT NULL COMMENT 'starting nfl year',
  `current_nfl_team` varchar(3) NOT NULL DEFAULT 'INA' COMMENT 'current nfl team',
  `posd` varchar(8) NOT NULL DEFAULT 'INA' COMMENT 'position depth',
  `jnum` tinyint(2) NOT NULL DEFAULT 0 COMMENT 'jersey number',
  `dcp` tinyint(1) NOT NULL DEFAULT 0, -- TODO ??

  `nflid` int(10) DEFAULT NULL,
  `esbid` varchar(10) DEFAULT NULL,
  `gsisid` varchar(15) DEFAULT NULL,
  `gsispid` varchar(47) DEFAULT NULL,
  `gsisItId` mediumint(8) DEFAULT NULL,

  `nfl_status` varchar(50) DEFAULT NULL,
  `injury_status` varchar(12) DEFAULT NULL,
  `high_school` varchar(255) DEFAULT NULL,

  `sleeper_id` varchar(11) DEFAULT NULL,
  `rotoworld_id` int(11) DEFAULT NULL,
  `rotowire_id` int(11) DEFAULT NULL,
  `sportradar_id` varchar(36) DEFAULT NULL,
  `espn_id` int(11) DEFAULT NULL,
  `fantasy_data_id` int(11) DEFAULT NULL,
  `yahoo_id` int(11) DEFAULT NULL,
  `keeptradecut_id` int(11) DEFAULT NULL,
  `pfr_id` varchar(10) DEFAULT NULL,

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
  UNIQUE KEY `pfr_id` (`pfr_id`),
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
  `formatted_status` varchar(100) DEFAULT NULL,
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

  `free_agency_period_start` int(11) unsigned DEFAULT NULL,
  `free_agency_period_end` int(11) unsigned DEFAULT NULL,
  `free_agency_live_auction_start` int(11) unsigned DEFAULT NULL,
  `tddate` int(11) unsigned DEFAULT NULL,

  `season_due_amount` int(6) unsigned DEFAULT NULL,
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
  `espnid` int(15) DEFAULT NULL,
  `ngsid` int(10) DEFAULT NULL,
  `shieldid` varchar(36) DEFAULT NULL,
  `detailid_v3` varchar(36) DEFAULT NULL,
  `detailid_v1` varchar(36) DEFAULT NULL,
  `pfrid` varchar(20) DEFAULT NULL,
  `nflverse_game_id` varchar(15) DEFAULT NULL,

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
  `spread_line` decimal(3,1) DEFAULT NULL,
  `total_line` decimal(3,1) DEFAULT NULL,

  `roof` ENUM('dome', 'outdoors', 'closed', 'open') DEFAULT NULL,
  `surf` ENUM('grass', 'astroturf', 'fieldturf', 'dessograss', 'astroplay', 'matrixturf', 'sportturf', 'a_turf') DEFAULT NULL,

  `temp` int(3) DEFAULT NULL,
  `wind` int(3) DEFAULT NULL,

  `away_qb_pid` varchar(25) DEFAULT NULL,
  `home_qb_pid` varchar(25) DEFAULT NULL,

  `away_coach` varchar(36) DEFAULT NULL,
  `home_coach` varchar(36) DEFAULT NULL,

  `away_play_caller` varchar(36) DEFAULT NULL,
  `home_play_caller` varchar(36) DEFAULT NULL,

  `referee` varchar(36) DEFAULT NULL,

  UNIQUE KEY `game` (`v`, `h`, `week`, `year`, `seas_type`),
  UNIQUE KEY `esbid` (`esbid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `nfl_games_changelog`
--

DROP TABLE IF EXISTS `nfl_games_changelog`;

CREATE TABLE `nfl_games_changelog` (
  `esbid` varchar(36) NOT NULL,
  `column_name` varchar(36) NOT NULL,
  `prev` varchar(400) DEFAULT NULL,
  `new` varchar(400) DEFAULT NULL,
  `timestamp` int(11) NOT NULL
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
  `pick_str` varchar(4) DEFAULT NULL,
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

  `pts_base_week_qb` decimal(3,1) unsigned DEFAULT NULL comment 'qb pts/game baseline',
  `pts_base_week_rb` decimal(3,1) unsigned DEFAULT NULL comment 'rb pts/game baseline',
  `pts_base_week_wr` decimal(3,1) unsigned DEFAULT NULL comment 'wr pts/game bsaeline',
  `pts_base_week_te` decimal(3,1) unsigned DEFAULT NULL comment 'te pts/game baseline',
  `pts_base_week_k` decimal(3,1) unsigned DEFAULT NULL comment 'k pts/game baseline',
  `pts_base_week_dst` decimal(3,1) unsigned DEFAULT NULL comment 'dst pts/game baseline',

  `pts_base_season_qb` decimal(3,1) unsigned DEFAULT NULL comment 'qb pts/season baseline',
  `pts_base_season_rb` decimal(3,1) unsigned DEFAULT NULL comment 'rb pts/season baseline',
  `pts_base_season_wr` decimal(3,1) unsigned DEFAULT NULL comment 'wr pts/season baseline',
  `pts_base_season_te` decimal(3,1) unsigned DEFAULT NULL comment 'te pts/season baseline',
  `pts_base_season_k` decimal(3,1) unsigned DEFAULT NULL comment 'k pts/season baseline',
  `pts_base_season_dst` decimal(3,1) unsigned DEFAULT NULL comment 'dst pts/season baseline',

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

  `hp` decimal(5,2) DEFAULT 0, -- points
  `ap` decimal(5,2) DEFAULT 0,

  `hpp` decimal(5,2) DEFAULT 0, -- potential points
  `app` decimal(5,2) DEFAULT 0,

  `home_projection` decimal(5,2) DEFAULT NULL,
  `away_projection` decimal(5,2) DEFAULT NULL,

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
  `points_manual` decimal(7,2) DEFAULT NULL,
  `projection` decimal(5,2) DEFAULT NULL,
  UNIQUE KEY `tid` (`tid`,`uid`,`year`),
  KEY `lid` (`lid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `projections_index`
--

DROP TABLE IF EXISTS `projections_index`;

CREATE TABLE `projections_index` (
  `pid` varchar(25) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `sourceid` int NOT NULL DEFAULT '0',
  `userid` int NOT NULL DEFAULT '0',

  `week` tinyint NOT NULL,
  `year` smallint NOT NULL,

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

  UNIQUE KEY `projection` (`sourceid`,`pid`,`userid`,`week`,`year`),
  KEY `pid` (`pid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `projections`
--

DROP TABLE IF EXISTS `projections`;

CREATE TABLE `projections` (
  `pid` varchar(25) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `sourceid` int NOT NULL DEFAULT '0',
  `userid` int NOT NULL DEFAULT '0',

  `week` tinyint NOT NULL,
  `year` smallint NOT NULL,
  `timestamp` datetime NOT NULL,

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

  `week` tinyint NOT NULL,
  `year` smallint NOT NULL,
  `timestamp` datetime NOT NULL,

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

  `salary_adj_pts_added` decimal(5,2) DEFAULT NULL,
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

  `pts_added` decimal(5,2) DEFAULT NULL,
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
  `tid` int(6) unsigned NOT NULL,
  `lid` int(6) unsigned NOT NULL,
  `week` tinyint(2) unsigned NOT NULL,
  `year` smallint(4) unsigned NOT NULL,
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
  `tid` int(6) unsigned NOT NULL,
  `lid` int(6) unsigned NOT NULL,
  `week` tinyint(2) unsigned NOT NULL,
  `year` smallint(4) unsigned NOT NULL,
  UNIQUE KEY `pid` (`rid`,`pid`),
  UNIQUE KEY `player_team` (`pid`,`week`,`year`,`tid`),
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
  `draft_order` tinyint(2) DEFAULT NULL,
  `waiver_order` tinyint(2) DEFAULT NULL,
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

  `division_finish` tinyint(2) DEFAULT 0,
  `regular_season_finish` tinyint(2) DEFAULT 0,
  `post_season_finish` tinyint(2) DEFAULT 0,

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
  `username` varchar(50) NOT NULL,
  `email` varchar(50) NOT NULL DEFAULT '',
  `password` varchar(60) NOT NULL DEFAULT '',
  `vbaseline` varchar(9) NOT NULL DEFAULT 'default',
  `watchlist` mediumtext,
  `lastvisit` datetime DEFAULT NULL,
  `phone` varchar(12) DEFAULT NULL,
  `text` tinyint(1) NOT NULL DEFAULT 1,
  `voice` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
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
  PRIMARY KEY (`uid`)
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

  `week` tinyint(2) NOT NULL,
  `dwn` int(1) DEFAULT NULL,
  `qtr` int(1) DEFAULT NULL,
  `year` smallint(4) NOT NULL,
  `seas_type` varchar(36) DEFAULT NULL COMMENT 'PRE, REG, POST',

  `desc` text DEFAULT NULL,

  `ydl_num` int(4) DEFAULT NULL,
  `ydl_side` varchar(10) DEFAULT NULL,
  `ydl_start` varchar(10) DEFAULT NULL COMMENT 'String indicating the start field position for a given play.',
  `ydl_end` varchar(10) DEFAULT NULL COMMENT 'String indicating the end field position for a given play.',
  `ydl_100` int(3) DEFAULT NULL COMMENT 'Numeric distance in the number of yards from the opponents endzone for the posteam.',

  `hash` varchar(1) DEFAULT NULL COMMENT 'hash location, values: (L)eft hash, (R)ight hash or in-between (M)',
  `mot` varchar(2) DEFAULT NULL COMMENT 'motion, There are 2 types of motion: Pre-snap (P) which starts and stops before the snap and the more aggressive type of motion that is occurring during the snap (S). When both occur we mark PS',

  `ytg` int(3) DEFAULT NULL COMMENT 'yards to go',
  `yfog` int(3) DEFAULT NULL COMMENT 'yards from own goal (1-99)',

  `off_formation` varchar(100) DEFAULT NULL,
  `off_personnel` varchar(100) DEFAULT NULL,
  `def_personnel` varchar(100) DEFAULT NULL,

  `box_ngs` int(3) DEFAULT NULL,
  `pru_ngs` int(3) DEFAULT NULL,
  `air_yards_ngs` decimal(8,4) DEFAULT NULL,
  `time_to_throw_ngs` decimal(8,4) DEFAULT NULL,
  `route_ngs` varchar(100) DEFAULT NULL,
  `man_zone_ngs` varchar(100) DEFAULT NULL,
  `cov_type_charted` varchar(3) DEFAULT NULL,
  `cov_type_ngs` varchar(100) DEFAULT NULL,

  `drive_seq` int(4) DEFAULT NULL COMMENT 'drive count',
  `drive_yds` int(3) DEFAULT NULL,
  `drive_play_count` int(3) DEFAULT NULL COMMENT 'Numeric value of how many regular plays happened in a given drive.',
  `drive_result` varchar(30) DEFAULT NULL COMMENT 'drive result',
  `drive_top` varchar(10) DEFAULT NULL COMMENT 'Time of possession in a given drive.',
  `drive_fds` int(2) DEFAULT NULL COMMENT 'Number of first downs in a given drive.',
  `drive_inside20` bit(1) DEFAULT NULL COMMENT 'Binary indicator if the offense was able to get inside the opponents 20 yard line.',
  `drive_score` bit(1) DEFAULT NULL COMMENT 'Binary indicator the drive ended with a score.',
  `drive_start_qtr` tinyint(1) DEFAULT NULL COMMENT 'Numeric value indicating in which quarter the given drive has started.',
  `drive_end_qtr` tinyint(1) DEFAULT NULL COMMENT 'Numeric value indicating in which quarter the given drive has ended.',
  `drive_yds_penalized` int(3) DEFAULT NULL COMMENT 'Numeric value of how many yards the offense gained or lost through penalties in the given drive.',
  `drive_start_transition` varchar(30) DEFAULT NULL COMMENT 'String indicating how the offense got the ball.',
  `drive_end_transition` varchar(30) DEFAULT NULL COMMENT 'String indicating how the offense lost the ball.',
  `drive_game_clock_start` varchar(10) DEFAULT NULL COMMENT 'Game time at the beginning of a given drive.',
  `drive_game_clock_end` varchar(10) DEFAULT NULL COMMENT 'Game time at the end of a given drive.',
  `drive_start_ydl` varchar(10) DEFAULT NULL COMMENT 'String indicating where a given drive started consisting of team half and yard line number.',
  `drive_end_ydl` varchar(10) DEFAULT NULL COMMENT 'String indicating where a given drive ended consisting of team half and yard line number.',
  `drive_start_play_id` int(10) DEFAULT NULL COMMENT 'Play_id of the first play in the given drive.',
  `drive_end_play_id` int(10) DEFAULT NULL COMMENT 'Play_id of the last play in the given drive.',

  `series_seq` int(3) DEFAULT NULL COMMENT 'Starts at 1, each new first down increments, numbers shared across both teams NA: kickoffs, extra point/two point conversion attempts, non-plays, no posteam',
  `series_suc` bit(1) DEFAULT NULL COMMENT '1: scored touchdown, gained enough yards for first down.',
  `series_result` varchar(100) DEFAULT NULL COMMENT 'Possible values: First down, Touchdown, Opp touchdown, Field goal, Missed field goal, Safety, Turnover, Punt, Turnover on downs, QB kneel, End of half',

  `gtg` bit(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not the posteam is in a goal down situation.',

  `score` bit(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not a score occurred on the play.',
  `score_type` varchar(10) DEFAULT NULL COMMENT 'Scoring play type: FG, PAT, PAT2, SFTY, TD',
  `score_team` varchar(4) DEFAULT NULL COMMENT 'Scoring play team',

  `timestamp` varchar(10) DEFAULT NULL,

  `play_clock` tinyint unsigned DEFAULT NULL COMMENT 'Time on the playclock when the ball was snapped.',

  `game_clock_start` varchar(10) DEFAULT NULL COMMENT 'Time at start of play provided in string format as minutes:seconds remaining in the quarter.',
  `game_clock_end` varchar(10) DEFAULT NULL COMMENT 'Game time at the end of a given play.',
  `sec_rem_qtr` int(4) DEFAULT NULL COMMENT 'Numeric seconds remaining in the quarter.',
  `sec_rem_half` int(4) DEFAULT NULL COMMENT 'Numeric seconds remaining in the half.',
  `sec_rem_gm` int(4) DEFAULT NULL COMMENT 'Numeric seconds remaining in the game.',

  `pos_team` varchar(4) DEFAULT NULL,
  `pos_team_id` varchar(36) DEFAULT NULL,

  `off` varchar(3) DEFAULT NULL COMMENT 'offense',
  `def` varchar(3) DEFAULT NULL COMMENT 'defense',

  `deleted` bit(1) DEFAULT NULL,
  `review` text DEFAULT NULL,

  `play_type` enum('CONV', 'FGXP', 'KOFF', 'NOPL', 'PASS', 'PUNT', 'RUSH') DEFAULT NULL,
  `play_type_nfl` varchar(36) DEFAULT NULL,
  `play_type_ngs` varchar(36) DEFAULT NULL,

  `next_play_type` varchar(36) DEFAULT NULL,

  `player_fuml_pid` varchar(25) DEFAULT NULL COMMENT 'fumbling player',
  `player_fuml_gsis` varchar(36) DEFAULT NULL COMMENT 'fumbling player gsis',
  `bc_pid` varchar(25) DEFAULT NULL COMMENT 'ball carrier',
  `bc_gsis` varchar(36) DEFAULT NULL COMMENT 'ball carrier gsis',
  `psr_pid` varchar(25) DEFAULT NULL COMMENT 'passer',
  `psr_gsis` varchar(36) DEFAULT NULL COMMENT 'passer gsis',
  `trg_pid` varchar(25) DEFAULT NULL COMMENT 'targeted player',
  `trg_gsis` varchar(36) DEFAULT NULL COMMENT 'targeted player gsis',
  `intp_pid` varchar(25) DEFAULT NULL COMMENT 'intercepting player',
  `intp_gsis` varchar(36) DEFAULT NULL COMMENT 'intercepting player gsis',

  `yds_gained` tinyint(3) DEFAULT NULL COMMENT 'yardage gained (or lost) by the possessing team',

  `fum` bit(1) DEFAULT NULL COMMENT 'fumble occurred',
  `fuml` bit(1) DEFAULT NULL COMMENT 'fumble lost',
  `int` bit(1) DEFAULT NULL COMMENT 'interception',
  `sk` bit(1) DEFAULT NULL COMMENT 'sack',
  `succ` bit(1) DEFAULT NULL COMMENT 'successful play',
  `comp` bit(1) DEFAULT NULL COMMENT 'completion',
  `incomp` bit(1) DEFAULT NULL COMMENT 'incompletion',
  `trick` bit(1) DEFAULT NULL COMMENT 'trick play',
  `touchback` bit(1) DEFAULT NULL COMMENT 'touchback',
  `safety` bit(1) DEFAULT NULL COMMENT 'safety',
  `penalty` bit(1) DEFAULT NULL COMMENT 'penalty',
  `oob` bit(1) DEFAULT NULL COMMENT '1 if play description contains ran ob, pushed ob, or sacked ob; 0 otherwise.',
  `tfl` bit(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not a tackle for loss on a run play occurred.',
  `rush` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the play was a run.',
  `pass` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the play was a pass attempt (includes sacks).',
  `solo_tk` bit(1) DEFAULT NULL COMMENT 'Binary indicator if the play had a solo tackle (could be multiple due to fumbles).',
  `assist_tk` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if an assist tackle occurred.',

  `special` bit(1) DEFAULT NULL COMMENT 'special teams',
  `special_play_type` varchar(10) DEFAULT NULL COMMENT 'special teams play type',

  `pen_team` varchar(3) DEFAULT NULL COMMENT 'String abbreviation of the team with the penalty.',
  `pen_yds` int(3) DEFAULT NULL COMMENT 'Yards gained (or lost) by the posteam from the penalty.',

  `td` bit(1) DEFAULT NULL COMMENT 'touchdown',
  `ret_td` bit(1) DEFAULT NULL COMMENT 'return touchdown',
  `pass_td` bit(1) DEFAULT NULL COMMENT 'passing touchdown',
  `rush_td` bit(1) DEFAULT NULL COMMENT 'rushing touchdown',
  `td_tm` varchar(5) DEFAULT NULL COMMENT 'touchdown team abbreviation',

  `pass_yds` tinyint(3) DEFAULT NULL COMMENT 'Numeric yards by the passer_player_name, including yards gained in pass plays with laterals. This should equal official passing statistics.',
  `recv_yds` tinyint(3) DEFAULT NULL COMMENT 'Numeric yards by the receiver_player_name, excluding yards gained in pass plays with laterals. This should equal official receiving statistics but could miss yards gained in pass plays with laterals. Please see the description of lateral_receiver_player_name for further information.',
  `rush_yds` tinyint(3) DEFAULT NULL COMMENT 'Numeric yards by the rusher_player_name, excluding yards gained in rush plays with laterals. This should equal official rushing statistics but could miss yards gained in rush plays with laterals. Please see the description of lateral_rusher_player_name for further information.',

  `dot` int(3) DEFAULT NULL COMMENT 'depth of target',
  `tay` tinyint(1) DEFAULT NULL COMMENT 'true air yards, Distance ball travels in the air from point of throw to a receivers hands; back of endzone or sideline.',
  `yac` int(3) DEFAULT NULL COMMENT 'yard after catch',
  `yaco` int(3) DEFAULT NULL COMMENT 'yards after contact',
  `ret_yds` int(3) DEFAULT NULL COMMENT 'return yardage',
  `ret_tm` varchar(5) DEFAULT NULL COMMENT 'return team abbreviation',

  `sg` bit(1) DEFAULT NULL COMMENT 'shotgun',
  `nh` bit(1) DEFAULT NULL COMMENT 'no huddle',
  `pap` bit(1) DEFAULT NULL COMMENT 'play action pass',
  `qbd` bit(1) DEFAULT NULL COMMENT 'QB dropped back on the play (pass attempt, sack, or scrambled).',
  `qbk` bit(1) DEFAULT NULL COMMENT 'QB took a knee.',
  `qbs` bit(1) DEFAULT NULL COMMENT 'QB spiked the ball.',
  `qbru` bit(1) DEFAULT NULL COMMENT 'QB run, a designed running play for the QB. These are only marked on runs by a natural QB where he lined up as a QB. Also, sneaks and kneel-downs are not counted.',
  `sneak` bit(1) DEFAULT NULL COMMENT 'QB sneak',
  `scrm` bit(1) DEFAULT NULL COMMENT 'QB scramble',

  `qb_pressure` tinyint(2) DEFAULT NULL COMMENT 'QB pressure',
  `qb_pressure_ngs` tinyint(2) DEFAULT NULL COMMENT 'QB pressure (NGS)',
  `qb_hit` tinyint(2) DEFAULT NULL COMMENT 'QB hit',
  `qb_hurry` tinyint(2) DEFAULT NULL COMMENT 'QB hurry',

  `int_worthy` bit(1) DEFAULT NULL COMMENT 'interception worthy',
  `cball` bit(1) DEFAULT NULL COMMENT 'catchable ball, A pass in which an eligible receiver has the opportunity to get his hands on the football with reasonable movement, timing, and opportunity.',
  `qbta` bit(1) DEFAULT NULL COMMENT 'QB Throw Away',
  `shov` bit(1) DEFAULT NULL COMMENT 'Shovel/Touch Pass',
  `side` bit(1) DEFAULT NULL COMMENT 'Sideline pass, Balls outside of the field but catchable when the receiver extends body/arms.',
  `high` bit(1) DEFAULT NULL COMMENT 'Highlight pass, Perfect pass that only the receiver can reach. Features perfect placement in a tight window.',

  `drp` bit(1) DEFAULT NULL COMMENT 'dropped pass',
  `cnb` bit(1) DEFAULT NULL COMMENT 'contested ball, Passes into close coverage that involve a physical battle between receiver and defender for control of the ball.',
  `crr` bit(1) DEFAULT NULL COMMENT 'Created Reception, Difficult catches that require exceptional body control; hands; acrobatics, or any combination thereof.',

  `mbt` tinyint(1) DEFAULT NULL COMMENT 'missed or broken tackles',
  `avsk` tinyint(1) DEFAULT NULL COMMENT 'number of avoided sacks',

  `run_location` varchar(10) DEFAULT NULL COMMENT 'String indicator for location of run: left, middle, or right.',
  `run_gap` varchar(10) DEFAULT NULL COMMENT 'String indicator for line gap of run: end, guard, or tackle',

  `option` varchar(3) DEFAULT NULL COMMENT 'option play, values: RPO (run/pass), RUN (run/qbrun)',
  `tlook` bit(1) DEFAULT NULL COMMENT 'trick look',

  `fd` bit(1) DEFAULT NULL COMMENT 'first down',
  `fd_rush` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if a running play converted the first down.',
  `fd_pass` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if a passing play converted the first down.',
  `fd_penalty` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if a penalty converted the first down.',

  `third_down_converted` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the first down was converted on third down.',
  `third_down_failed` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the posteam failed to convert first down on third down.',
  `fourth_down_converted` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the first down was converted on fourth down.',
  `fourth_down_failed` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the posteam failed to convert first down on fourth down.',

  `htm` bit(1) DEFAULT NULL COMMENT 'hindered throwing motion',
  `zblz` bit(1) DEFAULT NULL COMMENT 'zone blitz, at least one Off-Ball LB rushed the passer instead of a DL who dropped into coverage',
  `stnt` bit(1) DEFAULT NULL COMMENT 'stunt, when any two pass rushers cross, trading pass rush lanes on a passing down',
  `oop` bit(1) DEFAULT NULL COMMENT 'out of pocket pass',
  `phyb` bit(1) DEFAULT NULL COMMENT 'physical ball, Pass target takes significant punishment whether the pass is caught or not. Most Contested Balls will also be a Physical Ball.',
  `bap` bit(1) DEFAULT NULL COMMENT 'batted pass',
  `fread` bit(1) DEFAULT NULL COMMENT 'first read',
  `scre` bit(1) DEFAULT NULL COMMENT 'screen pass',
  `pfp` bit(1) DEFAULT NULL COMMENT 'pain free play, Ball carrier is only lightly touched by a defender on the field (ie QB slide) or runs out of bounds with little or no physical contact with the defender or sideline personnel/equipment. Includes TDs',
  `qbsk` bit(1) DEFAULT NULL COMMENT 'qb sack, QB was to blame for the sack: held ball too long; missed wide open receiver etc',

  `ttscrm` decimal(3,1) DEFAULT NULL COMMENT 'time to scramble',
  `ttp` decimal(3,1) DEFAULT NULL COMMENT 'time to pass',
  `ttsk` decimal(3,1) DEFAULT NULL COMMENT 'time to sack',
  `ttpr` decimal(3,1) DEFAULT NULL COMMENT 'time to pressure',

  `back` tinyint(2) DEFAULT NULL COMMENT 'number in backfield (wr, rb, te, fb)',
  `xlm` tinyint(1) DEFAULT NULL COMMENT 'extra men on the line, Number of players lined up on either side of the Offensive Tackles - usually a Tight End.',
  `db` tinyint(2) DEFAULT NULL COMMENT 'number of defensive backs',
  `box` tinyint(2) DEFAULT NULL COMMENT 'number of defenders in the box',
  `boxdb` tinyint(2) DEFAULT NULL COMMENT 'number of dbs in the box',
  `pru` tinyint(1) DEFAULT NULL COMMENT 'pass rushers',
  `blz` tinyint(1) DEFAULT NULL COMMENT 'number of LBs and DBs blitzing',
  `dblz` tinyint(1) DEFAULT NULL COMMENT 'Number of DBs blitzing',
  `oopd` varchar(2) DEFAULT NULL COMMENT 'out of pocket pass details, Clean [C], Pressure [P], Designed [D], Designed Rollout [DR]',
  `cov` tinyint(1) DEFAULT NULL COMMENT 'coverage on target, Uncovered is 0, single coverage is 1, double is 2.',

  `ep` decimal(16,12) DEFAULT NULL COMMENT 'Using the scoring event probabilities, the estimated expected points with respect to the possession team for the given play.',
  `epa` decimal(16,12) DEFAULT NULL COMMENT 'Expected points added (EPA) by the posteam for the given play.',
  `ep_succ` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator wheter epa > 0 in the given play.',

  `total_home_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total EPA for the home team in the game so far.',
  `total_away_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total EPA for the away team in the game so far.',
  `total_home_rush_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing EPA for the home team in the game so far.',
  `total_away_rush_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing EPA for the away team in the game so far.',
  `total_home_pass_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing EPA for the home team in the game so far.',
  `total_away_pass_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing EPA for the away team in the game so far.',

  `qb_epa` decimal(16,12) DEFAULT NULL COMMENT 'Gives QB credit for EPA for up to the point where a receiver lost a fumble after a completed catch and makes EPA work more like passing yards on plays with fumbles.',
  `air_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the air yards alone. For completions this represents the actual value provided through the air. For incompletions this represents the hypothetical value that could have been added through the air if the pass was completed.',
  `yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the yards after catch alone. For completions this represents the actual value provided after the catch. For incompletions this represents the difference between the hypothetical air_epa and the plays raw observed EPA (how much the incomplete pass cost the posteam).',
  `comp_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the air yards alone only for completions.',
  `comp_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the yards after catch alone only for completions.',
  `xyac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Expected value of EPA gained after the catch, starting from where the catch was made. Zero yards after the catch would be listed as zero EPA.',
  `total_home_comp_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air EPA for the home team in the game so far.',
  `total_away_comp_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air EPA for the away team in the game so far.',
  `total_home_comp_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac EPA for the home team in the game so far.',
  `total_away_comp_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac EPA for the away team in the game so far.',
  `total_home_raw_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air EPA for the home team in the game so far.',
  `total_away_raw_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air EPA for the away team in the game so far.',
  `total_home_raw_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac EPA for the home team in the game so far.',
  `total_away_raw_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac EPA for the away team in the game so far.',

  `wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the posteam given the current situation at the start of the given play',
  `wpa` decimal(16,12) DEFAULT NULL COMMENT 'Win probability added (WPA) for the posteam',
  `home_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the home team',
  `away_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the away team',
  `vegas_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Win probability added (WPA) for the posteam: spread adjusted model',
  `vegas_home_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Win probability added (WPA) for the home team: spread adjusted model',
  `home_wp_post` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the home team at the end of the play',
  `away_wp_post` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the away team at the end of the play',
  `vegas_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the posteam given the current situation at the start of the given play, incorporating pre-game Vegas line',
  `vegas_home_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the home team incorporating pre-game Vegas line',
  `total_home_rush_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing WPA for the home team in the game so far',
  `total_away_rush_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing WPA for the away team in the game so far',
  `total_home_pass_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing WPA for the home team in the game so far',
  `total_away_pass_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing WPA for the away team in the game so far',
  `air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'WPA through the air (same logic as air_epa)',
  `yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'WPA from yards after the catch (same logic as yac_epa)',
  `comp_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'The air_wpa for completions only',
  `comp_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'The yac_wpa for completions only',
  `total_home_comp_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air WPA for the home team in the game so far',
  `total_away_comp_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air WPA for the away team in the game so far',
  `total_home_comp_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac WPA for the home team in the game so far',
  `total_away_comp_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac WPA for the away team in the game so far',
  `total_home_raw_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air WPA for the home team in the game so far',
  `total_away_raw_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air WPA for the away team in the game so far',
  `total_home_raw_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac WPA for the home team in the game so far',
  `total_away_raw_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac WPA for the away team in the game so far',

  `xyac_mean_yds` decimal(16,12) DEFAULT NULL COMMENT 'Average expected yards after the catch based on where the ball was caught',
  `xyac_median_yds` decimal(16,12) DEFAULT NULL COMMENT 'Median expected yards after the catch based on where the ball was caught',
  `xyac_succ_prob` decimal(16,12) DEFAULT NULL COMMENT 'Probability play earns positive EPA (relative to where play started) based on where ball was caught',
  `xyac_fd_prob` decimal(16,12) DEFAULT NULL COMMENT 'Probability play earns a first down based on where the ball was caught',

  `ep_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for extra point attempt',
  `two_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for two point conversion attempt',
  `fg_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for field goal attempt',
  `kickoff_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for kickoff',
  `punt_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for punts',

  `fg_result` varchar(10) DEFAULT NULL COMMENT 'String indicator for result of field goal attempt: made, missed, or blocked',
  `kick_distance` int(3) DEFAULT NULL COMMENT 'Numeric distance in yards for kickoffs, field goals, and punts',
  `ep_result` varchar(10) DEFAULT NULL COMMENT 'String indicator for the result of the extra point attempt: good, failed, blocked, safety (touchback in defensive endzone is 1 point apparently), or aborted',
  `tp_result` varchar(10) DEFAULT NULL COMMENT 'String indicator for result of two point conversion attempt: success, failure, safety (touchback in defensive endzone is 1 point apparently), or return',
  `punt_blocked` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for if the punt was blocked',

  `home_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Numeric timeouts remaining in the half for the home team',
  `away_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Numeric timeouts remaining in the half for the away team',
  `pos_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Number of timeouts remaining for the possession team',
  `def_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Number of timeouts remaining for the team on defense',
  `to` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not a timeout was called by either team',
  `to_team` varchar(3) DEFAULT NULL COMMENT 'String abbreviation for which team called the timeout',

  `home_score` tinyint(2) DEFAULT NULL COMMENT 'Score for the home team at the end of the play',
  `away_score` tinyint(2) DEFAULT NULL COMMENT 'Score for the away team at the end of the play',
  `pos_score` tinyint(2) DEFAULT NULL COMMENT 'Score the posteam at the start of the play',
  `def_score` tinyint(2) DEFAULT NULL COMMENT 'Score the defteam at the start of the play',
  `score_diff` tinyint(2) DEFAULT NULL COMMENT 'Score differential between the posteam and defteam at the start of the play',
  `pos_score_post` tinyint(2) DEFAULT NULL COMMENT 'Score for the posteam at the end of the play',
  `def_score_post` tinyint(2) DEFAULT NULL COMMENT 'Score for the defteam at the end of the play',
  `score_diff_post` tinyint(2) DEFAULT NULL COMMENT 'Score differential between the posteam and defteam at the end of the play',

  `no_score_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of no score occurring for the rest of the half based on the expected points model',
  `opp_fg_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the defteam scoring a FG next',
  `opp_safety_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the defteam scoring a safety next',
  `opp_td_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the defteam scoring a TD next',
  `fg_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring a FG next',
  `safety_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring a safety next',
  `td_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring a TD next',
  `extra_point_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring an extra point',
  `two_conv_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring the two point conversion',

  `xpass_prob` decimal(16,12) DEFAULT NULL COMMENT 'Probability of dropback scaled from 0 to 1',
  `pass_oe` decimal(16,12) DEFAULT NULL COMMENT 'Dropback percent over expected on a given play scaled from 0 to 100',

  `cp` decimal(16,12) DEFAULT NULL COMMENT 'Numeric value indicating the probability for a complete pass based on comparable game situations',
  `cpoe` decimal(16,12) DEFAULT NULL COMMENT 'For a single pass play this is 1 - cp when the pass was completed or 0 - cp when the pass was incomplete. Analyzed for a whole game or season an indicator for the passer how much over or under expectation his completion percentage was',

  `charted` tinyint(1) DEFAULT NULL,
  `updated` int(11) NOT NULL,
  UNIQUE KEY `gamePlay` (`esbid`,`playId`),
  KEY `esbid` (`esbid`),
  KEY `playId` (`playId`),
  KEY `psr_pid` (`psr_pid`),
  KEY `bc_pid` (`bc_pid`),
  KEY `trg_pid` (`trg_pid`)
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
  UNIQUE KEY `play_stat` (`esbid`,`playId`,`statId`,`playerName`)
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

  `week` tinyint(2) NOT NULL,
  `dwn` int(1) DEFAULT NULL,
  `qtr` int(1) DEFAULT NULL,
  `year` smallint(4) NOT NULL,
  `seas_type` varchar(36) DEFAULT NULL COMMENT 'PRE, REG, POST',

  `desc` text DEFAULT NULL,

  `ydl_num` int(4) DEFAULT NULL,
  `ydl_side` varchar(10) DEFAULT NULL,
  `ydl_start` varchar(10) DEFAULT NULL COMMENT 'String indicating the start field position for a given play.',
  `ydl_end` varchar(10) DEFAULT NULL COMMENT 'String indicating the end field position for a given play.',
  `ydl_100` int(3) DEFAULT NULL COMMENT 'Numeric distance in the number of yards from the opponents endzone for the posteam.',

  `hash` varchar(1) DEFAULT NULL COMMENT 'hash location, values: (L)eft hash, (R)ight hash or in-between (M)',
  `mot` varchar(2) DEFAULT NULL COMMENT 'motion, There are 2 types of motion: Pre-snap (P) which starts and stops before the snap and the more aggressive type of motion that is occurring during the snap (S). When both occur we mark PS',

  `ytg` int(3) DEFAULT NULL COMMENT 'yards to go',
  `yfog` int(3) DEFAULT NULL COMMENT 'yards from own goal (1-99)',

  `off_formation` varchar(100) DEFAULT NULL,
  `off_personnel` varchar(100) DEFAULT NULL,
  `def_personnel` varchar(100) DEFAULT NULL,

  `box_ngs` int(3) DEFAULT NULL,
  `pru_ngs` int(3) DEFAULT NULL,
  `air_yards_ngs` decimal(8,4) DEFAULT NULL,
  `time_to_throw_ngs` decimal(8,4) DEFAULT NULL,
  `route_ngs` varchar(100) DEFAULT NULL,
  `man_zone_ngs` varchar(100) DEFAULT NULL,
  `cov_type_charted` varchar(3) DEFAULT NULL,
  `cov_type_ngs` varchar(100) DEFAULT NULL,

  `drive_seq` int(4) DEFAULT NULL COMMENT 'drive count',
  `drive_yds` int(3) DEFAULT NULL,
  `drive_play_count` int(3) DEFAULT NULL COMMENT 'Numeric value of how many regular plays happened in a given drive.',
  `drive_result` varchar(30) DEFAULT NULL COMMENT 'drive result',
  `drive_top` varchar(10) DEFAULT NULL COMMENT 'Time of possession in a given drive.',
  `drive_fds` int(2) DEFAULT NULL COMMENT 'Number of first downs in a given drive.',
  `drive_inside20` bit(1) DEFAULT NULL COMMENT 'Binary indicator if the offense was able to get inside the opponents 20 yard line.',
  `drive_score` bit(1) DEFAULT NULL COMMENT 'Binary indicator the drive ended with a score.',
  `drive_start_qtr` tinyint(1) DEFAULT NULL COMMENT 'Numeric value indicating in which quarter the given drive has started.',
  `drive_end_qtr` tinyint(1) DEFAULT NULL COMMENT 'Numeric value indicating in which quarter the given drive has ended.',
  `drive_yds_penalized` int(3) DEFAULT NULL COMMENT 'Numeric value of how many yards the offense gained or lost through penalties in the given drive.',
  `drive_start_transition` varchar(30) DEFAULT NULL COMMENT 'String indicating how the offense got the ball.',
  `drive_end_transition` varchar(30) DEFAULT NULL COMMENT 'String indicating how the offense lost the ball.',
  `drive_game_clock_start` varchar(10) DEFAULT NULL COMMENT 'Game time at the beginning of a given drive.',
  `drive_game_clock_end` varchar(10) DEFAULT NULL COMMENT 'Game time at the end of a given drive.',
  `drive_start_ydl` varchar(10) DEFAULT NULL COMMENT 'String indicating where a given drive started consisting of team half and yard line number.',
  `drive_end_ydl` varchar(10) DEFAULT NULL COMMENT 'String indicating where a given drive ended consisting of team half and yard line number.',
  `drive_start_play_id` int(10) DEFAULT NULL COMMENT 'Play_id of the first play in the given drive.',
  `drive_end_play_id` int(10) DEFAULT NULL COMMENT 'Play_id of the last play in the given drive.',

  `series_seq` int(3) DEFAULT NULL COMMENT 'Starts at 1, each new first down increments, numbers shared across both teams NA: kickoffs, extra point/two point conversion attempts, non-plays, no posteam',
  `series_suc` bit(1) DEFAULT NULL COMMENT '1: scored touchdown, gained enough yards for first down.',
  `series_result` varchar(100) DEFAULT NULL COMMENT 'Possible values: First down, Touchdown, Opp touchdown, Field goal, Missed field goal, Safety, Turnover, Punt, Turnover on downs, QB kneel, End of half',

  `gtg` bit(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not the posteam is in a goal down situation.',

  `score` bit(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not a score occurred on the play.',
  `score_type` varchar(10) DEFAULT NULL COMMENT 'Scoring play type: FG, PAT, PAT2, SFTY, TD',
  `score_team` varchar(4) DEFAULT NULL COMMENT 'Scoring play team',

  `timestamp` varchar(10) DEFAULT NULL,

  `play_clock` tinyint unsigned DEFAULT NULL COMMENT 'Time on the playclock when the ball was snapped.',

  `game_clock_start` varchar(10) DEFAULT NULL COMMENT 'Time at start of play provided in string format as minutes:seconds remaining in the quarter.',
  `game_clock_end` varchar(10) DEFAULT NULL COMMENT 'Game time at the end of a given play.',
  `sec_rem_qtr` int(4) DEFAULT NULL COMMENT 'Numeric seconds remaining in the quarter.',
  `sec_rem_half` int(4) DEFAULT NULL COMMENT 'Numeric seconds remaining in the half.',
  `sec_rem_gm` int(4) DEFAULT NULL COMMENT 'Numeric seconds remaining in the game.',

  `pos_team` varchar(4) DEFAULT NULL,
  `pos_team_id` varchar(36) DEFAULT NULL,

  `off` varchar(3) DEFAULT NULL COMMENT 'offense',
  `def` varchar(3) DEFAULT NULL COMMENT 'defense',

  `deleted` bit(1) DEFAULT NULL,
  `review` text DEFAULT NULL,

  `play_type` enum('CONV', 'FGXP', 'KOFF', 'NOPL', 'PASS', 'PUNT', 'RUSH') DEFAULT NULL,
  `play_type_nfl` varchar(36) DEFAULT NULL,
  `play_type_ngs` varchar(36) DEFAULT NULL,

  `next_play_type` varchar(36) DEFAULT NULL,

  `player_fuml_pid` varchar(25) DEFAULT NULL COMMENT 'fumbling player',
  `player_fuml_gsis` varchar(36) DEFAULT NULL COMMENT 'fumbling player gsis',
  `bc_pid` varchar(25) DEFAULT NULL COMMENT 'ball carrier',
  `bc_gsis` varchar(36) DEFAULT NULL COMMENT 'ball carrier gsis',
  `psr_pid` varchar(25) DEFAULT NULL COMMENT 'passer',
  `psr_gsis` varchar(36) DEFAULT NULL COMMENT 'passer gsis',
  `trg_pid` varchar(25) DEFAULT NULL COMMENT 'targeted player',
  `trg_gsis` varchar(36) DEFAULT NULL COMMENT 'targeted player gsis',
  `intp_pid` varchar(25) DEFAULT NULL COMMENT 'intercepting player',
  `intp_gsis` varchar(36) DEFAULT NULL COMMENT 'intercepting player gsis',

  `yds_gained` tinyint(3) DEFAULT NULL COMMENT 'yardage gained (or lost) by the possessing team',

  `fum` bit(1) DEFAULT NULL COMMENT 'fumble occurred',
  `fuml` bit(1) DEFAULT NULL COMMENT 'fumble lost',
  `int` bit(1) DEFAULT NULL COMMENT 'interception',
  `sk` bit(1) DEFAULT NULL COMMENT 'sack',
  `succ` bit(1) DEFAULT NULL COMMENT 'successful play',
  `comp` bit(1) DEFAULT NULL COMMENT 'completion',
  `incomp` bit(1) DEFAULT NULL COMMENT 'incompletion',
  `trick` bit(1) DEFAULT NULL COMMENT 'trick play',
  `touchback` bit(1) DEFAULT NULL COMMENT 'touchback',
  `safety` bit(1) DEFAULT NULL COMMENT 'safety',
  `penalty` bit(1) DEFAULT NULL COMMENT 'penalty',
  `oob` bit(1) DEFAULT NULL COMMENT '1 if play description contains ran ob, pushed ob, or sacked ob; 0 otherwise.',
  `tfl` bit(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not a tackle for loss on a run play occurred.',
  `rush` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the play was a run.',
  `pass` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the play was a pass attempt (includes sacks).',
  `solo_tk` bit(1) DEFAULT NULL COMMENT 'Binary indicator if the play had a solo tackle (could be multiple due to fumbles).',
  `assist_tk` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if an assist tackle occurred.',

  `special` bit(1) DEFAULT NULL COMMENT 'special teams',
  `special_play_type` varchar(10) DEFAULT NULL COMMENT 'special teams play type',

  `pen_team` varchar(3) DEFAULT NULL COMMENT 'String abbreviation of the team with the penalty.',
  `pen_yds` int(3) DEFAULT NULL COMMENT 'Yards gained (or lost) by the posteam from the penalty.',

  `td` bit(1) DEFAULT NULL COMMENT 'touchdown',
  `ret_td` bit(1) DEFAULT NULL COMMENT 'return touchdown',
  `pass_td` bit(1) DEFAULT NULL COMMENT 'passing touchdown',
  `rush_td` bit(1) DEFAULT NULL COMMENT 'rushing touchdown',
  `td_tm` varchar(5) DEFAULT NULL COMMENT 'touchdown team abbreviation',

  `pass_yds` tinyint(3) DEFAULT NULL COMMENT 'Numeric yards by the passer_player_name, including yards gained in pass plays with laterals. This should equal official passing statistics.',
  `recv_yds` tinyint(3) DEFAULT NULL COMMENT 'Numeric yards by the receiver_player_name, excluding yards gained in pass plays with laterals. This should equal official receiving statistics but could miss yards gained in pass plays with laterals. Please see the description of lateral_receiver_player_name for further information.',
  `rush_yds` tinyint(3) DEFAULT NULL COMMENT 'Numeric yards by the rusher_player_name, excluding yards gained in rush plays with laterals. This should equal official rushing statistics but could miss yards gained in rush plays with laterals. Please see the description of lateral_rusher_player_name for further information.',

  `dot` int(3) DEFAULT NULL COMMENT 'depth of target',
  `tay` tinyint(1) DEFAULT NULL COMMENT 'true air yards, Distance ball travels in the air from point of throw to a receivers hands; back of endzone or sideline.',
  `yac` int(3) DEFAULT NULL COMMENT 'yard after catch',
  `yaco` int(3) DEFAULT NULL COMMENT 'yards after contact',
  `ret_yds` int(3) DEFAULT NULL COMMENT 'return yardage',
  `ret_tm` varchar(5) DEFAULT NULL COMMENT 'return team abbreviation',

  `sg` bit(1) DEFAULT NULL COMMENT 'shotgun',
  `nh` bit(1) DEFAULT NULL COMMENT 'no huddle',
  `pap` bit(1) DEFAULT NULL COMMENT 'play action pass',
  `qbd` bit(1) DEFAULT NULL COMMENT 'QB dropped back on the play (pass attempt, sack, or scrambled).',
  `qbk` bit(1) DEFAULT NULL COMMENT 'QB took a knee.',
  `qbs` bit(1) DEFAULT NULL COMMENT 'QB spiked the ball.',
  `qbru` bit(1) DEFAULT NULL COMMENT 'QB run, a designed running play for the QB. These are only marked on runs by a natural QB where he lined up as a QB. Also, sneaks and kneel-downs are not counted.',
  `sneak` bit(1) DEFAULT NULL COMMENT 'QB sneak',
  `scrm` bit(1) DEFAULT NULL COMMENT 'QB scramble',

  `qb_pressure` tinyint(2) DEFAULT NULL COMMENT 'QB pressure',
  `qb_pressure_ngs` tinyint(2) DEFAULT NULL COMMENT 'QB pressure (NGS)',
  `qb_hit` tinyint(2) DEFAULT NULL COMMENT 'QB hit',
  `qb_hurry` tinyint(2) DEFAULT NULL COMMENT 'QB hurry',

  `int_worthy` bit(1) DEFAULT NULL COMMENT 'interception worthy',
  `cball` bit(1) DEFAULT NULL COMMENT 'catchable ball, A pass in which an eligible receiver has the opportunity to get his hands on the football with reasonable movement, timing, and opportunity.',
  `qbta` bit(1) DEFAULT NULL COMMENT 'QB Throw Away',
  `shov` bit(1) DEFAULT NULL COMMENT 'Shovel/Touch Pass',
  `side` bit(1) DEFAULT NULL COMMENT 'Sideline pass, Balls outside of the field but catchable when the receiver extends body/arms.',
  `high` bit(1) DEFAULT NULL COMMENT 'Highlight pass, Perfect pass that only the receiver can reach. Features perfect placement in a tight window.',

  `drp` bit(1) DEFAULT NULL COMMENT 'dropped pass',
  `cnb` bit(1) DEFAULT NULL COMMENT 'contested ball, Passes into close coverage that involve a physical battle between receiver and defender for control of the ball.',
  `crr` bit(1) DEFAULT NULL COMMENT 'Created Reception, Difficult catches that require exceptional body control; hands; acrobatics, or any combination thereof.',

  `mbt` tinyint(1) DEFAULT NULL COMMENT 'missed or broken tackles',
  `avsk` tinyint(1) DEFAULT NULL COMMENT 'number of avoided sacks',

  `run_location` varchar(10) DEFAULT NULL COMMENT 'String indicator for location of run: left, middle, or right.',
  `run_gap` varchar(10) DEFAULT NULL COMMENT 'String indicator for line gap of run: end, guard, or tackle',

  `option` varchar(3) DEFAULT NULL COMMENT 'option play, values: RPO (run/pass), RUN (run/qbrun)',
  `tlook` bit(1) DEFAULT NULL COMMENT 'trick look',

  `fd` bit(1) DEFAULT NULL COMMENT 'first down',
  `fd_rush` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if a running play converted the first down.',
  `fd_pass` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if a passing play converted the first down.',
  `fd_penalty` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if a penalty converted the first down.',

  `third_down_converted` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the first down was converted on third down.',
  `third_down_failed` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the posteam failed to convert first down on third down.',
  `fourth_down_converted` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the first down was converted on fourth down.',
  `fourth_down_failed` bit(1) DEFAULT NULL COMMENT 'Binary indicator for if the posteam failed to convert first down on fourth down.',

  `htm` bit(1) DEFAULT NULL COMMENT 'hindered throwing motion',
  `zblz` bit(1) DEFAULT NULL COMMENT 'zone blitz, at least one Off-Ball LB rushed the passer instead of a DL who dropped into coverage',
  `stnt` bit(1) DEFAULT NULL COMMENT 'stunt, when any two pass rushers cross, trading pass rush lanes on a passing down',
  `oop` bit(1) DEFAULT NULL COMMENT 'out of pocket pass',
  `phyb` bit(1) DEFAULT NULL COMMENT 'physical ball, Pass target takes significant punishment whether the pass is caught or not. Most Contested Balls will also be a Physical Ball.',
  `bap` bit(1) DEFAULT NULL COMMENT 'batted pass',
  `fread` bit(1) DEFAULT NULL COMMENT 'first read',
  `scre` bit(1) DEFAULT NULL COMMENT 'screen pass',
  `pfp` bit(1) DEFAULT NULL COMMENT 'pain free play, Ball carrier is only lightly touched by a defender on the field (ie QB slide) or runs out of bounds with little or no physical contact with the defender or sideline personnel/equipment. Includes TDs',
  `qbsk` bit(1) DEFAULT NULL COMMENT 'qb sack, QB was to blame for the sack: held ball too long; missed wide open receiver etc',

  `ttscrm` decimal(3,1) DEFAULT NULL COMMENT 'time to scramble',
  `ttp` decimal(3,1) DEFAULT NULL COMMENT 'time to pass',
  `ttsk` decimal(3,1) DEFAULT NULL COMMENT 'time to sack',
  `ttpr` decimal(3,1) DEFAULT NULL COMMENT 'time to pressure',

  `back` tinyint(2) DEFAULT NULL COMMENT 'number in backfield (wr, rb, te, fb)',
  `xlm` tinyint(1) DEFAULT NULL COMMENT 'extra men on the line, Number of players lined up on either side of the Offensive Tackles - usually a Tight End.',
  `db` tinyint(2) DEFAULT NULL COMMENT 'number of defensive backs',
  `box` tinyint(2) DEFAULT NULL COMMENT 'number of defenders in the box',
  `boxdb` tinyint(2) DEFAULT NULL COMMENT 'number of dbs in the box',
  `pru` tinyint(1) DEFAULT NULL COMMENT 'pass rushers',
  `blz` tinyint(1) DEFAULT NULL COMMENT 'number of LBs and DBs blitzing',
  `dblz` tinyint(1) DEFAULT NULL COMMENT 'Number of DBs blitzing',
  `oopd` varchar(2) DEFAULT NULL COMMENT 'out of pocket pass details, Clean [C], Pressure [P], Designed [D], Designed Rollout [DR]',
  `cov` tinyint(1) DEFAULT NULL COMMENT 'coverage on target, Uncovered is 0, single coverage is 1, double is 2.',

  `ep` decimal(16,12) DEFAULT NULL COMMENT 'Using the scoring event probabilities, the estimated expected points with respect to the possession team for the given play.',
  `epa` decimal(16,12) DEFAULT NULL COMMENT 'Expected points added (EPA) by the posteam for the given play.',
  `ep_succ` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator wheter epa > 0 in the given play.',

  `total_home_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total EPA for the home team in the game so far.',
  `total_away_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total EPA for the away team in the game so far.',
  `total_home_rush_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing EPA for the home team in the game so far.',
  `total_away_rush_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing EPA for the away team in the game so far.',
  `total_home_pass_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing EPA for the home team in the game so far.',
  `total_away_pass_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing EPA for the away team in the game so far.',

  `qb_epa` decimal(16,12) DEFAULT NULL COMMENT 'Gives QB credit for EPA for up to the point where a receiver lost a fumble after a completed catch and makes EPA work more like passing yards on plays with fumbles.',
  `air_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the air yards alone. For completions this represents the actual value provided through the air. For incompletions this represents the hypothetical value that could have been added through the air if the pass was completed.',
  `yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the yards after catch alone. For completions this represents the actual value provided after the catch. For incompletions this represents the difference between the hypothetical air_epa and the plays raw observed EPA (how much the incomplete pass cost the posteam).',
  `comp_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the air yards alone only for completions.',
  `comp_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'EPA from the yards after catch alone only for completions.',
  `xyac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Expected value of EPA gained after the catch, starting from where the catch was made. Zero yards after the catch would be listed as zero EPA.',
  `total_home_comp_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air EPA for the home team in the game so far.',
  `total_away_comp_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air EPA for the away team in the game so far.',
  `total_home_comp_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac EPA for the home team in the game so far.',
  `total_away_comp_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac EPA for the away team in the game so far.',
  `total_home_raw_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air EPA for the home team in the game so far.',
  `total_away_raw_air_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air EPA for the away team in the game so far.',
  `total_home_raw_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac EPA for the home team in the game so far.',
  `total_away_raw_yac_epa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac EPA for the away team in the game so far.',

  `wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the posteam given the current situation at the start of the given play',
  `wpa` decimal(16,12) DEFAULT NULL COMMENT 'Win probability added (WPA) for the posteam',
  `home_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the home team',
  `away_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the away team',
  `vegas_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Win probability added (WPA) for the posteam: spread adjusted model',
  `vegas_home_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Win probability added (WPA) for the home team: spread adjusted model',
  `home_wp_post` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the home team at the end of the play',
  `away_wp_post` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the away team at the end of the play',
  `vegas_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the posteam given the current situation at the start of the given play, incorporating pre-game Vegas line',
  `vegas_home_wp` decimal(16,12) DEFAULT NULL COMMENT 'Estimated win probability for the home team incorporating pre-game Vegas line',
  `total_home_rush_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing WPA for the home team in the game so far',
  `total_away_rush_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total rushing WPA for the away team in the game so far',
  `total_home_pass_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing WPA for the home team in the game so far',
  `total_away_pass_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total passing WPA for the away team in the game so far',
  `air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'WPA through the air (same logic as air_epa)',
  `yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'WPA from yards after the catch (same logic as yac_epa)',
  `comp_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'The air_wpa for completions only',
  `comp_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'The yac_wpa for completions only',
  `total_home_comp_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air WPA for the home team in the game so far',
  `total_away_comp_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions air WPA for the away team in the game so far',
  `total_home_comp_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac WPA for the home team in the game so far',
  `total_away_comp_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total completions yac WPA for the away team in the game so far',
  `total_home_raw_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air WPA for the home team in the game so far',
  `total_away_raw_air_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw air WPA for the away team in the game so far',
  `total_home_raw_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac WPA for the home team in the game so far',
  `total_away_raw_yac_wpa` decimal(16,12) DEFAULT NULL COMMENT 'Cumulative total raw yac WPA for the away team in the game so far',

  `xyac_mean_yds` decimal(16,12) DEFAULT NULL COMMENT 'Average expected yards after the catch based on where the ball was caught',
  `xyac_median_yds` decimal(16,12) DEFAULT NULL COMMENT 'Median expected yards after the catch based on where the ball was caught',
  `xyac_succ_prob` decimal(16,12) DEFAULT NULL COMMENT 'Probability play earns positive EPA (relative to where play started) based on where ball was caught',
  `xyac_fd_prob` decimal(16,12) DEFAULT NULL COMMENT 'Probability play earns a first down based on where the ball was caught',

  `ep_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for extra point attempt',
  `two_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for two point conversion attempt',
  `fg_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for field goal attempt',
  `kickoff_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for kickoff',
  `punt_att` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for punts',

  `fg_result` varchar(10) DEFAULT NULL COMMENT 'String indicator for result of field goal attempt: made, missed, or blocked',
  `kick_distance` int(3) DEFAULT NULL COMMENT 'Numeric distance in yards for kickoffs, field goals, and punts',
  `ep_result` varchar(10) DEFAULT NULL COMMENT 'String indicator for the result of the extra point attempt: good, failed, blocked, safety (touchback in defensive endzone is 1 point apparently), or aborted',
  `tp_result` varchar(10) DEFAULT NULL COMMENT 'String indicator for result of two point conversion attempt: success, failure, safety (touchback in defensive endzone is 1 point apparently), or return',
  `punt_blocked` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for if the punt was blocked',

  `home_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Numeric timeouts remaining in the half for the home team',
  `away_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Numeric timeouts remaining in the half for the away team',
  `pos_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Number of timeouts remaining for the possession team',
  `def_to_rem` tinyint(1) DEFAULT NULL COMMENT 'Number of timeouts remaining for the team on defense',
  `to` tinyint(1) DEFAULT NULL COMMENT 'Binary indicator for whether or not a timeout was called by either team',
  `to_team` varchar(3) DEFAULT NULL COMMENT 'String abbreviation for which team called the timeout',

  `home_score` tinyint(2) DEFAULT NULL COMMENT 'Score for the home team at the end of the play',
  `away_score` tinyint(2) DEFAULT NULL COMMENT 'Score for the away team at the end of the play',
  `pos_score` tinyint(2) DEFAULT NULL COMMENT 'Score the posteam at the start of the play',
  `def_score` tinyint(2) DEFAULT NULL COMMENT 'Score the defteam at the start of the play',
  `score_diff` tinyint(2) DEFAULT NULL COMMENT 'Score differential between the posteam and defteam at the start of the play',
  `pos_score_post` tinyint(2) DEFAULT NULL COMMENT 'Score for the posteam at the end of the play',
  `def_score_post` tinyint(2) DEFAULT NULL COMMENT 'Score for the defteam at the end of the play',
  `score_diff_post` tinyint(2) DEFAULT NULL COMMENT 'Score differential between the posteam and defteam at the end of the play',

  `no_score_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of no score occurring for the rest of the half based on the expected points model',
  `opp_fg_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the defteam scoring a FG next',
  `opp_safety_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the defteam scoring a safety next',
  `opp_td_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the defteam scoring a TD next',
  `fg_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring a FG next',
  `safety_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring a safety next',
  `td_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring a TD next',
  `extra_point_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring an extra point',
  `two_conv_prob` decimal(16,12) DEFAULT NULL COMMENT 'Predicted probability of the posteam scoring the two point conversion',

  `xpass_prob` decimal(16,12) DEFAULT NULL COMMENT 'Probability of dropback scaled from 0 to 1',
  `pass_oe` decimal(16,12) DEFAULT NULL COMMENT 'Dropback percent over expected on a given play scaled from 0 to 100',

  `cp` decimal(16,12) DEFAULT NULL COMMENT 'Numeric value indicating the probability for a complete pass based on comparable game situations',
  `cpoe` decimal(16,12) DEFAULT NULL COMMENT 'For a single pass play this is 1 - cp when the pass was completed or 0 - cp when the pass was incomplete. Analyzed for a whole game or season an indicator for the passer how much over or under expectation his completion percentage was',

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
  UNIQUE KEY `play_stat` (`esbid`,`playId`,`statId`,`playerName`)
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
  `formatted_status` varchar(100) DEFAULT NULL,
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

  `espn_open_score` smallint(3) UNSIGNED DEFAULT 0,
  `espn_catch_score` smallint(3) UNSIGNED DEFAULT 0,
  `espn_overall_score` smallint(3) UNSIGNED DEFAULT 0,
  `espn_yac_score` smallint(3) UNSIGNED DEFAULT 0,

  `espn_rtm_routes` smallint(3) UNSIGNED DEFAULT 0,
  `espn_rtm_targets` smallint(3) UNSIGNED DEFAULT 0,
  `espn_rtm_recv_yds` smallint(4) UNSIGNED DEFAULT 0,
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
  `points` decimal(6,3) DEFAULT NULL,
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
  `source_id` ENUM('BETONLINE', 'BETMGM', 'BETRIVERS', 'BOVADA', 'CAESARS', 'DRAFTKINGS', 'FANDUEL', 'GAMBET', 'PRIZEPICKS') NOT NULL,
  `timestamp` int(11) NOT NULL,
  `time_type` ENUM('OPEN', 'CLOSE') NOT NULL,

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
  UNIQUE KEY `prop` (`source_id`, `pid`, `week`, `year`, `prop_type`, `ln`, `time_type`), -- TODO remove week, year and add esbid
  KEY `hits_soft` (`hits_soft`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_markets_history`
--

DROP TABLE IF EXISTS `prop_markets_history`;

CREATE TABLE `prop_markets_history` (
  `source_id` ENUM('BETONLINE', 'BETMGM', 'BETRIVERS', 'BOVADA', 'CAESARS', 'DRAFTKINGS', 'FANDUEL', 'GAMBET', 'PRIZEPICKS') NOT NULL,
  `source_market_id` varchar(255) NOT NULL,
  `source_market_name` varchar(500) DEFAULT NULL,

  `open` tinyint(1) DEFAULT NULL,
  `live` tinyint(1) DEFAULT NULL,
  `selection_count` smallint unsigned NOT NULL,

  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `market` (`source_id`, `source_market_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_markets_index`
--

DROP TABLE IF EXISTS `prop_markets_index`;

CREATE TABLE `prop_markets_index` (
  `market_type` tinyint(1) unsigned DEFAULT NULL,

  `source_id` ENUM('BETONLINE', 'BETMGM', 'BETRIVERS', 'BOVADA', 'CAESARS', 'DRAFTKINGS', 'FANDUEL', 'GAMBET', 'PRIZEPICKS') NOT NULL,
  `source_market_id` varchar(255) NOT NULL,
  `source_market_name` varchar(500) DEFAULT NULL,

  `esbid` int(10) unsigned DEFAULT NULL,
  `source_event_id` varchar(255) DEFAULT NULL,
  `source_event_name` varchar(255) DEFAULT NULL,

  `open` tinyint(1) DEFAULT NULL,
  `live` tinyint(1) DEFAULT NULL,
  `selection_count` smallint unsigned NOT NULL,

  `settled` tinyint(1) DEFAULT NULL,
  `winning_selection_id` varchar(255) DEFAULT NULL,
  `metric_result_value` decimal(6,1) DEFAULT NULL,

  `time_type` ENUM('OPEN', 'CLOSE') NOT NULL,
  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `market` (`source_id`, `source_market_id`, `time_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_market_selections_history`
--

DROP TABLE IF EXISTS `prop_market_selections_history`;

CREATE TABLE `prop_market_selections_history` (
  `source_id` ENUM('BETONLINE', 'BETMGM', 'BETRIVERS', 'BOVADA', 'CAESARS', 'DRAFTKINGS', 'FANDUEL', 'GAMBET', 'PRIZEPICKS') NOT NULL,
  `source_market_id` varchar(255) NOT NULL,
  `source_selection_id` varchar(255) NOT NULL,

  `selection_name` varchar(255) DEFAULT NULL,
  `selection_metric_line` decimal(6,1) DEFAULT NULL,
  `odds_decimal` decimal(15,3) DEFAULT NULL,
  `odds_american` int(11) DEFAULT NULL,

  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `market_selection` (`source_id`, `source_market_id`, `source_selection_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_market_selections_index`
--

DROP TABLE IF EXISTS `prop_market_selections_index`;

CREATE TABLE `prop_market_selections_index` (
  `source_id` ENUM('BETONLINE', 'BETMGM', 'BETRIVERS', 'BOVADA', 'CAESARS', 'DRAFTKINGS', 'FANDUEL', 'GAMBET', 'PRIZEPICKS') NOT NULL,
  `source_market_id` varchar(255) NOT NULL,
  `source_selection_id` varchar(255) NOT NULL,

  `selection_pid` varchar(25) DEFAULT NULL,
  `selection_name` varchar(255) DEFAULT NULL,
  `selection_metric_line` decimal(6,1) DEFAULT NULL,
  `odds_decimal` decimal(15,3) DEFAULT NULL,
  `odds_american` int(11) DEFAULT NULL,

  `result` ENUM('PENDING','WON','LOST','PUSH','CANCELLED') DEFAULT NULL,

  `timestamp` int(11) NOT NULL,
  `time_type` ENUM('OPEN', 'CLOSE') NOT NULL,
  UNIQUE KEY `market` (`source_id`, `source_market_id`, `source_selection_id`, `time_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `prop_pairings`
--

DROP TABLE IF EXISTS `prop_pairings`;

CREATE TABLE `prop_pairings` (
  `pairing_id` varchar(30) NOT NULL,
  `source_id` ENUM('BETONLINE', 'BETMGM', 'BETRIVERS', 'BOVADA', 'CAESARS', 'DRAFTKINGS', 'FANDUEL', 'GAMBET', 'PRIZEPICKS') NOT NULL,
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
  `second_lowest_payout` MEDIUMINT DEFAULT NULL,
  `sum_hist_rate_soft` decimal(5,4) DEFAULT NULL,
  `sum_hist_rate_hard` decimal(5,4) DEFAULT NULL,
  PRIMARY KEY (`pairing_id`),
  KEY `source_id` (`source_id`),
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
  `week` tinyint(2) NOT NULL,
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

-- --------------------------------------------------------

--
-- Table structure for table `league_team_daily_values`
--

DROP TABLE IF EXISTS `league_team_daily_values`;

CREATE TABLE `league_team_daily_values` (
  `lid` int(6) NOT NULL,
  `tid` int(6) NOT NULL,
  `date` date NOT NULL,
  `timestamp` bigint(20) NOT NULL,
  `ktc_value` int(6) DEFAULT NULL,
  `ktc_share` decimal(5,5) DEFAULT NULL,
  UNIQUE KEY `league_team` (`lid`, `tid`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `play_changelog`
--

DROP TABLE IF EXISTS `play_changelog`;

CREATE TABLE `play_changelog` (
  `esbid` int(10) unsigned NOT NULL,
  `playId` int(10) unsigned NOT NULL,
  `prop` varchar(100) NOT NULL,
  `prev` varchar(400) NOT NULL,
  `new` varchar(400) DEFAULT NULL,
  `timestamp` int(11) NOT NULL,
  UNIQUE KEY `play` (`esbid`, `playId`, `prop`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `player_aliases`
--

DROP TABLE IF EXISTS `player_aliases`;

CREATE TABLE `player_aliases` (
  `pid` varchar(25) NOT NULL,
  `formatted_alias` varchar(100) NOT NULL,
  UNIQUE KEY `alias` (`pid`, `formatted_alias`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

-- Table structure for table `placed_wagers`
--

DROP TABLE IF EXISTS `placed_wagers`;

CREATE TABLE `placed_wagers` (
  `wager_id` int(11) NOT NULL AUTO_INCREMENT,
  `userid` int(6) NOT NULL,

  `public` tinyint(1) DEFAULT 0,

  `wager_type` ENUM('SINGLE', 'PARLAY', 'ROUND_ROBIN') NOT NULL,
  -- `wager_sub_type` varchar(255) NOT NULL,
  `placed_at` int(11) NOT NULL,
  `bet_count` tinyint(2) NOT NULL,
  `selection_count` tinyint(2) NOT NULL,
  `selection_lost` tinyint(2) DEFAULT 0,

  `wager_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') NOT NULL, -- win includes partial wins for round robins
  `bet_wager_amount` decimal(7,2) NOT NULL,
  `total_wager_amount` decimal(7,2) NOT NULL,
  `wager_returned_amount` decimal(12,2) NOT NULL,
  `book_id` ENUM('DRAFTKINGS', 'FANDUEL') NOT NULL,
  `book_wager_id` varchar(255) NOT NULL,

  `selection_1_id` varchar(255) DEFAULT NULL,
  `selection_1_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_1_odds` int(11) DEFAULT NULL,

  `selection_2_id` varchar(255) DEFAULT NULL,
  `selection_2_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_2_odds` int(11) DEFAULT NULL,

  `selection_3_id` varchar(255) DEFAULT NULL,
  `selection_3_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_3_odds` int(11) DEFAULT NULL,

  `selection_4_id` varchar(255) DEFAULT NULL,
  `selection_4_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_4_odds` int(11) DEFAULT NULL,

  `selection_5_id` varchar(255) DEFAULT NULL,
  `selection_5_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_5_odds` int(11) DEFAULT NULL,

  `selection_6_id` varchar(255) DEFAULT NULL,
  `selection_6_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_6_odds` int(11) DEFAULT NULL,

  `selection_7_id` varchar(255) DEFAULT NULL,
  `selection_7_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_7_odds` int(11) DEFAULT NULL,

  `selection_8_id` varchar(255) DEFAULT NULL,
  `selection_8_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_8_odds` int(11) DEFAULT NULL,

  `selection_9_id` varchar(255) DEFAULT NULL,
  `selection_9_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_9_odds` int(11) DEFAULT NULL,

  `selection_10_id` varchar(255) DEFAULT NULL,
  `selection_10_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_10_odds` int(11) DEFAULT NULL,

  `selection_11_id` varchar(255) DEFAULT NULL,
  `selection_11_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_11_odds` int(11) DEFAULT NULL,

  `selection_12_id` varchar(255) DEFAULT NULL,
  `selection_12_status` ENUM('OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED') DEFAULT NULL,
  `selection_12_odds` int(11) DEFAULT NULL,

  PRIMARY KEY (`wager_id`),
  KEY `userid` (`userid`),
  KEY `placed_at` (`placed_at`),

  UNIQUE KEY `wager` (`book_wager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `user_table_views`
--

DROP TABLE IF EXISTS `user_table_views`;

CREATE TABLE `user_table_views` (
  `view_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `view_name` varchar(30) NOT NULL,
  `view_description` text DEFAULT NULL,
  `table_name` varchar(255) NOT NULL,
  `table_state` json DEFAULT NULL,
  `user_id` binary(16) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  check (
    updated_at is null
    or updated_at >= created_at
  ),
  PRIMARY KEY (`view_id`),
  UNIQUE KEY `table_view` (`view_name`, `user_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
