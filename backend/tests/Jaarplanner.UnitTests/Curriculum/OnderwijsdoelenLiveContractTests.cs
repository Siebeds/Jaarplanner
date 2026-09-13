using System.Text.RegularExpressions;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.Extensions.Options;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// A contract test against KOV's <b>live</b> API (ADR-0032). Skipped unless <c>JAARPLANNER_LIVE_OPSTAP=1</c>, because a
/// unit run must not depend on a third party's uptime. Its job is the one no fixture can do: notice that KOV changed the
/// shape of its response before a directie presses the import button. Run it by hand, or on a nightly schedule (E1-23).
/// </summary>
public sealed partial class OnderwijsdoelenLiveContractTests
{
    [LiveOpstapFact]
    public async Task De_live_bron_levert_de_decretale_minimumdoelen_zonder_problemen()
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(100) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("Jaarplanner/1.0");
        var bron = new OnderwijsdoelenApiBron(http, Options.Create(new OpstapApiOptions()));

        var resultaat = await bron.HaalOpAsync();

        Assert.Empty(resultaat.Problemen);
        // 998 on 2026-09-11. A floor, not an equality: the decree may grow, and a sudden drop is what this should catch.
        Assert.True(resultaat.Minimumdoelen.Count >= 900, $"Only {resultaat.Minimumdoelen.Count} minimumdoelen came back.");
        Assert.All(resultaat.Minimumdoelen, m =>
        {
            Assert.Matches(RefVorm(), m.Ref);
            Assert.Equal(m.Leeftijd + m.Nr, m.Ref);
            // A closing tag in the output can only come from KOV escaping its own markup (&lt;/p&gt;), which would mean
            // the response shape changed. A bare '<' proves nothing: every raw tag is stripped before entities are
            // decoded, and KOV writes "<bv. … >" around examples. Two earlier versions of this line, which looked for
            // '<' and then for "<letter", both failed on that notation (126 rows, one of them without the space).
            Assert.DoesNotContain("</", m.Omschrijving, StringComparison.Ordinal);
        });

        Omschrijving(resultaat, "K-9.1.4", "De kleuters kunnen basis hygiëneregels uitvoeren.\n< bv. tanden poetsen en handen wassen >");
        Omschrijving(resultaat, "6-3.7.6", "De leerlingen kunnen basisonderhoud en kleine herstellingen uitvoeren.\n<bv. fietsband plakken, batterij vervangen >");
        // A fraction survives as a fraction (MathML), not as its digits run together.
        Assert.Contains(" 1/10 ", Omschrijving(resultaat, "4-2.1.14"), StringComparison.Ordinal);
        // A link keeps its address, an image its alt text.
        Assert.Contains("(https://", Omschrijving(resultaat, "6-10.6.1"), StringComparison.Ordinal);
        Assert.Contains("[afbeelding: De energiebron]", Omschrijving(resultaat, "6-3.5.1"), StringComparison.Ordinal);
    }

    private static string Omschrijving(MinimumdoelBronResultaat resultaat, string minimumdoelRef, string? verwacht = null)
    {
        var omschrijving = Assert.Single(resultaat.Minimumdoelen, m => m.Ref == minimumdoelRef).Omschrijving;
        if (verwacht is not null)
        {
            Assert.Equal(verwacht, omschrijving);
        }

        return omschrijving;
    }

    [GeneratedRegex(@"^(K|4|6)-\d+(\.\d+)*$")]
    private static partial Regex RefVorm();
}

/// <summary>A fact that runs only when <c>JAARPLANNER_LIVE_OPSTAP</c> is <c>1</c>.</summary>
public sealed class LiveOpstapFactAttribute : FactAttribute
{
    /// <summary>The environment variable that switches the live contract tests on.</summary>
    public const string Variabele = "JAARPLANNER_LIVE_OPSTAP";

    public LiveOpstapFactAttribute()
    {
        if (Environment.GetEnvironmentVariable(Variabele) != "1")
        {
            Skip = $"Calls KOV's live Op.stap API; set {Variabele}=1 to run it.";
        }
    }
}
