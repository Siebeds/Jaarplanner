using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RechtenModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HeeftThemabeheer",
                table: "gebruikers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "MakerId",
                table: "activiteiten",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "hoofdleerkrachtaanstellingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GebruikerId = table.Column<Guid>(type: "uuid", nullable: false),
                    SchooljaarId = table.Column<Guid>(type: "uuid", nullable: false),
                    Jaarfase = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hoofdleerkrachtaanstellingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_hoofdleerkrachtaanstellingen_gebruikers_GebruikerId",
                        column: x => x.GebruikerId,
                        principalTable: "gebruikers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_hoofdleerkrachtaanstellingen_schooljaren_SchooljaarId",
                        column: x => x.SchooljaarId,
                        principalTable: "schooljaren",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "klastoewijzingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GebruikerId = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_klastoewijzingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_klastoewijzingen_gebruikers_GebruikerId",
                        column: x => x.GebruikerId,
                        principalTable: "gebruikers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_klastoewijzingen_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_activiteiten_MakerId",
                table: "activiteiten",
                column: "MakerId");

            migrationBuilder.CreateIndex(
                name: "IX_hoofdleerkrachtaanstellingen_GebruikerId_SchooljaarId_Jaarf~",
                table: "hoofdleerkrachtaanstellingen",
                columns: new[] { "GebruikerId", "SchooljaarId", "Jaarfase" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_hoofdleerkrachtaanstellingen_SchooljaarId_Jaarfase",
                table: "hoofdleerkrachtaanstellingen",
                columns: new[] { "SchooljaarId", "Jaarfase" });

            migrationBuilder.CreateIndex(
                name: "IX_klastoewijzingen_GebruikerId_KlasId",
                table: "klastoewijzingen",
                columns: new[] { "GebruikerId", "KlasId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_klastoewijzingen_KlasId",
                table: "klastoewijzingen",
                column: "KlasId");

            migrationBuilder.AddForeignKey(
                name: "FK_activiteiten_gebruikers_MakerId",
                table: "activiteiten",
                column: "MakerId",
                principalTable: "gebruikers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_activiteiten_gebruikers_MakerId",
                table: "activiteiten");

            migrationBuilder.DropTable(
                name: "hoofdleerkrachtaanstellingen");

            migrationBuilder.DropTable(
                name: "klastoewijzingen");

            migrationBuilder.DropIndex(
                name: "IX_activiteiten_MakerId",
                table: "activiteiten");

            migrationBuilder.DropColumn(
                name: "HeeftThemabeheer",
                table: "gebruikers");

            migrationBuilder.DropColumn(
                name: "MakerId",
                table: "activiteiten");
        }
    }
}
