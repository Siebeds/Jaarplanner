using Jaarplanner.Application.Curriculum.Import;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the property that <see cref="OpstapImportFout"/>'s factories exist for: <b>one Dutch message source
/// per <see cref="OpstapImportFoutSoort"/></b> (Art. II.3 clause 3).
/// <para>
/// <b>Why this needs a test at all.</b> Each case is raised from two places — the up-front preflight, which
/// knows which refs or codes offended, and the <c>SaveChanges</c> translator, which only knows the constraint
/// that broke. The second is unreachable without a concurrent writer, so <b>no behavioural test can compare
/// the two</b>: the first version of this code let each site write its own sentence and the drift would have
/// been invisible until a directie member met the stale copy during a real race. These tests compare the two
/// renderings of each factory directly, which is the only level at which the divergence is observable.
/// </para>
/// <para>
/// They deliberately duplicate <b>no Dutch</b>. Each assertion is structural: the two renderings may differ
/// only by the inserted examples, so a reworded instruction sentence cannot land in one and not the other.
/// </para>
/// </summary>
public sealed class OpstapImportFoutTests
{
    /// <summary>The message from its second sentence on, i.e. everything after the case-specific opening.</summary>
    private static string Staart(string melding) =>
        melding[(melding.IndexOf(". ", StringComparison.Ordinal) + 2)..];

    [Fact]
    public void Onbekende_discipline_leest_identiek_uit_beide_paden()
    {
        var preflight = OpstapImportFout.OnbekendeDiscipline("99");
        var vertaald = OpstapImportFout.OnbekendeDiscipline("99", new InvalidOperationException("db"));

        Assert.Equal(OpstapImportFoutSoort.OnbekendeDiscipline, preflight.Soort);
        Assert.Equal(preflight.Message, vertaald.Message);
        Assert.Contains("99", preflight.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Ontbrekende_minimumdoelen_verschilt_alleen_in_de_genoemde_verwijzingen()
    {
        var metDetail = OpstapImportFout.OntbrekendeMinimumdoelen(["4-12"]).Message;
        var zonderDetail = OpstapImportFout.OntbrekendeMinimumdoelen([]).Message;

        Assert.Contains("4-12", metDetail, StringComparison.Ordinal);
        Assert.DoesNotContain("4-12", zonderDetail, StringComparison.Ordinal);
        // Removing the inserted examples must yield the message the other path produces, character for
        // character: the instruction that follows can then only have one source.
        Assert.Equal(zonderDetail, metDetail.Replace(": 4-12", string.Empty, StringComparison.Ordinal));
        Assert.Equal(Staart(zonderDetail), Staart(metDetail));
    }

    [Fact]
    public void Code_in_andere_discipline_deelt_de_staart_tussen_beide_paden()
    {
        var metDetail = OpstapImportFout
            .CodeInAndereDiscipline("3", [new DoelInAndereDiscipline("WIS-1", "2")]).Message;
        var zonderDetail = OpstapImportFout.CodeInAndereDiscipline("3", []).Message;

        Assert.Contains("WIS-1 (discipline 2)", metDetail, StringComparison.Ordinal);
        Assert.DoesNotContain("WIS-1", zonderDetail, StringComparison.Ordinal);
        // The openings differ (one names the codes, the other cannot); everything after them is shared.
        Assert.Equal(Staart(zonderDetail), Staart(metDetail));
        // Both name the discipline the file was uploaded as, which is the actionable part.
        Assert.Contains("discipline 3", Staart(zonderDetail), StringComparison.Ordinal);
    }

    /// <summary>
    /// A long list is truncated rather than dumped: a real Op.stap file can carry thousands of codes, and a
    /// refusal message is read by a person.
    /// </summary>
    [Fact]
    public void Een_lange_lijst_wordt_afgekapt()
    {
        var refs = Enumerable.Range(1, OpstapImportFout.MaxGenoemdeVoorbeelden + 3)
            .Select(i => $"4-{i}")
            .ToList();

        var melding = OpstapImportFout.OntbrekendeMinimumdoelen(refs).Message;

        Assert.Contains("4-1,", melding, StringComparison.Ordinal);
        Assert.Contains("en nog meer", melding, StringComparison.Ordinal);
        Assert.DoesNotContain($"4-{OpstapImportFout.MaxGenoemdeVoorbeelden + 3}", melding, StringComparison.Ordinal);
    }

    /// <summary>
    /// The underlying database fault survives into the log. The <c>SaveChanges</c> translator passes the
    /// <c>DbUpdateException</c> here, and it is the only artefact carrying the SQLSTATE, the constraint name
    /// and the table — discarded, the one situation that produces that path becomes undiagnosable.
    /// </summary>
    [Fact]
    public void De_oorspronkelijke_databasefout_blijft_bewaard()
    {
        var oorzaak = new InvalidOperationException("23503 on FK_leerplandoelen_minimumdoelen_MinimumdoelRef");

        Assert.Same(oorzaak, OpstapImportFout.OnbekendeDiscipline("99", oorzaak).InnerException);
        Assert.Same(oorzaak, OpstapImportFout.OntbrekendeMinimumdoelen([], oorzaak).InnerException);
        Assert.Same(oorzaak, OpstapImportFout.CodeInAndereDiscipline("2", [], oorzaak).InnerException);
        // The preflight has no underlying fault, and must not invent one.
        Assert.Null(OpstapImportFout.OnbekendeDiscipline("99").InnerException);
    }
}
