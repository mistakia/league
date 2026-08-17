-- STATUS: APPLIED 2026-08-17 against league_production
--
-- Add `leagues.discord_announcements_webhook_url`, the delivery address for
-- `scripts/announce-draft-slate.mjs`.
--
-- A second per-league webhook rather than a reuse of the first, because they
-- are different channels with different audiences. `discord_webhook_url` points
-- at the league's transactions-and-events channel, where `sendNotifications`
-- posts one line per completed transaction; a daily draft schedule posted into
-- that stream is buried by the picks it is trying to give notice of. The
-- announcements channel is where the league's managers read commissioner
-- notices, and a Discord webhook is bound to one channel, so reaching a second
-- channel requires a second URL and there is no way around that.
--
-- Nullable with no default, matching `discord_webhook_url` beside it. A league
-- that does not use Discord has neither, and the announcer skips it. A league
-- that has the first and not the second is reported by the announcer as a
-- shortfall rather than silently skipped -- that combination is a live draft
-- whose schedule reaches nobody.
--
-- varchar(255) matches the column it sits next to. Discord webhook URLs run to
-- roughly 120 characters, so the width is not close to binding.

ALTER TABLE leagues
  ADD COLUMN discord_announcements_webhook_url character varying(255);

-- Post-condition: the column exists, is nullable, and no row was given a value
-- by the add. The value for league 1 is set separately -- it is a credential,
-- and it does not belong in a file that lives in git.
DO $$
DECLARE
    column_is_nullable text;
    populated_rows integer;
BEGIN
    SELECT is_nullable INTO column_is_nullable
      FROM information_schema.columns
     WHERE table_name = 'leagues'
       AND column_name = 'discord_announcements_webhook_url';

    IF column_is_nullable IS NULL THEN
        RAISE EXCEPTION
            'post-condition failed: leagues.discord_announcements_webhook_url was not created';
    END IF;

    IF column_is_nullable <> 'YES' THEN
        RAISE EXCEPTION
            'post-condition failed: expected a nullable column, got is_nullable=%',
            column_is_nullable;
    END IF;

    SELECT count(*) INTO populated_rows
      FROM leagues
     WHERE discord_announcements_webhook_url IS NOT NULL;

    IF populated_rows <> 0 THEN
        RAISE EXCEPTION
            'post-condition failed: % league row(s) already carry a value',
            populated_rows;
    END IF;
END $$;
