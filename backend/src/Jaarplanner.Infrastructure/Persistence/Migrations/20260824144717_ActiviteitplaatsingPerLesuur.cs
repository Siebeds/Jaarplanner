using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ActiviteitplaatsingPerLesuur : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum",
                table: "activiteitplaatsingen");

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum_Volgorde",
                table: "activiteitplaatsingen",
                columns: new[] { "JaarplanId", "ActiviteitId", "Datum", "Volgorde" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum_Volgorde",
                table: "activiteitplaatsingen");

            migrationBuilder.CreateIndex(
                name: "IX_activiteitplaatsingen_JaarplanId_ActiviteitId_Datum",
                table: "activiteitplaatsingen",
                columns: new[] { "JaarplanId", "ActiviteitId", "Datum" },
                unique: true);
        }
    }
}
