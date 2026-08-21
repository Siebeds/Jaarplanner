using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OnderzoeksvragenMeervoudig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: create the new onderzoeksvragen table first.
            migrationBuilder.CreateTable(
                name: "onderzoeksvragen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Vraag = table.Column<string>(type: "text", nullable: false),
                    Probleemstelling = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_onderzoeksvragen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_onderzoeksvragen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_onderzoeksvragen_SubthemaId",
                table: "onderzoeksvragen",
                column: "SubthemaId");

            // Step 2: migrate any existing non-null Onderzoeksvraag values into new rows.
            migrationBuilder.Sql(
                """
                INSERT INTO onderzoeksvragen ("Id", "SubthemaId", "Vraag", "Probleemstelling")
                SELECT gen_random_uuid(), "Id", "Onderzoeksvraag", "Probleemstelling"
                FROM subthemas
                WHERE "Onderzoeksvraag" IS NOT NULL AND trim("Onderzoeksvraag") <> '';
                """);

            // Step 3: add OnderzoeksvraagId FK on activiteiten.
            migrationBuilder.AddColumn<Guid>(
                name: "OnderzoeksvraagId",
                table: "activiteiten",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_activiteiten_OnderzoeksvraagId",
                table: "activiteiten",
                column: "OnderzoeksvraagId");

            migrationBuilder.AddForeignKey(
                name: "FK_activiteiten_onderzoeksvragen_OnderzoeksvraagId",
                table: "activiteiten",
                column: "OnderzoeksvraagId",
                principalTable: "onderzoeksvragen",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Step 4: drop the old single-pair columns from subthemas.
            migrationBuilder.DropColumn(
                name: "Onderzoeksvraag",
                table: "subthemas");

            migrationBuilder.DropColumn(
                name: "Probleemstelling",
                table: "subthemas");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_activiteiten_onderzoeksvragen_OnderzoeksvraagId",
                table: "activiteiten");

            migrationBuilder.DropIndex(
                name: "IX_activiteiten_OnderzoeksvraagId",
                table: "activiteiten");

            migrationBuilder.DropColumn(
                name: "OnderzoeksvraagId",
                table: "activiteiten");

            // Restore old columns before migrating data back.
            migrationBuilder.AddColumn<string>(
                name: "Onderzoeksvraag",
                table: "subthemas",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Probleemstelling",
                table: "subthemas",
                type: "text",
                nullable: true);

            // Migrate back: copy the first onderzoeksvraag row per subthema.
            migrationBuilder.Sql(
                """
                UPDATE subthemas s
                SET "Onderzoeksvraag" = ov."Vraag",
                    "Probleemstelling" = ov."Probleemstelling"
                FROM (
                    SELECT DISTINCT ON ("SubthemaId") "SubthemaId", "Vraag", "Probleemstelling"
                    FROM onderzoeksvragen
                    ORDER BY "SubthemaId", "Id"
                ) ov
                WHERE s."Id" = ov."SubthemaId";
                """);

            migrationBuilder.DropTable(
                name: "onderzoeksvragen");
        }
    }
}
