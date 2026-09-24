using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Hoekverrijkingsvoorstellen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hoekverrijkingsvoorstellen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HoekId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tekst = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    AiMotivatie = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hoekverrijkingsvoorstellen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_hoekverrijkingsvoorstellen_hoeken_HoekId",
                        column: x => x.HoekId,
                        principalTable: "hoeken",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_hoekverrijkingsvoorstellen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_hoekverrijkingsvoorstellen_HoekId_SubthemaId",
                table: "hoekverrijkingsvoorstellen",
                columns: new[] { "HoekId", "SubthemaId" });

            migrationBuilder.CreateIndex(
                name: "IX_hoekverrijkingsvoorstellen_SubthemaId",
                table: "hoekverrijkingsvoorstellen",
                column: "SubthemaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hoekverrijkingsvoorstellen");
        }
    }
}
