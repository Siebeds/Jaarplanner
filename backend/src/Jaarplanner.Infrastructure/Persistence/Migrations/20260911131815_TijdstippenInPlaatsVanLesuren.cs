using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Clock times replace the numbered lesuur on both placement tables (ADR-0028).
    ///
    /// <para>
    /// <b>Hand-written where it counts.</b> The scaffold dropped <c>Volgorde</c> first and then added two columns
    /// with a midnight default, which compiles, runs, and quietly moves every planned activiteit in the database to
    /// 00:00. The order here is the opposite: add the columns nullable, derive them FROM the slot they replace,
    /// make them required, and only then drop it.
    /// </para>
    /// <para>
    /// <b>The arithmetic is a guess and the owner ruled it good enough</b> (2026-09-11: <i>"de demo data maakt
    /// eigenlijk niet uit"</i>). Nothing in this model has ever recorded when a school's third lesuur starts, so
    /// slot <c>n</c> becomes <c>08:30 + n × 50 min</c> and an activiteit's end its default length past that. A
    /// school with real rows needs its own mapping; ADR-0028 decision 6 is where that reader should start.
    /// </para>
    /// </summary>
    public partial class TijdstippenInPlaatsVanLesuren : Migration
    {
        /// <summary>The first block of an ordinary morning, and the length the slots were assumed to have.</summary>
        private const string Eerste = "TIME '08:30'";

        private const string Lesuur = "INTERVAL '50 minutes'";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. The new columns, nullable for exactly as long as it takes to fill them.
            migrationBuilder.AddColumn<TimeOnly>(
                name: "Begin",
                table: "hoekmomenten",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "Einde",
                table: "hoekmomenten",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "Begin",
                table: "activiteitplaatsingen",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "Einde",
                table: "activiteitplaatsingen",
                type: "time without time zone",
                nullable: true);

            // 2. Derived from the slot. A hoek took exactly one lesuur; an activiteit took as many as its own
            //    default length, which is the only length the old model could express.
            migrationBuilder.Sql($"""
                UPDATE hoekmomenten
                SET "Begin" = {Eerste} + ("Volgorde" * {Lesuur}),
                    "Einde" = {Eerste} + ("Volgorde" * {Lesuur}) + {Lesuur};
                """);

            migrationBuilder.Sql($"""
                UPDATE activiteitplaatsingen p
                SET "Begin" = {Eerste} + (p."Volgorde" * {Lesuur}),
                    "Einde" = {Eerste} + (p."Volgorde" * {Lesuur})
                             + (COALESCE(a.lengte_in_lesuren, 1) * {Lesuur})
                FROM activiteiten a
                WHERE a."Id" = p."ActiviteitId";
                """);

            // A placement whose activiteit is missing cannot exist (the FK is Restrict), so the join above reaches
            // every row. This is the belt for the braces: without it a NULL would block the NOT NULL below with a
            // constraint violation rather than with an explanation.
            migrationBuilder.Sql($"""
                UPDATE activiteitplaatsingen
                SET "Begin" = {Eerste} + ("Volgorde" * {Lesuur}),
                    "Einde" = {Eerste} + ("Volgorde" * {Lesuur}) + {Lesuur}
                WHERE "Begin" IS NULL;
                """);

            // 3. Required from here on: a placement without a time is not a state the time grid can draw.
            migrationBuilder.Sql("""
                ALTER TABLE hoekmomenten ALTER COLUMN "Begin" SET NOT NULL;
                ALTER TABLE hoekmomenten ALTER COLUMN "Einde" SET NOT NULL;
                ALTER TABLE activiteitplaatsingen ALTER COLUMN "Begin" SET NOT NULL;
                ALTER TABLE activiteitplaatsingen ALTER COLUMN "Einde" SET NOT NULL;
                """);

            // 4. And only now is the slot expendable.
            migrationBuilder.DropIndex(
                name: "IX_hoekmomenten_Datum_Volgorde",
                table: "hoekmomenten");

            migrationBuilder.DropIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum_Volgorde",
                table: "activiteitplaatsingen");

            migrationBuilder.DropColumn(
                name: "Volgorde",
                table: "hoekmomenten");

            migrationBuilder.DropColumn(
                name: "Volgorde",
                table: "activiteitplaatsingen");

            migrationBuilder.CreateIndex(
                name: "IX_hoekmomenten_Datum_Begin",
                table: "hoekmomenten",
                columns: new[] { "Datum", "Begin" });

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum_Begin",
                table: "activiteitplaatsingen",
                columns: new[] { "JaarplanId", "ActiviteitId", "Datum", "Begin" },
                unique: true);
        }

        /// <summary>
        /// Back to slots, and <b>the times are not recoverable</b>: 9:05 and 9:20 both land in the slot that starts
        /// at 8:30. The reverse arithmetic is stated rather than skipped so the down path leaves a usable table
        /// instead of a column of zeros, but it is lossy by nature and a teacher's own hour is what it loses.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Volgorde",
                table: "hoekmomenten",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Volgorde",
                table: "activiteitplaatsingen",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            foreach (var tabel in new[] { "hoekmomenten", "activiteitplaatsingen" })
            {
                migrationBuilder.Sql($"""
                    UPDATE {tabel}
                    SET "Volgorde" = GREATEST(
                        0,
                        FLOOR(EXTRACT(EPOCH FROM ("Begin" - {Eerste})) / 3000)::int);
                    """);
            }

            migrationBuilder.DropIndex(
                name: "IX_hoekmomenten_Datum_Begin",
                table: "hoekmomenten");

            migrationBuilder.DropIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum_Begin",
                table: "activiteitplaatsingen");

            migrationBuilder.DropColumn(
                name: "Begin",
                table: "hoekmomenten");

            migrationBuilder.DropColumn(
                name: "Einde",
                table: "hoekmomenten");

            migrationBuilder.DropColumn(
                name: "Begin",
                table: "activiteitplaatsingen");

            migrationBuilder.DropColumn(
                name: "Einde",
                table: "activiteitplaatsingen");

            migrationBuilder.CreateIndex(
                name: "IX_hoekmomenten_Datum_Volgorde",
                table: "hoekmomenten",
                columns: new[] { "Datum", "Volgorde" });

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum_Volgorde",
                table: "activiteitplaatsingen",
                columns: new[] { "JaarplanId", "ActiviteitId", "Datum", "Volgorde" },
                unique: true);
        }
    }
}
