using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Schooluren : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "schooldaguren",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Weekdag = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Begin = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Einde = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    MiddagpauzeBegin = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    MiddagpauzeEinde = table.Column<TimeOnly>(type: "time without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_schooldaguren", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_schooldaguren_Weekdag",
                table: "schooldaguren",
                column: "Weekdag",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "schooldaguren");
        }
    }
}
