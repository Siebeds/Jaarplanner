using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ThemaDoelsuggesties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "thema_doelsuggesties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_thema_doelsuggesties", x => new { x.ThemaId, x.Id });
                    table.ForeignKey(
                        name: "FK_thema_doelsuggesties_leerplandoelen_leerplandoel_code",
                        column: x => x.leerplandoel_code,
                        principalTable: "leerplandoelen",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_thema_doelsuggesties_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_thema_doelsuggesties_leerplandoel_code",
                table: "thema_doelsuggesties",
                column: "leerplandoel_code");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "thema_doelsuggesties");
        }
    }
}
