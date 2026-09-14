using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MinimumdoelOrdeningEnSoort : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "leergebied",
                table: "minimumdoelen",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rubriek",
                table: "minimumdoelen",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "soort",
                table: "minimumdoelen",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "subrubriek",
                table: "minimumdoelen",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "leergebied",
                table: "minimumdoelen");

            migrationBuilder.DropColumn(
                name: "rubriek",
                table: "minimumdoelen");

            migrationBuilder.DropColumn(
                name: "soort",
                table: "minimumdoelen");

            migrationBuilder.DropColumn(
                name: "subrubriek",
                table: "minimumdoelen");
        }
    }
}
