using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// FB-043: a themadoel a person adds is a minimumdoel. Adds <c>thema_minimumdoelen</c>, and deletes every existing
    /// themadoel that links a leerplandoel, in every environment (owner ruling 2026-09-16). The table itself stays: the
    /// FR-1 import still writes it until its own ticket.
    /// <para>
    /// <b>Not reversible.</b> <see cref="Down"/> drops the new table but cannot bring the deleted themadoelen back.
    /// </para>
    /// </summary>
    public partial class ThemaMinimumdoelen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "thema_minimumdoelen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    minimumdoel_ref = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_thema_minimumdoelen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_thema_minimumdoelen_minimumdoelen_minimumdoel_ref",
                        column: x => x.minimumdoel_ref,
                        principalTable: "minimumdoelen",
                        principalColumn: "Ref",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_thema_minimumdoelen_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_thema_minimumdoelen_minimumdoel_ref",
                table: "thema_minimumdoelen",
                column: "minimumdoel_ref");

            migrationBuilder.CreateIndex(
                name: "IX_thema_minimumdoelen_ThemaId_minimumdoel_ref",
                table: "thema_minimumdoelen",
                columns: new[] { "ThemaId", "minimumdoel_ref" },
                unique: true);

            // The owner's ruling: the existing leerplandoel themadoelen go. Nothing references a themadoelen row.
            migrationBuilder.Sql("DELETE FROM themadoelen;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "thema_minimumdoelen");
        }
    }
}
