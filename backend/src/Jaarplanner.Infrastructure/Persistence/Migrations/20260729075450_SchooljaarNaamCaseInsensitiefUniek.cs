using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Enforces school-year-label uniqueness <b>case-insensitively</b> in the database, via a functional unique
    /// index on <c>lower("Naam")</c>. The exact mirror of <c>KlasNaamCaseInsensitiefUniek</c>, for the same reason.
    /// <para>
    /// <b>The bug this closes.</b> <c>SchooljaarBeheerService</c> pre-checks the label case-<i>insensitively</i>
    /// (<c>lower(naam) = lower(@naam)</c>) and catches a <c>DbUpdateException</c> to cover the concurrent-POST race
    /// the pre-check cannot. But the EF-declared unique index on <c>schooljaren."Naam"</c> is case-<i>sensitive</i>,
    /// so two simultaneous POSTs of labels differing only in case both passed the pre-check <i>and</i> both passed
    /// the index — the race handler was unreachable for exactly the case it was written for. <c>Klas</c> had this
    /// identical defect and was fixed this way; repeating the fix one file away is the whole point.
    /// </para>
    /// <para>
    /// EF cannot express a functional index in the <i>model</i>, but a migration can simply emit the DDL.
    /// Hand-written SQL is invisible to the model snapshot, so this introduces no model/migration drift; the
    /// service's pre-check exists only to turn the violation into a friendly Dutch 400.
    /// </para>
    /// </summary>
    public partial class SchooljaarNaamCaseInsensitiefUniek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(
                """
                CREATE UNIQUE INDEX "IX_schooljaren_Naam_lower"
                    ON schooljaren (lower("Naam"));
                """);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_schooljaren_Naam_lower";""");
    }
}
