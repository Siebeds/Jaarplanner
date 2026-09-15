using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Woordwebs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "woordwebs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    EigenaarId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_woordwebs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_woordwebs_gebruikers_EigenaarId",
                        column: x => x.EigenaarId,
                        principalTable: "gebruikers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_woordwebs_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "woordweb_woorden",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WoordwebId = table.Column<Guid>(type: "uuid", nullable: false),
                    Woord = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiMotivatie = table.Column<string>(type: "text", nullable: true),
                    Volgnummer = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_woordweb_woorden", x => x.Id);
                    table.ForeignKey(
                        name: "FK_woordweb_woorden_woordwebs_WoordwebId",
                        column: x => x.WoordwebId,
                        principalTable: "woordwebs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_woordweb_woorden_WoordwebId",
                table: "woordweb_woorden",
                column: "WoordwebId");

            migrationBuilder.CreateIndex(
                name: "IX_woordwebs_EigenaarId",
                table: "woordwebs",
                column: "EigenaarId");

            migrationBuilder.CreateIndex(
                name: "IX_woordwebs_SubthemaId_EigenaarId",
                table: "woordwebs",
                columns: new[] { "SubthemaId", "EigenaarId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "woordweb_woorden");

            migrationBuilder.DropTable(
                name: "woordwebs");
        }
    }
}
