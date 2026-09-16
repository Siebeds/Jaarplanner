using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ThemaIcoon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Icoon",
                table: "themas",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Icoon",
                table: "themas");
        }
    }
}
