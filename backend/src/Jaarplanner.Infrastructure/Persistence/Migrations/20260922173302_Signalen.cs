using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Signalen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "kattikken",
                columns: table => new
                {
                    Moment = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Instantie = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Gestart = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Voltooid = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kattikken", x => x.Moment);
                });

            migrationBuilder.CreateTable(
                name: "signalen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Soort = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false),
                    OntvangerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sleutel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Aangemaakt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    GezienOp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UitgesteldTot = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_signalen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_signalen_gebruikers_OntvangerId",
                        column: x => x.OntvangerId,
                        principalTable: "gebruikers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_signalen_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_signalen_KlasId",
                table: "signalen",
                column: "KlasId");

            migrationBuilder.CreateIndex(
                name: "IX_signalen_OntvangerId",
                table: "signalen",
                column: "OntvangerId");

            migrationBuilder.CreateIndex(
                name: "IX_signalen_Soort_KlasId_OntvangerId_Sleutel",
                table: "signalen",
                columns: new[] { "Soort", "KlasId", "OntvangerId", "Sleutel" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "kattikken");

            migrationBuilder.DropTable(
                name: "signalen");
        }
    }
}
