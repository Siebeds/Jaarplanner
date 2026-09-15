using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKindtekeningen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "kindtekeningen",
                columns: table => new
                {
                    OntwikkelingsrapportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Versie = table.Column<Guid>(type: "uuid", nullable: false),
                    Formaat = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Breedte = table.Column<int>(type: "integer", nullable: false),
                    Hoogte = table.Column<int>(type: "integer", nullable: false),
                    Inhoud = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kindtekeningen", x => x.OntwikkelingsrapportId);
                    table.CheckConstraint("CK_kindtekeningen_Breedte", "\"Breedte\" > 0");
                    table.CheckConstraint("CK_kindtekeningen_Hoogte", "\"Hoogte\" > 0");
                    table.ForeignKey(
                        name: "FK_kindtekeningen_ontwikkelingsrapporten_OntwikkelingsrapportId",
                        column: x => x.OntwikkelingsrapportId,
                        principalTable: "ontwikkelingsrapporten",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "kindtekeningen");
        }
    }
}
