using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LeerplandoelNietMeerInOpstapFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "niet_meer_in_opstap",
                table: "leerplandoelen",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "niet_meer_in_opstap",
                table: "leerplandoelen");
        }
    }
}
