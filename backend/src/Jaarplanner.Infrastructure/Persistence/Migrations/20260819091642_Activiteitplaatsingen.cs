using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Activiteitplaatsingen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "activiteitplaatsingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    JaarplanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActiviteitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Datum = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Volgorde = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activiteitplaatsingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_activiteitplaatsingen_activiteiten_ActiviteitId",
                        column: x => x.ActiviteitId,
                        principalTable: "activiteiten",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_activiteitplaatsingen_jaarplannen_JaarplanId",
                        column: x => x.JaarplanId,
                        principalTable: "jaarplannen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_ActiviteitId",
                table: "activiteitplaatsingen",
                column: "ActiviteitId");

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum",
                table: "activiteitplaatsingen",
                columns: new[] { "JaarplanId", "ActiviteitId", "Datum" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_Datum",
                table: "activiteitplaatsingen",
                columns: new[] { "JaarplanId", "Datum" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activiteitplaatsingen");
        }
    }
}
