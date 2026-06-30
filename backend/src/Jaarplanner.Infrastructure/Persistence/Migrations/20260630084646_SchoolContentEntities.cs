using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SchoolContentEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "klassen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Leerjaar = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_klassen", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "themas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Invalshoeken = table.Column<string>(type: "text", nullable: true),
                    DuurWeken = table.Column<int>(type: "integer", nullable: false),
                    Kernwoordenschat = table.Column<string[]>(type: "text[]", nullable: false),
                    RijkeWoordenschat = table.Column<string[]>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_themas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "subthemas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Probleemstelling = table.Column<string>(type: "text", nullable: true),
                    Onderzoeksvraag = table.Column<string>(type: "text", nullable: true),
                    DuurWeken = table.Column<int>(type: "integer", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    Leeftijd = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subthemas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subthemas_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_subthemas_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "themadoelen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Koppeling_Id = table.Column<Guid>(type: "uuid", nullable: false),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_themadoelen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_themadoelen_leerplandoelen_leerplandoel_code",
                        column: x => x.leerplandoel_code,
                        principalTable: "leerplandoelen",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_themadoelen_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activiteiten",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Naam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    activiteit_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Hoek = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    VerwachteUitkomsten = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activiteiten", x => x.Id);
                    table.ForeignKey(
                        name: "FK_activiteiten_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "subdoelen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubthemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Leeftijd = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Koppeling_Id = table.Column<Guid>(type: "uuid", nullable: false),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subdoelen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subdoelen_leerplandoelen_leerplandoel_code",
                        column: x => x.leerplandoel_code,
                        principalTable: "leerplandoelen",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_subdoelen_subthemas_SubthemaId",
                        column: x => x.SubthemaId,
                        principalTable: "subthemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "activiteiten_Doelkoppelingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActiviteitId = table.Column<Guid>(type: "uuid", nullable: false),
                    leerplandoel_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ai_motivatie = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activiteiten_Doelkoppelingen", x => new { x.ActiviteitId, x.Id });
                    table.ForeignKey(
                        name: "FK_activiteiten_Doelkoppelingen_activiteiten_ActiviteitId",
                        column: x => x.ActiviteitId,
                        principalTable: "activiteiten",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_activiteiten_Doelkoppelingen_leerplandoelen_leerplandoel_co~",
                        column: x => x.leerplandoel_code,
                        principalTable: "leerplandoelen",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_activiteiten_SubthemaId",
                table: "activiteiten",
                column: "SubthemaId");

            migrationBuilder.CreateIndex(
                name: "IX_activiteiten_Doelkoppelingen_leerplandoel_code",
                table: "activiteiten_Doelkoppelingen",
                column: "leerplandoel_code");

            migrationBuilder.CreateIndex(
                name: "IX_subdoelen_leerplandoel_code",
                table: "subdoelen",
                column: "leerplandoel_code");

            migrationBuilder.CreateIndex(
                name: "IX_subdoelen_SubthemaId",
                table: "subdoelen",
                column: "SubthemaId");

            migrationBuilder.CreateIndex(
                name: "IX_subthemas_KlasId_Leeftijd",
                table: "subthemas",
                columns: new[] { "KlasId", "Leeftijd" });

            migrationBuilder.CreateIndex(
                name: "IX_subthemas_ThemaId",
                table: "subthemas",
                column: "ThemaId");

            migrationBuilder.CreateIndex(
                name: "IX_themadoelen_leerplandoel_code",
                table: "themadoelen",
                column: "leerplandoel_code");

            migrationBuilder.CreateIndex(
                name: "IX_themadoelen_ThemaId",
                table: "themadoelen",
                column: "ThemaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activiteiten_Doelkoppelingen");

            migrationBuilder.DropTable(
                name: "subdoelen");

            migrationBuilder.DropTable(
                name: "themadoelen");

            migrationBuilder.DropTable(
                name: "activiteiten");

            migrationBuilder.DropTable(
                name: "subthemas");

            migrationBuilder.DropTable(
                name: "klassen");

            migrationBuilder.DropTable(
                name: "themas");
        }
    }
}
