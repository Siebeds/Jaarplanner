using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Enforces class-name uniqueness <b>case-insensitively</b> in the database, via a functional unique
    /// index on <c>lower("Naam")</c>.
    /// <para>
    /// The EF-declared unique index added by the previous migration is case-<i>sensitive</i>: it stops
    /// "L3" twice but not "l3" vs "L3". That gap was originally documented as "deferred because EF cannot
    /// express a functional index declaratively" — true of the EF <i>model</i>, but a migration can simply
    /// emit the SQL, which is what this does. The school-content import resolves a class <b>by name</b>,
    /// so two names differing only in case would make that resolution arbitrary.
    /// </para>
    /// <para>
    /// Hand-written SQL is invisible to the model snapshot, so this introduces no model/migration drift;
    /// <c>KlasBeheerService</c>'s pre-check exists only to turn the violation into a friendly Dutch 400.
    /// </para>
    /// </summary>
    public partial class KlasNaamCaseInsensitiefUniek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(
                """
                CREATE UNIQUE INDEX "IX_klassen_Naam_lower"
                    ON klassen (lower("Naam"));
                """);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_klassen_Naam_lower";""");
    }
}
