using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ActiviteitTypeOptioneel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "activiteit_type",
                table: "activiteiten",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Refuses rather than inventing a soort: filling the gaps with Experiment is exactly the silent default
            // FB-050 removed, and the generated "" default would not parse back into the enum.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM activiteiten WHERE activiteit_type IS NULL) THEN
                        RAISE EXCEPTION 'Cannot roll back ActiviteitTypeOptioneel: some activiteiten have no soort.';
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "activiteit_type",
                table: "activiteiten",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);
        }
    }
}
