using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SchooljaarEnVakanties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "schooljaren",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Start = table.Column<DateOnly>(type: "date", nullable: false),
                    Eind = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_schooljaren", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "schoolvakanties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Start = table.Column<DateOnly>(type: "date", nullable: false),
                    Eind = table.Column<DateOnly>(type: "date", nullable: false),
                    SchooljaarId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_schoolvakanties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_schoolvakanties_schooljaren_SchooljaarId",
                        column: x => x.SchooljaarId,
                        principalTable: "schooljaren",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_schooljaren_Naam",
                table: "schooljaren",
                column: "Naam",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_schoolvakanties_SchooljaarId_Start",
                table: "schoolvakanties",
                columns: new[] { "SchooljaarId", "Start" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "schoolvakanties");

            migrationBuilder.DropTable(
                name: "schooljaren");
        }
    }
}
