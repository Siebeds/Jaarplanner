using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GebruikersEnSessiesleutels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "data_protection_keys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FriendlyName = table.Column<string>(type: "text", nullable: true),
                    Xml = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_data_protection_keys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "gebruikers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Naam = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    IsDirectie = table.Column<bool>(type: "boolean", nullable: false),
                    EntraTenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    EntraObjectId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gebruikers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gebruikers_Email",
                table: "gebruikers",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_gebruikers_EntraTenantId_EntraObjectId",
                table: "gebruikers",
                columns: new[] { "EntraTenantId", "EntraObjectId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "data_protection_keys");

            migrationBuilder.DropTable(
                name: "gebruikers");
        }
    }
}
