using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Wizardrun : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "wizardruns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    GestartDoorId = table.Column<Guid>(type: "uuid", nullable: true),
                    GestartOp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LaatsteSchrijfactieOp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AfgerondOp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    GeslotenOp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wizardruns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wizardruns_gebruikers_GestartDoorId",
                        column: x => x.GestartDoorId,
                        principalTable: "gebruikers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_wizardruns_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wizardrunitems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Soort = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    WizardrunId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wizardrunitems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wizardrunitems_wizardruns_WizardrunId",
                        column: x => x.WizardrunId,
                        principalTable: "wizardruns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_wizardrunitems_WizardrunId_ItemId",
                table: "wizardrunitems",
                columns: new[] { "WizardrunId", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_wizardruns_GestartDoorId",
                table: "wizardruns",
                column: "GestartDoorId");

            migrationBuilder.CreateIndex(
                name: "IX_wizardruns_ThemaId",
                table: "wizardruns",
                column: "ThemaId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "wizardrunitems");

            migrationBuilder.DropTable(
                name: "wizardruns");
        }
    }
}
