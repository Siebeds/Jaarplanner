using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeerlingen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "leerlingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    Voornaam = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Achternaam = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leerlingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_leerlingen_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_leerlingen_KlasId",
                table: "leerlingen",
                column: "KlasId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "leerlingen");
        }
    }
}
