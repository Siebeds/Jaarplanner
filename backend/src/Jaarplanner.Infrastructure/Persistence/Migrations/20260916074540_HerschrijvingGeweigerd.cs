using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HerschrijvingGeweigerd : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HerschrijvingGeweigerd",
                table: "rapportbeoordelingen",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "BesluitHerschrijvingGeweigerd",
                table: "ontwikkelingsrapporten",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HerschrijvingGeweigerd",
                table: "rapportbeoordelingen");

            migrationBuilder.DropColumn(
                name: "BesluitHerschrijvingGeweigerd",
                table: "ontwikkelingsrapporten");
        }
    }
}
