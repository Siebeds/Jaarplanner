using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Hoeken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hoeken",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "text", nullable: false),
                    Omschrijving = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hoeken", x => x.Id);
                    table.ForeignKey(
                        name: "FK_hoeken_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hoekplaatsingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    HoekId = table.Column<Guid>(type: "uuid", nullable: false),
                    Van = table.Column<DateOnly>(type: "date", nullable: false),
                    Tot = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hoekplaatsingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_hoekplaatsingen_hoeken_HoekId",
                        column: x => x.HoekId,
                        principalTable: "hoeken",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hoekplaatsingen_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hoekmomenten",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HoekplaatsingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Datum = table.Column<DateOnly>(type: "date", nullable: false),
                    Volgorde = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hoekmomenten", x => x.Id);
                    table.ForeignKey(
                        name: "FK_hoekmomenten_hoekplaatsingen_HoekplaatsingId",
                        column: x => x.HoekplaatsingId,
                        principalTable: "hoekplaatsingen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hoekverrijkingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HoekplaatsingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Van = table.Column<DateOnly>(type: "date", nullable: false),
                    Tot = table.Column<DateOnly>(type: "date", nullable: false),
                    Tekst = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hoekverrijkingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_hoekverrijkingen_hoekplaatsingen_HoekplaatsingId",
                        column: x => x.HoekplaatsingId,
                        principalTable: "hoekplaatsingen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_hoeken_KlasId_Naam",
                table: "hoeken",
                columns: new[] { "KlasId", "Naam" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_hoekmomenten_Datum_Volgorde",
                table: "hoekmomenten",
                columns: new[] { "Datum", "Volgorde" });

            migrationBuilder.CreateIndex(
                name: "IX_hoekmomenten_HoekplaatsingId",
                table: "hoekmomenten",
                column: "HoekplaatsingId");

            migrationBuilder.CreateIndex(
                name: "IX_hoekplaatsingen_HoekId",
                table: "hoekplaatsingen",
                column: "HoekId");

            migrationBuilder.CreateIndex(
                name: "IX_hoekplaatsingen_KlasId_Van_Tot",
                table: "hoekplaatsingen",
                columns: new[] { "KlasId", "Van", "Tot" });

            migrationBuilder.CreateIndex(
                name: "IX_hoekverrijkingen_HoekplaatsingId_Van_Tot",
                table: "hoekverrijkingen",
                columns: new[] { "HoekplaatsingId", "Van", "Tot" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hoekmomenten");

            migrationBuilder.DropTable(
                name: "hoekverrijkingen");

            migrationBuilder.DropTable(
                name: "hoekplaatsingen");

            migrationBuilder.DropTable(
                name: "hoeken");
        }
    }
}
