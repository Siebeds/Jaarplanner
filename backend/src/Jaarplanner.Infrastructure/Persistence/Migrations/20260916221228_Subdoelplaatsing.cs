using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Subdoelplaatsing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subthemavoorstellen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Leeftijd = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Naam = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Onderzoeksvraag = table.Column<string>(type: "text", nullable: false),
                    DuurWeken = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiMotivatie = table.Column<string>(type: "text", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subthemavoorstellen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subthemavoorstellen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_subthemavoorstellen_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "subdoelvoorstellen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Leeftijd = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubthemavoorstelId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiMotivatie = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subdoelvoorstellen", x => x.Id);
                    table.CheckConstraint("CK_subdoelvoorstellen_EenBestemming", "(\"SubthemaId\" IS NULL) <> (\"SubthemavoorstelId\" IS NULL)");
                    table.ForeignKey(
                        name: "FK_subdoelvoorstellen_leerplandoelen_leerplandoel_code",
                        column: x => x.leerplandoel_code,
                        principalTable: "leerplandoelen",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_subdoelvoorstellen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_subdoelvoorstellen_subthemavoorstellen_SubthemavoorstelId",
                        column: x => x.SubthemavoorstelId,
                        principalTable: "subthemavoorstellen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_subdoelvoorstellen_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_subdoelvoorstellen_leerplandoel_code",
                table: "subdoelvoorstellen",
                column: "leerplandoel_code");

            migrationBuilder.CreateIndex(
                name: "IX_subdoelvoorstellen_SubthemaId",
                table: "subdoelvoorstellen",
                column: "SubthemaId");

            migrationBuilder.CreateIndex(
                name: "IX_subdoelvoorstellen_SubthemavoorstelId",
                table: "subdoelvoorstellen",
                column: "SubthemavoorstelId");

            migrationBuilder.CreateIndex(
                name: "IX_subdoelvoorstellen_ThemaId_Leeftijd",
                table: "subdoelvoorstellen",
                columns: new[] { "ThemaId", "Leeftijd" });

            migrationBuilder.CreateIndex(
                name: "IX_subthemavoorstellen_SubthemaId",
                table: "subthemavoorstellen",
                column: "SubthemaId");

            migrationBuilder.CreateIndex(
                name: "IX_subthemavoorstellen_ThemaId_Leeftijd",
                table: "subthemavoorstellen",
                columns: new[] { "ThemaId", "Leeftijd" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "subdoelvoorstellen");

            migrationBuilder.DropTable(
                name: "subthemavoorstellen");
        }
    }
}
