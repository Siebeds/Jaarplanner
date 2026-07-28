using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CurriculumReadOnlyEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "disciplines",
                columns: table => new
                {
                    Nummer = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Naam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ParentDisciplineNummer = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_disciplines", x => x.Nummer);
                    table.ForeignKey(
                        name: "FK_disciplines_disciplines_ParentDisciplineNummer",
                        column: x => x.ParentDisciplineNummer,
                        principalTable: "disciplines",
                        principalColumn: "Nummer",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "minimumdoelen",
                columns: table => new
                {
                    Ref = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Leeftijd = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Nr = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Omschrijving = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minimumdoelen", x => x.Ref);
                });

            migrationBuilder.CreateTable(
                name: "leerplandoelen",
                columns: table => new
                {
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    doelsoort = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    JaarFase = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Domein = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Subdomein = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DisciplineNummer = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Cluster = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Tekst = table.Column<string>(type: "text", nullable: false),
                    Voorbeelden = table.Column<string>(type: "text", nullable: true),
                    Toelichting = table.Column<string>(type: "text", nullable: true),
                    Woordenschat = table.Column<string>(type: "text", nullable: true),
                    MinimumdoelRef = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leerplandoelen", x => x.Code);
                    table.ForeignKey(
                        name: "FK_leerplandoelen_disciplines_DisciplineNummer",
                        column: x => x.DisciplineNummer,
                        principalTable: "disciplines",
                        principalColumn: "Nummer",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_leerplandoelen_minimumdoelen_MinimumdoelRef",
                        column: x => x.MinimumdoelRef,
                        principalTable: "minimumdoelen",
                        principalColumn: "Ref",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_disciplines_ParentDisciplineNummer",
                table: "disciplines",
                column: "ParentDisciplineNummer");

            migrationBuilder.CreateIndex(
                name: "IX_leerplandoelen_DisciplineNummer",
                table: "leerplandoelen",
                column: "DisciplineNummer");

            migrationBuilder.CreateIndex(
                name: "IX_leerplandoelen_Domein_Subdomein",
                table: "leerplandoelen",
                columns: new[] { "Domein", "Subdomein" });

            migrationBuilder.CreateIndex(
                name: "IX_leerplandoelen_MinimumdoelRef",
                table: "leerplandoelen",
                column: "MinimumdoelRef");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "leerplandoelen");

            migrationBuilder.DropTable(
                name: "disciplines");

            migrationBuilder.DropTable(
                name: "minimumdoelen");
        }
    }
}
