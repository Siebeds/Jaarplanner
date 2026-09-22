using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AanbodgatVoorstellen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "GebruikerId",
                table: "activiteitvoorstellen",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<TimeOnly>(
                name: "Begin",
                table: "activiteitvoorstellen",
                type: "time without time zone",
                nullable: true);

            // Every proposal that exists today was asked for under a subthema (ADR-0056): the cat did not exist yet.
            // The default backfills those rows; the entity sets the source itself on every row written from now on.
            migrationBuilder.AddColumn<string>(
                name: "Bron",
                table: "activiteitvoorstellen",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Gevraagd");

            migrationBuilder.AddColumn<DateOnly>(
                name: "Datum",
                table: "activiteitvoorstellen",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "Einde",
                table: "activiteitvoorstellen",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "KlasId",
                table: "activiteitvoorstellen",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ThemaplaatsingId",
                table: "activiteitvoorstellen",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_activiteitvoorstellen_KlasId_ThemaplaatsingId",
                table: "activiteitvoorstellen",
                columns: new[] { "KlasId", "ThemaplaatsingId" });

            migrationBuilder.AddForeignKey(
                name: "FK_activiteitvoorstellen_klassen_KlasId",
                table: "activiteitvoorstellen",
                column: "KlasId",
                principalTable: "klassen",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_activiteitvoorstellen_klassen_KlasId",
                table: "activiteitvoorstellen");

            migrationBuilder.DropIndex(
                name: "IX_activiteitvoorstellen_KlasId_ThemaplaatsingId",
                table: "activiteitvoorstellen");

            migrationBuilder.DropColumn(
                name: "Begin",
                table: "activiteitvoorstellen");

            migrationBuilder.DropColumn(
                name: "Bron",
                table: "activiteitvoorstellen");

            migrationBuilder.DropColumn(
                name: "Datum",
                table: "activiteitvoorstellen");

            migrationBuilder.DropColumn(
                name: "Einde",
                table: "activiteitvoorstellen");

            migrationBuilder.DropColumn(
                name: "KlasId",
                table: "activiteitvoorstellen");

            migrationBuilder.DropColumn(
                name: "ThemaplaatsingId",
                table: "activiteitvoorstellen");

            migrationBuilder.AlterColumn<Guid>(
                name: "GebruikerId",
                table: "activiteitvoorstellen",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
