using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// A thema placement gets its own first and last day (FB-035, ADR-0053), and every existing plan is converted by the
    /// owner's rules of 2026-09-16 (ADR-0053 decision 8):
    /// <list type="number">
    /// <item>a rejected placement is deleted;</item>
    /// <item>a period holding one placement gives it its first and last schooldag;</item>
    /// <item>a period holding several puts them one after another from its first schooldag, in their current order
    /// (by thema id, as the plan listed them), each with its thema's proposed end, cut before the next occupied period
    /// and split at vacations; one left with no free day is deleted;</item>
    /// <item>every group, the lone placement included, ends before the next group's first schooldag, so no two rows
    /// share a day even when a stale start lies inside a period;</item>
    /// <item>a placement whose start matches no period is treated like one of several: it starts on the first schooldag
    /// from that date.</item>
    /// </list>
    /// <para>
    /// <b>The calendar rules are written out in PL/pgSQL once, here.</b> They repeat <c>Themakalender</c> (a schooldag, a
    /// lesweek, the proposed end, the split) and the seam's themaperiode arithmetic (5 weeks, the only value ever
    /// configured). The functions live in <c>pg_temp</c>, so they vanish with the migration's session and nothing calls
    /// them again. <c>ThemaplaatsingDatumsMigratieTests</c> pins the result against dates worked out by hand.
    /// </para>
    /// </summary>
    public partial class ThemaplaatsingDatums : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_themaplaatsingen_JaarplanId_BlokStart",
                table: "themaplaatsingen");

            // Dropped before the conversion: a thema split around a vacation gets a second row with the same period.
            migrationBuilder.DropIndex(
                name: "IX_themaplaatsingen_JaarplanId_ThemaId_BlokNiveau_BlokStart",
                table: "themaplaatsingen");

            migrationBuilder.AddColumn<DateOnly>(
                name: "Van",
                table: "themaplaatsingen",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "Tot",
                table: "themaplaatsingen",
                type: "date",
                nullable: true);

            migrationBuilder.Sql(Functies);
            migrationBuilder.Sql(Omzetting);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "Van",
                table: "themaplaatsingen",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "Tot",
                table: "themaplaatsingen",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "BlokNiveau",
                table: "themaplaatsingen");

            migrationBuilder.DropColumn(
                name: "BlokStart",
                table: "themaplaatsingen");

            migrationBuilder.CreateIndex(
                name: "IX_themaplaatsingen_JaarplanId_Van",
                table: "themaplaatsingen",
                columns: new[] { "JaarplanId", "Van" },
                unique: true);
        }

        /// <summary>
        /// Back to periods, lossily: each placement keys on its own first day as a themaperiode start. Such a date is
        /// rarely a period boundary, so the old code shows those placements as stale; the days are not lost.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_themaplaatsingen_JaarplanId_Van",
                table: "themaplaatsingen");

            migrationBuilder.AddColumn<string>(
                name: "BlokNiveau",
                table: "themaplaatsingen",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Themaperiode");

            migrationBuilder.AddColumn<DateOnly>(
                name: "BlokStart",
                table: "themaplaatsingen",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.Sql("UPDATE themaplaatsingen SET \"BlokStart\" = \"Van\";");

            migrationBuilder.DropColumn(
                name: "Van",
                table: "themaplaatsingen");

            migrationBuilder.DropColumn(
                name: "Tot",
                table: "themaplaatsingen");

            migrationBuilder.CreateIndex(
                name: "IX_themaplaatsingen_JaarplanId_BlokStart",
                table: "themaplaatsingen",
                columns: new[] { "JaarplanId", "BlokStart" });

            migrationBuilder.CreateIndex(
                name: "IX_themaplaatsingen_JaarplanId_ThemaId_BlokNiveau_BlokStart",
                table: "themaplaatsingen",
                columns: new[] { "JaarplanId", "ThemaId", "BlokNiveau", "BlokStart" },
                unique: true);
        }

        // The calendar rules of Themakalender and the seam's themaperiodes, as session-local functions.
        private const string Functies = """
            CREATE FUNCTION pg_temp.fb035_is_schooldag(p_sj uuid, p_d date) RETURNS boolean
            LANGUAGE sql STABLE AS $f$
                SELECT extract(isodow FROM p_d) < 6
                   AND EXISTS (SELECT 1 FROM schooljaren s
                               WHERE s."Id" = p_sj AND p_d BETWEEN s."Start" AND s."Eind")
                   AND NOT EXISTS (SELECT 1 FROM schoolsluitingen c
                                   WHERE c."SchooljaarId" = p_sj AND p_d BETWEEN c."Start" AND c."Eind")
            $f$;

            CREATE FUNCTION pg_temp.fb035_is_vakantie(p_sj uuid, p_d date) RETURNS boolean
            LANGUAGE sql STABLE AS $f$
                SELECT EXISTS (SELECT 1 FROM schoolsluitingen c
                               WHERE c."SchooljaarId" = p_sj AND c."Soort" = 'Vakantie'
                                 AND p_d BETWEEN c."Start" AND c."Eind")
            $f$;

            CREATE FUNCTION pg_temp.fb035_is_lesweek(p_sj uuid, p_maandag date) RETURNS boolean
            LANGUAGE sql STABLE AS $f$
                SELECT EXISTS (SELECT 1 FROM generate_series(0, 4) AS g(n)
                               WHERE pg_temp.fb035_is_schooldag(p_sj, p_maandag + g.n))
            $f$;

            CREATE FUNCTION pg_temp.fb035_volgende_schooldag(p_sj uuid, p_d date) RETURNS date
            LANGUAGE plpgsql STABLE AS $f$
            DECLARE
                v_start date;
                v_eind date;
                v_dag date;
            BEGIN
                SELECT "Start", "Eind" INTO v_start, v_eind FROM schooljaren WHERE "Id" = p_sj;
                v_dag := greatest(p_d, v_start);
                WHILE v_dag <= v_eind LOOP
                    IF pg_temp.fb035_is_schooldag(p_sj, v_dag) THEN
                        RETURN v_dag;
                    END IF;
                    v_dag := v_dag + 1;
                END LOOP;
                RETURN NULL;
            END
            $f$;

            CREATE FUNCTION pg_temp.fb035_vorige_schooldag(p_sj uuid, p_d date) RETURNS date
            LANGUAGE plpgsql STABLE AS $f$
            DECLARE
                v_start date;
                v_eind date;
                v_dag date;
            BEGIN
                SELECT "Start", "Eind" INTO v_start, v_eind FROM schooljaren WHERE "Id" = p_sj;
                v_dag := least(p_d, v_eind);
                WHILE v_dag >= v_start LOOP
                    IF pg_temp.fb035_is_schooldag(p_sj, v_dag) THEN
                        RETURN v_dag;
                    END IF;
                    v_dag := v_dag - 1;
                END LOOP;
                RETURN NULL;
            END
            $f$;

            -- Themakalender.VoorgesteldEinde: the last schooldag before the same weekday p_weken lesweken later, counting
            -- past the year over virtual full weeks and cutting to the last schooldag.
            CREATE FUNCTION pg_temp.fb035_voorgesteld_einde(p_sj uuid, p_begin date, p_weken int) RETURNS date
            LANGUAGE plpgsql STABLE AS $f$
            DECLARE
                v_eind date;
                v_maandag date;
                v_weekdag int;
                v_geteld int := 0;
                v_einde date;
            BEGIN
                SELECT "Eind" INTO v_eind FROM schooljaren WHERE "Id" = p_sj;
                v_maandag := p_begin - (extract(isodow FROM p_begin)::int - 1);
                v_weekdag := p_begin - v_maandag;
                LOOP
                    IF v_maandag + 4 > v_eind OR pg_temp.fb035_is_lesweek(p_sj, v_maandag) THEN
                        v_geteld := v_geteld + 1;
                        EXIT WHEN v_geteld = p_weken + 1;
                    END IF;
                    v_maandag := v_maandag + 7;
                END LOOP;

                v_einde := v_maandag + v_weekdag - 1;
                WHILE v_einde > p_begin AND NOT (
                    CASE WHEN v_einde > v_eind THEN extract(isodow FROM v_einde) < 6
                         ELSE pg_temp.fb035_is_schooldag(p_sj, v_einde) END) LOOP
                    v_einde := v_einde - 1;
                END LOOP;

                IF v_einde > v_eind THEN
                    RETURN coalesce(pg_temp.fb035_vorige_schooldag(p_sj, v_eind), v_eind);
                END IF;
                RETURN v_einde;
            END
            $f$;

            -- Themakalender.Splits: cut at every vacation, trim each part to schooldagen, drop an empty part.
            CREATE FUNCTION pg_temp.fb035_splits(p_sj uuid, p_van date, p_tot date)
                RETURNS TABLE (deel_van date, deel_tot date)
            LANGUAGE plpgsql STABLE AS $f$
            DECLARE
                v_dag date := p_van;
                v_eerste date;
                v_laatste date;
            BEGIN
                WHILE v_dag <= p_tot LOOP
                    IF pg_temp.fb035_is_vakantie(p_sj, v_dag) THEN
                        IF v_eerste IS NOT NULL THEN
                            deel_van := v_eerste;
                            deel_tot := v_laatste;
                            RETURN NEXT;
                        END IF;
                        v_eerste := NULL;
                        v_laatste := NULL;
                    ELSIF pg_temp.fb035_is_schooldag(p_sj, v_dag) THEN
                        IF v_eerste IS NULL THEN
                            v_eerste := v_dag;
                        END IF;
                        v_laatste := v_dag;
                    END IF;
                    v_dag := v_dag + 1;
                END LOOP;
                IF v_eerste IS NOT NULL THEN
                    deel_van := v_eerste;
                    deel_tot := v_laatste;
                    RETURN NEXT;
                END IF;
            END
            $f$;

            -- GeconfigureerdePlanningsblokIndeling.VerdeelGelijkmatig with a themaperiode of 5 weeks (35 days).
            CREATE FUNCTION pg_temp.fb035_verdeel(p_start date, p_eind date)
                RETURNS TABLE (blok_start date, blok_eind date)
            LANGUAGE plpgsql IMMUTABLE AS $f$
            DECLARE
                v_dagen int := p_eind - p_start + 1;
                v_aantal int;
                v_basis int;
                v_extra int;
                v_cursor date := p_start;
                v_lengte int;
            BEGIN
                v_aantal := greatest(1, round(v_dagen::numeric / 35)::int);
                v_basis := v_dagen / v_aantal;
                v_extra := v_dagen % v_aantal;
                FOR i IN 0 .. v_aantal - 1 LOOP
                    v_lengte := v_basis + CASE WHEN i < v_extra THEN 1 ELSE 0 END;
                    blok_start := v_cursor;
                    blok_eind := v_cursor + v_lengte - 1;
                    RETURN NEXT;
                    v_cursor := v_cursor + v_lengte;
                END LOOP;
            END
            $f$;

            -- Schooljaar.Lesperiodes, each divided into themaperiodes.
            CREATE FUNCTION pg_temp.fb035_themaperiodes(p_sj uuid)
                RETURNS TABLE (blok_start date, blok_eind date)
            LANGUAGE plpgsql STABLE AS $f$
            DECLARE
                v_start date;
                v_eind date;
                v_cursor date;
                v_vakantie record;
            BEGIN
                SELECT "Start", "Eind" INTO v_start, v_eind FROM schooljaren WHERE "Id" = p_sj;
                v_cursor := v_start;
                FOR v_vakantie IN
                    SELECT c."Start" AS van, c."Eind" AS tot FROM schoolsluitingen c
                    WHERE c."SchooljaarId" = p_sj AND c."Soort" = 'Vakantie'
                    ORDER BY c."Start"
                LOOP
                    IF v_vakantie.van > v_cursor THEN
                        RETURN QUERY SELECT v.blok_start, v.blok_eind FROM pg_temp.fb035_verdeel(v_cursor, v_vakantie.van - 1) v;
                    END IF;
                    IF v_vakantie.tot >= v_cursor THEN
                        v_cursor := v_vakantie.tot + 1;
                    END IF;
                END LOOP;
                IF v_cursor <= v_eind THEN
                    RETURN QUERY SELECT v.blok_start, v.blok_eind FROM pg_temp.fb035_verdeel(v_cursor, v_eind) v;
                END IF;
            END
            $f$;
            """;

        // The conversion itself. New rows for the second part of a split thema are marked in the doomed BlokNiveau
        // column, so the loops, whose snapshots may or may not see them, skip them either way.
        private const string Omzetting = """
            DELETE FROM themaplaatsingen WHERE "Status" = 'Geweigerd';

            DO $fb035$
            DECLARE
                v_plan record;
                v_groep record;
                v_plaatsing record;
                v_deel record;
                v_begin date;
                v_volgende_begin date;
                v_cap date;
                v_cursor date;
                v_tot date;
                v_eerste boolean;
            BEGIN
                FOR v_plan IN
                    SELECT j."Id" AS jaarplan_id, k."SchooljaarId" AS sj
                    FROM jaarplannen j
                    JOIN klassen k ON k."Id" = j."KlasId"
                LOOP
                    FOR v_groep IN
                        SELECT g.blok_start, b.blok_eind, g.aantal,
                               lead(g.blok_start) OVER (ORDER BY g.blok_start) AS volgende_start
                        FROM (SELECT p."BlokStart" AS blok_start, count(*) AS aantal
                              FROM themaplaatsingen p
                              WHERE p."JaarplanId" = v_plan.jaarplan_id AND p."BlokNiveau" <> 'FB035Deel'
                              GROUP BY p."BlokStart") g
                        LEFT JOIN pg_temp.fb035_themaperiodes(v_plan.sj) b ON b.blok_start = g.blok_start
                        ORDER BY g.blok_start
                    LOOP
                        v_begin := pg_temp.fb035_volgende_schooldag(v_plan.sj, v_groep.blok_start);

                        v_cap := NULL;
                        v_volgende_begin := NULL;
                        IF v_groep.volgende_start IS NOT NULL THEN
                            v_volgende_begin := pg_temp.fb035_volgende_schooldag(v_plan.sj, v_groep.volgende_start);
                            IF v_volgende_begin IS NOT NULL THEN
                                v_cap := pg_temp.fb035_vorige_schooldag(v_plan.sj, v_volgende_begin - 1);
                            END IF;
                        END IF;

                        -- One thema in a real period: its first and last schooldag, cut before the next group, which
                        -- can start inside the period when its own start matches no period.
                        IF v_groep.aantal = 1 AND v_groep.blok_eind IS NOT NULL THEN
                            v_tot := pg_temp.fb035_vorige_schooldag(v_plan.sj, v_groep.blok_eind);
                            IF v_cap IS NOT NULL AND v_tot > v_cap THEN
                                v_tot := v_cap;
                            END IF;
                            IF v_begin IS NULL OR v_tot IS NULL OR v_tot < v_begin
                               OR (v_groep.volgende_start IS NOT NULL AND v_volgende_begin IS NOT NULL AND v_cap IS NULL) THEN
                                DELETE FROM themaplaatsingen
                                WHERE "JaarplanId" = v_plan.jaarplan_id AND "BlokStart" = v_groep.blok_start
                                  AND "BlokNiveau" <> 'FB035Deel';
                            ELSE
                                UPDATE themaplaatsingen SET "Van" = v_begin, "Tot" = v_tot
                                WHERE "JaarplanId" = v_plan.jaarplan_id AND "BlokStart" = v_groep.blok_start
                                  AND "BlokNiveau" <> 'FB035Deel';
                            END IF;
                            CONTINUE;
                        END IF;

                        -- Several thema's, or a date that starts no period: one after another.
                        v_cursor := v_begin;
                        -- A next group that starts on this group's own first schooldag leaves it no day at all.
                        IF v_volgende_begin IS NOT NULL AND v_cap IS NULL THEN
                            v_cursor := NULL;
                        END IF;
                        FOR v_plaatsing IN
                            SELECT p."Id" AS id, greatest(t."DuurWeken", 1) AS duur
                            FROM themaplaatsingen p
                            JOIN themas t ON t."Id" = p."ThemaId"
                            WHERE p."JaarplanId" = v_plan.jaarplan_id AND p."BlokStart" = v_groep.blok_start
                              AND p."BlokNiveau" <> 'FB035Deel'
                            ORDER BY p."ThemaId"::text
                        LOOP
                            IF v_cursor IS NULL OR (v_cap IS NOT NULL AND v_cursor > v_cap) THEN
                                DELETE FROM themaplaatsingen WHERE "Id" = v_plaatsing.id;
                                CONTINUE;
                            END IF;

                            v_tot := pg_temp.fb035_voorgesteld_einde(v_plan.sj, v_cursor, v_plaatsing.duur);
                            IF v_cap IS NOT NULL AND v_tot > v_cap THEN
                                v_tot := v_cap;
                            END IF;

                            v_eerste := true;
                            FOR v_deel IN SELECT d.deel_van, d.deel_tot FROM pg_temp.fb035_splits(v_plan.sj, v_cursor, v_tot) d LOOP
                                IF v_eerste THEN
                                    UPDATE themaplaatsingen SET "Van" = v_deel.deel_van, "Tot" = v_deel.deel_tot
                                    WHERE "Id" = v_plaatsing.id;
                                    v_eerste := false;
                                ELSE
                                    INSERT INTO themaplaatsingen
                                        ("Id", "JaarplanId", "ThemaId", "BlokNiveau", "BlokStart", "Status", "AiMotivatie",
                                         "Vergrendeld", "Van", "Tot")
                                    SELECT gen_random_uuid(), p."JaarplanId", p."ThemaId", 'FB035Deel', p."BlokStart",
                                           p."Status", p."AiMotivatie", p."Vergrendeld", v_deel.deel_van, v_deel.deel_tot
                                    FROM themaplaatsingen p
                                    WHERE p."Id" = v_plaatsing.id;
                                END IF;
                            END LOOP;

                            IF v_eerste THEN
                                DELETE FROM themaplaatsingen WHERE "Id" = v_plaatsing.id;
                            ELSE
                                v_cursor := pg_temp.fb035_volgende_schooldag(v_plan.sj, v_tot + 1);
                            END IF;
                        END LOOP;
                    END LOOP;
                END LOOP;
            END
            $fb035$;
            """;
    }
}
