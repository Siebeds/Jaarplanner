using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Activiteitvoorstellen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "activiteitvoorstellen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    GebruikerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ActiviteitType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    VerwachteUitkomsten = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    LengteInLesuren = table.Column<int>(type: "integer", nullable: false),
                    OnderzoeksvraagId = table.Column<Guid>(type: "uuid", nullable: true),
                    LeerplandoelCodes = table.Column<string[]>(type: "text[]", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiMotivatie = table.Column<string>(type: "text", nullable: false),
                    ActiviteitId = table.Column<Guid>(type: "uuid", nullable: true),
                    Volgnummer = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activiteitvoorstellen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_activiteitvoorstellen_activiteiten_ActiviteitId",
                        column: x => x.ActiviteitId,
                        principalTable: "activiteiten",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_activiteitvoorstellen_gebruikers_GebruikerId",
                        column: x => x.GebruikerId,
                        principalTable: "gebruikers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_activiteitvoorstellen_onderzoeksvragen_OnderzoeksvraagId",
                        column: x => x.OnderzoeksvraagId,
                        principalTable: "onderzoeksvragen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_activiteitvoorstellen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_activiteitvoorstellen_ActiviteitId",
                table: "activiteitvoorstellen",
                column: "ActiviteitId");

            migrationBuilder.CreateIndex(
                name: "IX_activiteitvoorstellen_GebruikerId",
                table: "activiteitvoorstellen",
                column: "GebruikerId");

            migrationBuilder.CreateIndex(
                name: "IX_activiteitvoorstellen_OnderzoeksvraagId",
                table: "activiteitvoorstellen",
                column: "OnderzoeksvraagId");

            migrationBuilder.CreateIndex(
                name: "IX_activiteitvoorstellen_SubthemaId_GebruikerId",
                table: "activiteitvoorstellen",
                columns: new[] { "SubthemaId", "GebruikerId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activiteitvoorstellen");
        }
    }
}
