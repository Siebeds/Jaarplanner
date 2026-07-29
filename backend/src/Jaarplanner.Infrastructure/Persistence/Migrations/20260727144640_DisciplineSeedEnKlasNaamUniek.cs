using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DisciplineSeedEnKlasNaamUniek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "disciplines",
                columns: new[] { "Nummer", "Naam", "ParentDisciplineNummer" },
                values: new object[,]
                {
                    { "1", "Nederlands en communicatie", null },
                    { "10", "Frans", null },
                    { "11", "Rooms-katholieke godsdienst", null },
                    { "2", "Wiskunde", null },
                    { "3", "Wetenschap en techniek", null },
                    { "4", "Aardrijkskunde", null },
                    { "5", "Geschiedenis", null },
                    { "6", "Muzische vorming", null },
                    { "7", "Lichamelijke opvoeding en motoriek", null },
                    { "8", "ICT", null },
                    { "9.1", "Veilige en gezonde levensstijl", null },
                    { "9.2", "Leren leren", null },
                    { "9.3", "Sociaal en emotioneel leren", null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_klassen_Naam",
                table: "klassen",
                column: "Naam",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_klassen_Naam",
                table: "klassen");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "1");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "10");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "11");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "2");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "3");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "4");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "5");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "6");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "7");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "8");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "9.1");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "9.2");

            migrationBuilder.DeleteData(
                table: "disciplines",
                keyColumn: "Nummer",
                keyValue: "9.3");
        }
    }
}
