using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MinimumdoelZonderLeerplandoelReden : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "zonder_leerplandoel_doelsets",
                table: "minimumdoelen",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "zonder_leerplandoel_reden",
                table: "minimumdoelen",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "zonder_leerplandoel_doelsets",
                table: "minimumdoelen");

            migrationBuilder.DropColumn(
                name: "zonder_leerplandoel_reden",
                table: "minimumdoelen");
        }
    }
}
