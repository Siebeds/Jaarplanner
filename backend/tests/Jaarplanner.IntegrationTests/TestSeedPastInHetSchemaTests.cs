using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// <b>A local guard for a defect class that only CI could previously see.</b>
/// <para>
/// Every <c>[PostgresFact]</c> skips without Docker, so a fixture that seeds an over-long value fails <b>nowhere</b>
/// locally: the EF in-memory provider enforces no <c>max length</c>, and a skipped test cannot visibly regress. Two
/// seed labels built as <c>$"{prefix}-{Guid.NewGuid():N}"</c> came to 41 and 44 characters against
/// <c>Schooljaar.Naam</c>'s <c>varchar(32)</c>, and killed nine tests in their fixture with Postgres
/// <c>22001 value too long for type character varying(32)</c> — visible only after a push.
/// </para>
/// <para>
/// These are plain <c>[Fact]</c>s: they build the EF <b>model</b> (which needs no database connection) and compare the
/// seed helper's output against the <i>real mapped</i> length. So they run on every machine, and they fail if either
/// the helper or the column changes underneath the other.
/// </para>
/// </summary>
public sealed class TestSeedPastInHetSchemaTests
{
    /// <summary>
    /// The production model, built without connecting. <c>UseNpgsql</c> with a connection string that is never opened
    /// is enough to get the Npgsql-specific mapping, including <c>HasMaxLength</c>.
    /// </summary>
    private static IModel Model()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=nooit-verbonden")
            .Options;

        using var context = new AppDbContext(options);

        return context.Model;
    }

    private static int MaxLengte<TEntity>(string property)
    {
        var entiteit = Model().FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name} is not mapped.");

        return entiteit.FindProperty(property)?.GetMaxLength()
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name}.{property} has no max length.");
    }

    /// <summary>
    /// The helper's own constant must match what the schema actually enforces. If a migration widens or narrows
    /// <c>schooljaren."Naam"</c>, this fails rather than letting the helper's assumption rot.
    /// </summary>
    [Fact]
    public void De_helper_kent_de_echte_kolomlengte_van_schooljaarnaam()
    {
        Assert.Equal(TestSchooljaar.MaxNaamLengte, MaxLengte<Schooljaar>(nameof(Schooljaar.Naam)));
    }

    /// <summary>
    /// <see cref="TestSchooljaar.UniekeNaam"/> fits the column for every prefix a test might plausibly pass — including
    /// the two that actually broke CI, and an absurdly long one.
    /// </summary>
    [Theory]
    [InlineData("jaarplan")]
    [InlineData("containment")]
    [InlineData("beheer")]
    [InlineData("import")]
    [InlineData("genparams")]
    [InlineData("volgend")]
    [InlineData("")]
    [InlineData("een-belachelijk-lange-prefix-die-alleen-al-te-lang-is")]
    public void Een_unieke_naam_past_altijd_in_de_kolom(string prefix)
    {
        var naam = TestSchooljaar.UniekeNaam(prefix);

        Assert.InRange(naam.Length, 1, TestSchooljaar.MaxNaamLengte);
    }

    /// <summary>And it stays unique enough to seed many databases without colliding.</summary>
    [Fact]
    public void Unieke_namen_botsen_niet()
    {
        var namen = Enumerable.Range(0, 1_000).Select(_ => TestSchooljaar.UniekeNaam("jaarplan")).ToList();

        Assert.Equal(namen.Count, namen.Distinct(StringComparer.Ordinal).Count());
    }

    /// <summary>The default fixtures fit too — the common path, not just the generated one.</summary>
    [Fact]
    public void De_standaardfixtures_passen_in_de_kolom()
    {
        Assert.InRange(TestSchooljaar.Maak().Naam.Length, 1, TestSchooljaar.MaxNaamLengte);
        Assert.InRange(TestSchooljaar.MetVakanties().Naam.Length, 1, TestSchooljaar.MaxNaamLengte);
    }

    /// <summary>
    /// The other seed values this story introduced, checked against their real columns for the same reason. All of
    /// these were in fact safe — <c>Klas.Naam</c> is 128, <c>Thema.Naam</c> 256 — but "I checked once" is not a guard,
    /// and the next seed added here will be measured rather than eyeballed.
    /// </summary>
    [Fact]
    public void De_overige_seedwaarden_passen_in_hun_kolommen()
    {
        var klasNaam = $"L3-{Guid.NewGuid():N}";
        var themaNaam = $"Herfst-{Guid.NewGuid():N}";
        var sluitingNaam = "Herfstvakantie";

        Assert.InRange(klasNaam.Length, 1, MaxLengte<Klas>(nameof(Klas.Naam)));
        Assert.InRange(themaNaam.Length, 1, MaxLengte<Domain.Schoolcontent.Thema>(nameof(Domain.Schoolcontent.Thema.Naam)));
        Assert.InRange(sluitingNaam.Length, 1, 64);

        // The leerplandoel code the jaarplan fixtures mint is deliberately sliced; prove the slice is inside its column.
        var code = $"NAT-{Guid.NewGuid():N}"[..16];
        Assert.InRange(code.Length, 1, MaxLengte<Domain.Curriculum.Leerplandoel>(nameof(Domain.Curriculum.Leerplandoel.Code)));
    }
}
