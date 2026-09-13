using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OpstapApiLeerplandoelen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "niet_meer_in_opstap",
                table: "minimumdoelen",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "opstap_sleutel",
                table: "leerplandoelen",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "opstapversies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Versie = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ToegepastOp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_opstapversies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_leerplandoelen_opstap_sleutel",
                table: "leerplandoelen",
                column: "opstap_sleutel");

            migrationBuilder.CreateIndex(
                name: "IX_opstapversies_ToegepastOp",
                table: "opstapversies",
                column: "ToegepastOp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "opstapversies");

            migrationBuilder.DropIndex(
                name: "IX_leerplandoelen_opstap_sleutel",
                table: "leerplandoelen");

            migrationBuilder.DropColumn(
                name: "niet_meer_in_opstap",
                table: "minimumdoelen");

            migrationBuilder.DropColumn(
                name: "opstap_sleutel",
                table: "leerplandoelen");
        }
    }
}
