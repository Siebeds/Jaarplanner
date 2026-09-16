using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// FB-053 (ADR-0049): a thema's doelsuggesties propose minimumdoelen. Creates <c>thema_minimumdoelsuggesties</c> and
    /// drops <c>thema_doelsuggesties</c> with every leerplandoel doelsuggestie in it, open and accepted, in every
    /// environment (owner ruling 2026-09-16). Nothing references a row of the dropped table.
    /// <para>
    /// <b>Not reversible.</b> <see cref="Down"/> recreates the old table empty and cannot bring the deleted rows back.
    /// </para>
    /// </summary>
    public partial class Minimumdoelsuggesties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "thema_doelsuggesties");

            migrationBuilder.CreateTable(
                name: "thema_minimumdoelsuggesties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    minimumdoel_ref = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_thema_minimumdoelsuggesties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_thema_minimumdoelsuggesties_minimumdoelen_minimumdoel_ref",
                        column: x => x.minimumdoel_ref,
                        principalTable: "minimumdoelen",
                        principalColumn: "Ref",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_thema_minimumdoelsuggesties_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_thema_minimumdoelsuggesties_minimumdoel_ref",
                table: "thema_minimumdoelsuggesties",
                column: "minimumdoel_ref");

            migrationBuilder.CreateIndex(
                name: "IX_thema_minimumdoelsuggesties_ThemaId_minimumdoel_ref",
                table: "thema_minimumdoelsuggesties",
                columns: new[] { "ThemaId", "minimumdoel_ref" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "thema_minimumdoelsuggesties");

            migrationBuilder.CreateTable(
                name: "thema_doelsuggesties",
                columns: table => new
                {
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: true),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
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
    }
}
