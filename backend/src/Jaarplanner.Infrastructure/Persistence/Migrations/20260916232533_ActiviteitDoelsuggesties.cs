using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ActiviteitDoelsuggesties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ActiviteitId",
                table: "subdoelvoorstellen",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_subdoelvoorstellen_ActiviteitId",
                table: "subdoelvoorstellen",
                column: "ActiviteitId");

            migrationBuilder.AddForeignKey(
                name: "FK_subdoelvoorstellen_activiteiten_ActiviteitId",
                table: "subdoelvoorstellen",
                column: "ActiviteitId",
                principalTable: "activiteiten",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_subdoelvoorstellen_activiteiten_ActiviteitId",
                table: "subdoelvoorstellen");

            migrationBuilder.DropIndex(
                name: "IX_subdoelvoorstellen_ActiviteitId",
                table: "subdoelvoorstellen");

            migrationBuilder.DropColumn(
                name: "ActiviteitId",
                table: "subdoelvoorstellen");
        }
    }
}
