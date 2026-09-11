using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AlgemeneFiches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "algemene_fiches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Omschrijving = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_algemene_fiches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_algemene_fiches_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "algemene_fiche_doelkoppelingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AlgemeneFicheId = table.Column<Guid>(type: "uuid", nullable: false),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_algemene_fiche_doelkoppelingen", x => new { x.AlgemeneFicheId, x.Id });
                    table.ForeignKey(
                        name: "FK_algemene_fiche_doelkoppelingen_algemene_fiches_AlgemeneFich~",
                        column: x => x.AlgemeneFicheId,
                        principalTable: "algemene_fiches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_algemene_fiche_doelkoppelingen_leerplandoelen_leerplandoel_~",
                        column: x => x.leerplandoel_code,
                        principalTable: "leerplandoelen",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "algemene_ficheplaatsingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    AlgemeneFicheId = table.Column<Guid>(type: "uuid", nullable: false),
                    Van = table.Column<DateOnly>(type: "date", nullable: false),
                    Tot = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_algemene_ficheplaatsingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_algemene_ficheplaatsingen_algemene_fiches_AlgemeneFicheId",
                        column: x => x.AlgemeneFicheId,
                        principalTable: "algemene_fiches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_algemene_ficheplaatsingen_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "algemene_fichemomenten",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaatsingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Datum = table.Column<DateOnly>(type: "date", nullable: false),
                    Begin = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Einde = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_algemene_fichemomenten", x => x.Id);
                    table.ForeignKey(
                        name: "FK_algemene_fichemomenten_algemene_ficheplaatsingen_PlaatsingId",
                        column: x => x.PlaatsingId,
                        principalTable: "algemene_ficheplaatsingen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_algemene_fiche_doelkoppelingen_leerplandoel_code",
                table: "algemene_fiche_doelkoppelingen",
                column: "leerplandoel_code");

            migrationBuilder.CreateIndex(
                name: "IX_algemene_fichemomenten_Datum_Begin",
                table: "algemene_fichemomenten",
                columns: new[] { "Datum", "Begin" });

            migrationBuilder.CreateIndex(
                name: "IX_algemene_fichemomenten_PlaatsingId",
                table: "algemene_fichemomenten",
                column: "PlaatsingId");

            migrationBuilder.CreateIndex(
                name: "IX_algemene_ficheplaatsingen_AlgemeneFicheId",
                table: "algemene_ficheplaatsingen",
                column: "AlgemeneFicheId");

            migrationBuilder.CreateIndex(
                name: "IX_algemene_ficheplaatsingen_KlasId_Van_Tot",
                table: "algemene_ficheplaatsingen",
                columns: new[] { "KlasId", "Van", "Tot" });

            migrationBuilder.CreateIndex(
                name: "IX_algemene_fiches_KlasId_Naam",
                table: "algemene_fiches",
                columns: new[] { "KlasId", "Naam" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "algemene_fiche_doelkoppelingen");

            migrationBuilder.DropTable(
                name: "algemene_fichemomenten");

            migrationBuilder.DropTable(
                name: "algemene_ficheplaatsingen");

            migrationBuilder.DropTable(
                name: "algemene_fiches");
        }
    }
}
