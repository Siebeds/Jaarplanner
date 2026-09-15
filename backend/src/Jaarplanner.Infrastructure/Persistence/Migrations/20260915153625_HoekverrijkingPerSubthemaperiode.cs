using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HoekverrijkingPerSubthemaperiode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // FB-020 (ADR-0040): a verrijking moves from a hoekplaatsing with its own dates to a (hoek,
            // subthemaperiode) pair. The owner ruled on 2026-09-15 how existing rows travel: each one goes to EVERY
            // stored subthemaperiode of its klas that shares a day with it, and one that shares a day with none is
            // dropped. Two old rows landing on the same pair are joined in date order, so no text on a pair is lost.
            //
            // Converted into a temporary table FIRST, while the old columns still exist, then the table is emptied and
            // reshaped, and the converted rows are written back. Only demo and development data has the old shape.
            migrationBuilder.Sql("""
                CREATE TEMP TABLE hoekverrijkingen_omgezet AS
                SELECT hp."HoekId" AS hoek_id,
                       sp."Id" AS subthemaplaatsing_id,
                       string_agg(v."Tekst", E'\n\n' ORDER BY v."Van", v."Id") AS tekst
                FROM hoekverrijkingen v
                JOIN hoekplaatsingen hp ON hp."Id" = v."HoekplaatsingId"
                JOIN jaarplannen jp ON jp."KlasId" = hp."KlasId"
                JOIN subthemaplaatsingen sp
                  ON sp."JaarplanId" = jp."Id" AND sp."Van" <= v."Tot" AND sp."Tot" >= v."Van"
                GROUP BY hp."HoekId", sp."Id";

                DELETE FROM hoekverrijkingen;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_hoekverrijkingen_hoekplaatsingen_HoekplaatsingId",
                table: "hoekverrijkingen");

            migrationBuilder.DropIndex(
                name: "IX_hoekverrijkingen_HoekplaatsingId_Van_Tot",
                table: "hoekverrijkingen");

            migrationBuilder.DropColumn(
                name: "Tot",
                table: "hoekverrijkingen");

            migrationBuilder.DropColumn(
                name: "Van",
                table: "hoekverrijkingen");

            migrationBuilder.RenameColumn(
                name: "HoekplaatsingId",
                table: "hoekverrijkingen",
                newName: "SubthemaplaatsingId");

            migrationBuilder.AddColumn<Guid>(
                name: "HoekId",
                table: "hoekverrijkingen",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_hoekverrijkingen_HoekId_SubthemaplaatsingId",
                table: "hoekverrijkingen",
                columns: new[] { "HoekId", "SubthemaplaatsingId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_hoekverrijkingen_SubthemaplaatsingId",
                table: "hoekverrijkingen",
                column: "SubthemaplaatsingId");

            migrationBuilder.AddForeignKey(
                name: "FK_hoekverrijkingen_hoeken_HoekId",
                table: "hoekverrijkingen",
                column: "HoekId",
                principalTable: "hoeken",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_hoekverrijkingen_subthemaplaatsingen_SubthemaplaatsingId",
                table: "hoekverrijkingen",
                column: "SubthemaplaatsingId",
                principalTable: "subthemaplaatsingen",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.Sql("""
                INSERT INTO hoekverrijkingen ("Id", "HoekId", "SubthemaplaatsingId", "Tekst")
                SELECT gen_random_uuid(), hoek_id, subthemaplaatsing_id, tekst
                FROM hoekverrijkingen_omgezet;

                DROP TABLE hoekverrijkingen_omgezet;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // There is no way back to a placement and two dates: a subthemaperiode names no hoekplaatsing. So the rows
            // are removed before the table is reshaped, rather than left pointing a renamed column at the wrong table.
            migrationBuilder.Sql("DELETE FROM hoekverrijkingen;");

            migrationBuilder.DropForeignKey(
                name: "FK_hoekverrijkingen_hoeken_HoekId",
                table: "hoekverrijkingen");

            migrationBuilder.DropForeignKey(
                name: "FK_hoekverrijkingen_subthemaplaatsingen_SubthemaplaatsingId",
                table: "hoekverrijkingen");

            migrationBuilder.DropIndex(
                name: "IX_hoekverrijkingen_HoekId_SubthemaplaatsingId",
                table: "hoekverrijkingen");

            migrationBuilder.DropIndex(
                name: "IX_hoekverrijkingen_SubthemaplaatsingId",
                table: "hoekverrijkingen");

            migrationBuilder.DropColumn(
                name: "HoekId",
                table: "hoekverrijkingen");

            migrationBuilder.RenameColumn(
                name: "SubthemaplaatsingId",
                table: "hoekverrijkingen",
                newName: "HoekplaatsingId");

            migrationBuilder.AddColumn<DateOnly>(
                name: "Tot",
                table: "hoekverrijkingen",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<DateOnly>(
                name: "Van",
                table: "hoekverrijkingen",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateIndex(
                name: "IX_hoekverrijkingen_HoekplaatsingId_Van_Tot",
                table: "hoekverrijkingen",
                columns: new[] { "HoekplaatsingId", "Van", "Tot" });

            migrationBuilder.AddForeignKey(
                name: "FK_hoekverrijkingen_hoekplaatsingen_HoekplaatsingId",
                table: "hoekverrijkingen",
                column: "HoekplaatsingId",
                principalTable: "hoekplaatsingen",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
