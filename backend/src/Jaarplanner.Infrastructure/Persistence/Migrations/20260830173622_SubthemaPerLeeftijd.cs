using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// A subthema is scoped by leeftijd alone (Art. IX.2, owner ruling 2026-08-30, ADR-0025): the klas leaves the
    /// scope, so a subthema on K3 holds for every class that teaches K3.
    /// <para>
    /// <b>The data move happens BEFORE the column is dropped, and it is the whole point of hand-editing this
    /// migration.</b> <c>Leeftijd</c> was free text until today and real rows hold "5", "5-6", "8-9" — values no
    /// klas can ever match, so dropping <c>KlasId</c> without converting them would leave content that is stored,
    /// intact, and unreachable from every screen. The klas each subthema hangs on is the only trustworthy source
    /// for the age, and it is available exactly until the line below removes it.
    /// </para>
    /// </summary>
    public partial class SubthemaPerLeeftijd : Migration
    {
        /// <summary>The nine Op.stap jaar/fase codes, as a SQL list. Mirrors <c>Jaarfasen.Alle</c>.</summary>
        private const string Codes = "'JK','K2','K3','L1','L2','L3','L4','L5','L6'";

        /// <summary>
        /// The age a klas teaches, in SQL: its own recorded jaar/fase, else the code its leerjaar implies, else
        /// null. Mirrors <c>Jaarfasen.VoorKlas</c> with one deliberate difference — a kleutergroep that records
        /// nothing yields <c>null</c> here rather than all three kleuter codes, because a single column cannot
        /// hold three and picking one would be the guess the 2026-08-04 ruling forbids.
        /// </summary>
        private const string Afgeleid =
            """COALESCE(NULLIF(BTRIM(k."Jaarfase"), ''), CASE WHEN k."Leerjaar" BETWEEN 1 AND 6 THEN 'L' || k."Leerjaar"::text END)""";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only rows whose leeftijd is NOT already a valid code are touched, so a subthema someone entered
            // correctly is never overwritten by its class's value. Rows the class cannot answer for are left
            // exactly as they are: they become unreachable, which every screen now says out loud, and that is far
            // better than this migration inventing an age for a teacher's content. The owner was asked to set each
            // class's leeftijd BEFORE this runs precisely so that set is empty.
            migrationBuilder.Sql($"""
                UPDATE subthemas AS s
                SET "Leeftijd" = {Afgeleid}
                FROM klassen AS k
                WHERE k."Id" = s."KlasId"
                  AND s."Leeftijd" NOT IN ({Codes})
                  AND {Afgeleid} IS NOT NULL;
                """);

            // NOT deduplicated on purpose. Two classes of the same age may each hold a subthema with the same name
            // under the same thema, and those rows are now indistinguishable by scope. Merging them would mean
            // choosing which one's activiteiten, subdoelen and goal links survive, which is a teacher's decision
            // about their own content and not a migration's. They appear as two rows with the same name, which is
            // visible and fixable; a silent merge would not be.
            migrationBuilder.DropForeignKey(
                name: "FK_subthemas_klassen_KlasId",
                table: "subthemas");

            migrationBuilder.DropIndex(
                name: "IX_subthemas_KlasId_Leeftijd",
                table: "subthemas");

            migrationBuilder.DropColumn(
                name: "KlasId",
                table: "subthemas");

            migrationBuilder.CreateIndex(
                name: "IX_subthemas_Leeftijd",
                table: "subthemas",
                column: "Leeftijd");
        }

        /// <summary>
        /// <b>This reverses the schema and CANNOT reverse the data.</b> Every subthema gets <c>KlasId</c> back as
        /// the zero GUID, which satisfies no foreign key, so the <c>AddForeignKey</c> below fails on any database
        /// that holds a subthema. That is deliberate and it is the honest shape: the klas each subthema belonged
        /// to is not recoverable from a leeftijd, and a Down that silently pointed every subthema at some
        /// arbitrary class would destroy the mapping while appearing to succeed. To go back, restore a backup.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_subthemas_Leeftijd",
                table: "subthemas");

            migrationBuilder.AddColumn<Guid>(
                name: "KlasId",
                table: "subthemas",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_subthemas_KlasId_Leeftijd",
                table: "subthemas",
                columns: new[] { "KlasId", "Leeftijd" });

            migrationBuilder.AddForeignKey(
                name: "FK_subthemas_klassen_KlasId",
                table: "subthemas",
                column: "KlasId",
                principalTable: "klassen",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
