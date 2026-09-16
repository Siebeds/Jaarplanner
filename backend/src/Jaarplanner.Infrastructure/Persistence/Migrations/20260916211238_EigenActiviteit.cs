using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EigenActiviteit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EigenaarId",
                table: "activiteiten",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_activiteiten_EigenaarId",
                table: "activiteiten",
                column: "EigenaarId");

            migrationBuilder.AddForeignKey(
                name: "FK_activiteiten_gebruikers_EigenaarId",
                table: "activiteiten",
                column: "EigenaarId",
                principalTable: "gebruikers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_activiteiten_gebruikers_EigenaarId",
                table: "activiteiten");

            migrationBuilder.DropIndex(
                name: "IX_activiteiten_EigenaarId",
                table: "activiteiten");

            migrationBuilder.DropColumn(
                name: "EigenaarId",
                table: "activiteiten");
        }
    }
}
