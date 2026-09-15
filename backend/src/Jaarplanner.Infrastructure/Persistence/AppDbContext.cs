using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core database context for the Jaarplanner relational store (PostgreSQL via Npgsql).
/// <para>
/// E1-01 adds the read-only Op.stap curriculum reference entities (Art. IX.1): <see cref="Disciplines"/>,
/// <see cref="Leerplandoelen"/> and <see cref="Minimumdoelen"/>. E1-02 adds the autonomous, level-scoped
/// themalaag (Art. IX.2): <see cref="Themas"/> + <see cref="Themadoelen"/> (school-scoped) and the
/// class/age-scoped <see cref="Subthemas"/> / <see cref="Subdoelen"/> / <see cref="Activiteiten"/>,
/// plus a minimal <see cref="Klassen"/> to anchor the class scope. The full planning entities
/// (Schooljaar, Jaarplan — Art. IX.3) arrive in later stories.
/// </para>
/// <para>
/// <b>Read-only reference data (Art. III.1).</b> Immutability is enforced structurally in the domain
/// (private setters, no mutators, construction-only) — the application has no code path that mutates
/// the official content of a leerplandoel/minimumdoel/discipline. Import seeding (E1-03) inserts new
/// rows; nothing updates official content.
/// </para>
/// </summary>
public class AppDbContext : DbContext, IDataProtectionKeyContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    /// <summary>The Op.stap disciplines (read-only reference data — Art. III.1, IX.1).</summary>
    public DbSet<Discipline> Disciplines => Set<Discipline>();

    /// <summary>The Op.stap leerplandoelen (read-only reference data — Art. III.1, IX.1).</summary>
    public DbSet<Leerplandoel> Leerplandoelen => Set<Leerplandoel>();

    /// <summary>The decreed minimumdoelen (read-only reference data — Art. III.1, IX.1).</summary>
    public DbSet<Minimumdoel> Minimumdoelen => Set<Minimumdoel>();

    /// <summary>The applied imports of KOV's curriculum, one row each (E1-21, ADR-0032 decision 6).</summary>
    public DbSet<Opstapversie> Opstapversies => Set<Opstapversie>();

    /// <summary>The class groups (Art. IX.3) — anchor for the class/age-scoped school content.</summary>
    public DbSet<Klas> Klassen => Set<Klas>();

    /// <summary>
    /// The school years with their vakantie-/periodestructuur (Art. IX.3, E3-05). Note there is
    /// deliberately no <c>Planningsblokken</c> set: blocks are derived from a schooljaar by the
    /// <c>IPlanningsblokIndeling</c> seam, so no row commits the school to a granularity (ADR-0013).
    /// </summary>
    public DbSet<Schooljaar> Schooljaren => Set<Schooljaar>();

    /// <summary>
    /// The per-class year plans with their thema placements (Art. IX.3, E3-01). A placement stores the
    /// planningsblok's <b>start date</b> + tier, never an ordinal (ADR-0020 §3) — and, as with the schooljaar,
    /// there is deliberately no <c>Planningsblokken</c> set: the grid stays derived (ADR-0013).
    /// </summary>
    public DbSet<Jaarplan> Jaarplannen => Set<Jaarplan>();

    /// <summary>
    /// The pre-generation settings each class keeps between runs (E3-04, FR-5.4). Scoped by
    /// <c>(KlasId, SchooljaarId)</c> because every value in them is a date, so a row must never be read for a
    /// different school year than the one it was written for.
    /// </summary>
    public DbSet<Generatieparameters> Generatieparameters => Set<Generatieparameters>();

    /// <summary>The school's thema's — school-scoped autonomous content (Art. IX.2).</summary>
    public DbSet<Thema> Themas => Set<Thema>();

    /// <summary>The school-wide themadoelen anchoring each thema (Art. IX.2).</summary>
    public DbSet<Themadoel> Themadoelen => Set<Themadoel>();

    /// <summary>The class/age-scoped subthema's (Art. IX.2).</summary>
    public DbSet<Subthema> Subthemas => Set<Subthema>();

    /// <summary>The class/age-scoped subdoelen, per (subthema × leeftijd) (Art. IX.2).</summary>
    public DbSet<Subdoel> Subdoelen => Set<Subdoel>();

    /// <summary>The class/age-scoped activiteiten (Art. IX.2).</summary>
    public DbSet<Activiteit> Activiteiten => Set<Activiteit>();

    /// <summary>The driving questions per class/age-scoped subthema (Art. IX.2).</summary>
    public DbSet<Onderzoeksvraag> Onderzoeksvragen => Set<Onderzoeksvraag>();

    /// <summary>
    /// The activiteiten scheduled onto individual teaching days (E9-03, FR-6.2/FR-7.2) — the day-level half of a
    /// jaarplan, keyed on a real calendar date rather than on a derived planningsblok.
    /// <para>
    /// <b>A set of its own, unlike <c>Themaplaatsing</c>, and the difference is deliberate.</b> Thema placements are
    /// an <i>owned</i> collection of <see cref="Jaarplan"/>, which EF will not let anyone query independently — the
    /// limitation E5-01's worklog records paying for. Two things this story needs are exactly such queries: the week
    /// view reads one date range instead of a whole year of days, and the activiteit delete guard has to count the
    /// placements of one activiteit without loading every plan in the school. Ownership is not free here and buys
    /// nothing that <c>OnDelete(Cascade)</c> does not already give, so this one is a plain entity.
    /// </para>
    /// </summary>
    public DbSet<Activiteitplaatsing> Activiteitplaatsingen => Set<Activiteitplaatsing>();

    /// <summary>
    /// The stretches of days marked off for a subthema (owner ruling, 2026-08-25). Queried independently of the
    /// plan for the same reason as the day placements: the calendar reads one range, not a year.
    /// </summary>
    public DbSet<Subthemaplaatsing> Subthemaplaatsingen => Set<Subthemaplaatsing>();

    /// <summary>
    /// The learning corners of each class (owner, meeting 2026-08-30). Autonomous school content (Art. III), and
    /// the only school-content table that reaches a klas without going through a thema, because a hoek belongs to
    /// a room rather than to a subject.
    /// </summary>
    public DbSet<Hoek> Hoeken => Set<Hoek>();

    /// <summary>
    /// The stretches of days a hoek runs in a class, each owning its <see cref="Hoekverrijking"/>en. Queried
    /// independently of the jaarplan because it does not belong to one: see <see cref="Hoekplaatsing"/> for why a
    /// (re)generation must not be able to reach these.
    /// </summary>
    public DbSet<Hoekplaatsing> Hoekplaatsingen => Set<Hoekplaatsing>();

    /// <summary>
    /// What is in each corner, per stretch of days. A set of its own so a day can be read without loading a whole
    /// placement graph; the aggregate still owns them and still enforces their two window rules.
    /// </summary>
    public DbSet<Hoekverrijking> Hoekverrijkingen => Set<Hoekverrijking>();

    /// <summary>
    /// Where each placed hoek appears in the timetable, one row per day it takes a lesuur on. A set of its own
    /// because the day and week views read a date range across every placement, which is not a question the
    /// owning aggregate can be asked.
    /// </summary>
    public DbSet<Hoekmoment> Hoekmomenten => Set<Hoekmoment>();

    /// <summary>
    /// The recurring activities of each class that belong to no thema: the onthaal, the turnles (owner, 2026-09-11).
    /// Like a hoek they reach a klas directly; unlike a hoek they carry doelkoppelingen that count for dekking once
    /// the fiche is planned (Art. V.1 as amended 2026-09-11).
    /// </summary>
    public DbSet<AlgemeneFiche> AlgemeneFiches => Set<AlgemeneFiche>();

    /// <summary>
    /// The stretches of days an algemene fiche is planned in a class. Outside the jaarplan for the reason
    /// <see cref="Hoekplaatsingen"/> is, and the evidence the dekking computation reads to decide a fiche is planned.
    /// </summary>
    public DbSet<AlgemeneFicheplaatsing> AlgemeneFicheplaatsingen => Set<AlgemeneFicheplaatsing>();

    /// <summary>Where each planned fiche appears in the timetable, one row per day it happens on.</summary>
    public DbSet<AlgemeneFichemoment> AlgemeneFichemomenten => Set<AlgemeneFichemoment>();

    /// <summary>
    /// The staff who may log in (E6-01, ADR-0030 R2): invited by directie, bound to an Entra account on first login.
    /// Staff data only (Art. VI.2), with its register entry owed by E7-06.
    /// </summary>
    public DbSet<Gebruiker> Gebruikers => Set<Gebruiker>();

    /// <summary>Which gebruiker teaches which klas, many-to-many (E6-02, ADR-0030 R15).</summary>
    public DbSet<Klastoewijzing> Klastoewijzingen => Set<Klastoewijzing>();

    /// <summary>The hoofdleerkrachten per (schooljaar, jaarfase), several allowed (E6-02, ADR-0030 R5).</summary>
    public DbSet<Hoofdleerkrachtaanstelling> Hoofdleerkrachtaanstellingen => Set<Hoofdleerkrachtaanstelling>();

    /// <summary>
    /// The thema-opbouw wizard's runs (E6-02, ADR-0030 R32, I22–I25): which thema each built, and what it created, so the
    /// wizard's own write actions can tell a thema built from scratch from any other.
    /// </summary>
    public DbSet<Wizardrun> Wizardruns => Set<Wizardrun>();

    /// <summary>
    /// The children of the K3 klassen, for the ontwikkelingsrapport (FB-001, Art. IX.4). <b>Pupil data</b> (Art. VI.7):
    /// a voornaam, an achternaam and the klas, nothing else, and never in a log.
    /// </summary>
    public DbSet<Leerling> Leerlingen => Set<Leerling>();

    /// <summary>
    /// The ASP.NET Core Data Protection keys that encrypt the session cookie (ADR-0031 decision 5). Kept here so a
    /// restart or a second instance does not log everyone out. Framework-owned rows; nothing in the app reads them.
    /// </summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Every Guid key in this model is assigned by the domain constructor (`= Guid.NewGuid()`), so none of
        // them is store-generated. Saying so once, model-wide, closes a defect class this repo met three times.
        //
        // EF's convention for a Guid key is ValueGenerated.OnAdd. When change tracking discovers an untracked
        // entity inside the collection of an ALREADY-LOADED parent, it decides Added-versus-Modified from
        // "is the key set AND store-generated" — and since the constructor set it, a brand-new child is tracked
        // as Modified. SaveChanges then emits an UPDATE for a row that does not exist, which PostgreSQL reports
        // as `DbUpdateConcurrencyException: expected to affect 1 row(s), but actually affected 0 row(s)`.
        //
        // It cost three separate diagnoses to get here, each fixing only what it happened to meet: E3-04 fixed
        // Themaplaatsing, and KlasBeheerService/SchoolcontentBeheerService/SchoolcontentImportService each
        // worked around it with an explicit `_context.X.Add(child)` (which forces Added). What none of them
        // fixed was the collection with no such workaround ON THE IMPORT PATH: `SchoolcontentImportService`
        // adds Themadoelen and Subdoelen explicitly but not Subthemas or Activiteiten, so adding a Subthema or
        // an Activiteit to an existing thema — the ordinary school-content re-import — answered 500 from the
        // second import onward (found by E1-13's round-2 browser pass; `AggregaatGroeiTests` now covers every
        // collection). Note the qualifier: the beheer endpoints reach those same two collections through
        // `SchoolcontentBeheerService`, which *does* carry the workaround (`Subthemas.Add`, `Activiteiten.Add`),
        // so `POST /themas/{id}/subthemas` was never broken. An earlier version of this comment said the two
        // collections had no such line at all, which would have sent the next reader looking in the wrong file
        // (E1-13 round-3 audit, MINOR 2).
        //
        // Two reasons this is a model-wide rule rather than a line per configuration: the statement is true of
        // the whole model, not of the entities that happened to break; and a new child collection would
        // otherwise reintroduce the defect and, on the in-memory provider, no test would notice.
        //
        // THE PRECONDITION IS THE OTHER HALF OF THIS RULE, and it inverts the failure mode: a Guid-keyed entity
        // whose constructor does *not* assign its key now inserts Guid.Empty in silence, and the second row of
        // that type violates the primary key. A new entity must therefore assign its own key. That is no longer
        // only an instruction: `GuidSleutelConventieTests` reads the finalised model and fails on a Guid key
        // that is store-generated or that a freshly constructed instance leaves empty. Reading the *finalised*
        // model is deliberate, because this loop is the last statement in the method and a configuration added
        // below it would override the rule without any other signal.
        //
        // Metadata only. Npgsql generates a `uuid` key client-side rather than with a database default, so no
        // column, default or constraint changes — verified with `dotnet ef migrations has-pending-model-changes`
        // and by re-running the migrations against a fresh database.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetKeys()
                .SelectMany(key => key.Properties)
                .Where(p => p.ClrType == typeof(Guid)))
            {
                property.ValueGenerated = ValueGenerated.Never;
            }
        }
    }
}
