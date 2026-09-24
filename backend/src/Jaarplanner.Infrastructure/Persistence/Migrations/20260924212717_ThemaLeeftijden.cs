using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ThemaLeeftijden : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "Leeftijden",
                table: "themas",
                type: "text[]",
                nullable: false,
                // Every existing thema holds all nine leeftijden (FB-012, ADR-0069 D1), so nothing disappears from a
                // klas's choices. The default only fills the existing rows: EF always writes the column itself.
                defaultValue: new[] { "JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Leeftijden",
                table: "themas");
        }
    }
}
