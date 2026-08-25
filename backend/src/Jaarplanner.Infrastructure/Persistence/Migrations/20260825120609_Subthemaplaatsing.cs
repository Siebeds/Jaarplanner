using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Subthemaplaatsing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subthemaplaatsingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    JaarplanId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Van = table.Column<DateOnly>(type: "date", nullable: false),
                    Tot = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subthemaplaatsingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subthemaplaatsingen_jaarplannen_JaarplanId",
                        column: x => x.JaarplanId,
                        principalTable: "jaarplannen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_subthemaplaatsingen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_subthemaplaatsingen_JaarplanId_SubthemaId_Van",
                table: "subthemaplaatsingen",
                columns: new[] { "JaarplanId", "SubthemaId", "Van" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subthemaplaatsingen_JaarplanId_Van_Tot",
                table: "subthemaplaatsingen",
                columns: new[] { "JaarplanId", "Van", "Tot" });

            migrationBuilder.CreateIndex(
                name: "IX_subthemaplaatsingen_SubthemaId",
                table: "subthemaplaatsingen",
                column: "SubthemaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "subthemaplaatsingen");
        }
    }
}
