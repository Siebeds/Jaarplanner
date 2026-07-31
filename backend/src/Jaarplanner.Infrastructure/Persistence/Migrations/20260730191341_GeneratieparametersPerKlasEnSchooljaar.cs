using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GeneratieparametersPerKlasEnSchooljaar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "generatieparameters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    SchooljaarId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_generatieparameters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_generatieparameters_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_generatieparameters_schooljaren_SchooljaarId",
                        column: x => x.SchooljaarId,
                        principalTable: "schooljaren",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "startthemavoorkeuren",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BlokStart = table.Column<DateOnly>(type: "date", nullable: false),
                    ThemaNaam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    GeneratieparametersId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_startthemavoorkeuren", x => x.Id);
                    table.ForeignKey(
                        name: "FK_startthemavoorkeuren_generatieparameters_Generatieparameter~",
                        column: x => x.GeneratieparametersId,
                        principalTable: "generatieparameters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vastemomenten",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Datum = table.Column<DateOnly>(type: "date", nullable: false),
                    BlokkeertPlaatsing = table.Column<bool>(type: "boolean", nullable: false),
                    GeneratieparametersId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vastemomenten", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vastemomenten_generatieparameters_GeneratieparametersId",
                        column: x => x.GeneratieparametersId,
                        principalTable: "generatieparameters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_generatieparameters_KlasId_SchooljaarId",
                table: "generatieparameters",
                columns: new[] { "KlasId", "SchooljaarId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_generatieparameters_SchooljaarId",
                table: "generatieparameters",
                column: "SchooljaarId");

            migrationBuilder.CreateIndex(
                name: "IX_startthemavoorkeuren_GeneratieparametersId_BlokStart",
                table: "startthemavoorkeuren",
                columns: new[] { "GeneratieparametersId", "BlokStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vastemomenten_GeneratieparametersId_Datum",
                table: "vastemomenten",
                columns: new[] { "GeneratieparametersId", "Datum" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "startthemavoorkeuren");

            migrationBuilder.DropTable(
                name: "vastemomenten");

            migrationBuilder.DropTable(
                name: "generatieparameters");
        }
    }
}
