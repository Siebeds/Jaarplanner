using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRapportdoelenEnGradaties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gradaties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Kleur = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Volgorde = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gradaties", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rapportdoelen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Titel = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Volgorde = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rapportdoelen", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rapportdoel_subdoelen",
                columns: table => new
                {
                    RapportdoelId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubdoelId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rapportdoel_subdoelen", x => new { x.RapportdoelId, x.SubdoelId });
                    table.ForeignKey(
                        name: "FK_rapportdoel_subdoelen_rapportdoelen_RapportdoelId",
                        column: x => x.RapportdoelId,
                        principalTable: "rapportdoelen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_rapportdoel_subdoelen_subdoelen_SubdoelId",
                        column: x => x.SubdoelId,
                        principalTable: "subdoelen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_rapportdoel_subdoelen_SubdoelId",
                table: "rapportdoel_subdoelen",
                column: "SubdoelId");

            // FB-002, owner ruling 2026-09-15: the scale starts with the owner's example rather than empty, and the K3
            // leerkrachten rename, recolour, reorder, add and delete from there. Written here by hand, not generated from
            // HasData, so the rows belong to the school once inserted (GradatieConfiguration says why). Fixed ids, so a
            // database migrated twice ends up with the same two rows. The colours are stored by name, as the converter does.
            migrationBuilder.InsertData(
                table: "gradaties",
                columns: new[] { "Id", "Label", "Kleur", "Volgorde" },
                values: new object[,]
                {
                    { new Guid("3b0f6a52-8c1e-4d7a-9f25-6e4b1c0d2a71"), "Volledig bereikt", "Groen", 1 },
                    { new Guid("9d4e2c18-5a73-4b6f-8e01-2f7c3a9b4d56"), "Nog niet volledig", "Oranje", 2 },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gradaties");

            migrationBuilder.DropTable(
                name: "rapportdoel_subdoelen");

            migrationBuilder.DropTable(
                name: "rapportdoelen");
        }
    }
}
