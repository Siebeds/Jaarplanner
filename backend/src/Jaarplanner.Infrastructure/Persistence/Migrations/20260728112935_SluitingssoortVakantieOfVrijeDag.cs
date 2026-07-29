using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Renames <c>schoolvakanties</c> to <c>schoolsluitingen</c> and adds <c>Soort</c>
    /// (<c>Vakantie</c> | <c>VrijeDag</c>) — the directie ruling of 2026-07-28 that only a real vacation ends
    /// a planning period, while a single free day (Hemelvaart, Pinkstermaandag, pedagogische studiedag) is a
    /// day off <i>inside</i> a period.
    /// <para>
    /// <b>Hand-written as a rename, not a drop-and-recreate.</b> EF scaffolded
    /// <c>DropTable</c> + <c>CreateTable</c>, which would discard every stored closure. That happens to be
    /// harmless today — <c>schoolvakanties</c> was created by the immediately preceding migration on this same
    /// unmerged branch and has never been applied anywhere — but shipping a destructive migration when a
    /// rename does the job is exactly the habit that eventually loses a school's calendar. Existing rows are
    /// preserved and classified as <c>Vakantie</c>, which is the conservative reading: treating a real vacation
    /// as a mere free day would let a planningsblok span it, which Art. IX.3 forbids.
    /// </para>
    /// <para>
    /// <c>Soort</c> is added nullable, backfilled, then made <c>NOT NULL</c> — rather than added with a
    /// database default — so no default constraint lingers that the EF model does not declare (which would
    /// show up as model/migration drift).
    /// </para>
    /// </summary>
    public partial class SluitingssoortVakantieOfVrijeDag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "schoolvakanties",
                newName: "schoolsluitingen");

            migrationBuilder.RenameIndex(
                name: "IX_schoolvakanties_SchooljaarId_Start",
                table: "schoolsluitingen",
                newName: "IX_schoolsluitingen_SchooljaarId_Start");

            // RenameTable leaves the key/constraint names behind; rename them too so a later migration is not
            // reading from a table whose constraints still carry the old entity's name.
            migrationBuilder.Sql(
                """
                ALTER TABLE schoolsluitingen
                    RENAME CONSTRAINT "PK_schoolvakanties" TO "PK_schoolsluitingen";
                """);
            migrationBuilder.Sql(
                """
                ALTER TABLE schoolsluitingen
                    RENAME CONSTRAINT "FK_schoolvakanties_schooljaren_SchooljaarId"
                    TO "FK_schoolsluitingen_schooljaren_SchooljaarId";
                """);

            migrationBuilder.AddColumn<string>(
                name: "Soort",
                table: "schoolsluitingen",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE schoolsluitingen SET "Soort" = 'Vakantie' WHERE "Soort" IS NULL;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Soort",
                table: "schoolsluitingen",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reversing loses the Vakantie/VrijeDag distinction — unavoidable, since the old shape cannot
            // express it. Rows survive; every closure reverts to being period-breaking.
            migrationBuilder.DropColumn(
                name: "Soort",
                table: "schoolsluitingen");

            migrationBuilder.Sql(
                """
                ALTER TABLE schoolsluitingen
                    RENAME CONSTRAINT "FK_schoolsluitingen_schooljaren_SchooljaarId"
                    TO "FK_schoolvakanties_schooljaren_SchooljaarId";
                """);
            migrationBuilder.Sql(
                """
                ALTER TABLE schoolsluitingen
                    RENAME CONSTRAINT "PK_schoolsluitingen" TO "PK_schoolvakanties";
                """);

            migrationBuilder.RenameIndex(
                name: "IX_schoolsluitingen_SchooljaarId_Start",
                table: "schoolsluitingen",
                newName: "IX_schoolvakanties_SchooljaarId_Start");

            migrationBuilder.RenameTable(
                name: "schoolsluitingen",
                newName: "schoolvakanties");
        }
    }
}
