using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOntwikkelingsrapporten : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ontwikkelingsrapporten",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LeerlingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Moment = table.Column<int>(type: "integer", nullable: false),
                    Besluit = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    BesluitStatus = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ontwikkelingsrapporten", x => x.Id);
                    table.CheckConstraint("CK_ontwikkelingsrapporten_Moment", "\"Moment\" BETWEEN 1 AND 3");
                    table.ForeignKey(
                        name: "FK_ontwikkelingsrapporten_leerlingen_LeerlingId",
                        column: x => x.LeerlingId,
                        principalTable: "leerlingen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rapportbeoordelingen",
                columns: table => new
                {
                    OntwikkelingsrapportId = table.Column<Guid>(type: "uuid", nullable: false),
                    RapportdoelId = table.Column<Guid>(type: "uuid", nullable: false),
                    GradatieId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tekst = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TekstStatus = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rapportbeoordelingen", x => new { x.OntwikkelingsrapportId, x.RapportdoelId });
                    table.ForeignKey(
                        name: "FK_rapportbeoordelingen_gradaties_GradatieId",
                        column: x => x.GradatieId,
                        principalTable: "gradaties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rapportbeoordelingen_ontwikkelingsrapporten_Ontwikkelingsra~",
                        column: x => x.OntwikkelingsrapportId,
                        principalTable: "ontwikkelingsrapporten",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_rapportbeoordelingen_rapportdoelen_RapportdoelId",
                        column: x => x.RapportdoelId,
                        principalTable: "rapportdoelen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ontwikkelingsrapporten_LeerlingId_Moment",
                table: "ontwikkelingsrapporten",
                columns: new[] { "LeerlingId", "Moment" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rapportbeoordelingen_GradatieId",
                table: "rapportbeoordelingen",
                column: "GradatieId");

            migrationBuilder.CreateIndex(
                name: "IX_rapportbeoordelingen_RapportdoelId",
                table: "rapportbeoordelingen",
                column: "RapportdoelId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "rapportbeoordelingen");

            migrationBuilder.DropTable(
                name: "ontwikkelingsrapporten");
        }
    }
}
