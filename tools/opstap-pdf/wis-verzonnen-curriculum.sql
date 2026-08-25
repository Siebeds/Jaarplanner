-- One-off: clear the synthetic curriculum so the first real Op.stap import starts on empty tables.
-- Authorised by the project owner, 2026-08-25 ("alle verzonnen doelen weg").
--
-- WHY A WIPE AND NOT THE IMPORTER'S OWN PURGE. The re-import path is deliberately non-destructive:
-- a goal absent from the new file is flagged `niet_meer_in_opstap`, never deleted, and a goal that
-- teacher content links cannot be deleted at all (FK Restrict, Art. IV.2). That is right for real
-- curriculum data and wrong here, because none of what is in these tables is curriculum data. All
-- 304 leerplandoelen were test fixtures (`*-CHK-*`), demo rows (`DEMO-*`) or browser-pass leftovers
-- (`TR-*`), and all 3 minimumdoelen were fixtures. Importing on top of them would flag every one as
-- "niet meer in Op.stap" and keep counting them in the dekkingsnoemer.
--
-- THE LINKS GO FIRST because every FK into the curriculum is Restrict. They pointed at goals that
-- never existed, so nothing real is lost. The demo thema's, subthema's and activiteiten themselves
-- are NOT touched and can be linked to real doelen after the import.
--
-- Safe now, and only now: this stops being true the moment a teacher links real content to a real
-- goal.
--
-- Back up first. Restore with `psql -d <db> -f curriculum-<db>.sql`:
--   pg_dump -h 127.0.0.1 -U jaarplanner -d <db> --data-only --column-inserts \
--     -t leerplandoelen -t minimumdoelen -t themadoelen -t subdoelen \
--     -t '"activiteiten_Doelkoppelingen"' -t thema_doelsuggesties -f curriculum-<db>.sql
--
-- Run against every database that carries the fixtures (jaarplanner and jaarplanner_ov):
--   psql -h 127.0.0.1 -U jaarplanner -d <db> -f wis-verzonnen-curriculum.sql

BEGIN;

DELETE FROM thema_doelsuggesties;
DELETE FROM "activiteiten_Doelkoppelingen";
DELETE FROM subdoelen;
DELETE FROM themadoelen;
DELETE FROM leerplandoelen;
DELETE FROM minimumdoelen;

-- Expect 0 and 0. Anything else means a fixture survived and the import will flag it.
SELECT (SELECT count(*) FROM leerplandoelen) AS leerplandoelen,
       (SELECT count(*) FROM minimumdoelen) AS minimumdoelen;

COMMIT;
