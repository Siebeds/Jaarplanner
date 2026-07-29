using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jaarplanner.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// E3-01: the <c>Jaarplan</c> aggregate with its <c>Themaplaatsing</c> collection (Art. IX.3), plus the
    /// Schooljaar↔Klas containment ("Schooljaar contains multiple klassen").
    /// <para>
    /// <b>There is deliberately no planningsblok table.</b> A placement stores the block's <c>BlokStart</c> (a
    /// <c>date</c>) and <c>BlokNiveau</c>, and no <c>Ordinaal</c>: the grid stays derived (ADR-0013) and the
    /// ordinal is an unstable display position (ADR-0020 §3).
    /// </para>
    /// <para>
    /// <b>Breaking for existing <c>klassen</c> rows.</b> <c>SchooljaarId</c> is added NOT NULL with a zero-Guid
    /// default purely because Postgres requires a default to fill existing rows, and that value satisfies no
    /// foreign key. The guard below therefore refuses to run against a non-empty <c>klassen</c> table with an
    /// actionable message instead of letting the FK fail cryptically. This is safe today — the app has no
    /// production deployment (only M0 is reached) — and if that ever changes, the fix is a follow-up migration
    /// that creates a schooljaar and back-fills, which is a decision about <i>which</i> year those classes belong
    /// to and must not be guessed here.
    /// </para>
    /// </summary>
    public partial class JaarplanEnSchooljaarKlassen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fail loudly rather than with an opaque FK violation: existing classes have no school year to belong
            // to, and picking one for them is a data decision, not a migration detail.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM klassen) THEN
                        RAISE EXCEPTION 'Migration JaarplanEnSchooljaarKlassen requires an empty "klassen" table: a Klas now belongs to a Schooljaar (Art. IX.3) and existing rows have no year to assign. Back-fill klassen.SchooljaarId in a dedicated migration first.';
                    END IF;
                END $$;
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "SchooljaarId",
                table: "klassen",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "jaarplannen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    KlasId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jaarplannen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_jaarplannen_klassen_KlasId",
                        column: x => x.KlasId,
                        principalTable: "klassen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "themaplaatsingen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    JaarplanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ThemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlokNiveau = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    BlokStart = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiMotivatie = table.Column<string>(type: "text", nullable: true),
                    Vergrendeld = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_themaplaatsingen", x => x.Id);
                    table.ForeignKey(
                        name: "FK_themaplaatsingen_jaarplannen_JaarplanId",
                        column: x => x.JaarplanId,
                        principalTable: "jaarplannen",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_themaplaatsingen_themas_ThemaId",
                        column: x => x.ThemaId,
                        principalTable: "themas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_klassen_SchooljaarId",
                table: "klassen",
                column: "SchooljaarId");

            migrationBuilder.CreateIndex(
                name: "IX_jaarplannen_KlasId",
                table: "jaarplannen",
                column: "KlasId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_themaplaatsingen_JaarplanId_BlokStart",
                table: "themaplaatsingen",
                columns: new[] { "JaarplanId", "BlokStart" });

            migrationBuilder.CreateIndex(
                name: "IX_themaplaatsingen_JaarplanId_ThemaId_BlokNiveau_BlokStart",
                table: "themaplaatsingen",
                columns: new[] { "JaarplanId", "ThemaId", "BlokNiveau", "BlokStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_themaplaatsingen_ThemaId",
                table: "themaplaatsingen",
                column: "ThemaId");

            migrationBuilder.AddForeignKey(
                name: "FK_klassen_schooljaren_SchooljaarId",
                table: "klassen",
                column: "SchooljaarId",
                principalTable: "schooljaren",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_klassen_schooljaren_SchooljaarId",
                table: "klassen");

            migrationBuilder.DropTable(
                name: "themaplaatsingen");

            migrationBuilder.DropTable(
                name: "jaarplannen");

            migrationBuilder.DropIndex(
                name: "IX_klassen_SchooljaarId",
                table: "klassen");

            migrationBuilder.DropColumn(
                name: "SchooljaarId",
                table: "klassen");
        }
    }
}
