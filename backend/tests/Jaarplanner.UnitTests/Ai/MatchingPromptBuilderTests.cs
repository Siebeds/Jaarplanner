using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the prompt of a thema's doelsuggesties (FB-053, ADR-0049, Art. IV.4/IV.5): the candidate minimumdoelen first,
/// then the thema, then the refs not to propose; grounded only on school and Op.stap data; deterministic and
/// snapshot-stable.
/// </summary>
public sealed class MatchingPromptBuilderTests
{
    private const string Nl = "\n";

    private static Thema EenThema()
    {
        var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur en seizoenen");
        thema.StelKernwoordenschatIn(["blad", "boom"]);
        thema.StelRijkeWoordenschatIn(["bladverliezende boom"]);

        var subthema = thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
        subthema.VoegOnderzoeksvraagToe("Welke kleuren zien we?", "Waarom vallen bladeren?");
        subthema.VoegActiviteitToe(
            "Bladeren verzamelen",
            ActiviteitType.Waarneming,
            hoek: "ontdektafel",
            verwachteUitkomsten: "sorteren op kleur");

        return thema;
    }

    // Deliberately out of order, to prove the list is ordered by the builder.
    private static IReadOnlyList<Minimumdoel> Kandidaten() =>
    [
        new Minimumdoel("K-9.1.2", "K-", "9.1.2", "De kleuters kunnen seizoenen onderscheiden.", "Wereldoriëntatie", "Natuur"),
        new Minimumdoel("K-1.1.1", "K-", "1.1.1", "De kleuters kunnen rijm herkennen.", "Nederlands", "Lezen", "Vlot lezen"),
    ];

    [Fact]
    public void Bouwt_de_verwachte_prompt_met_de_lijst_vooraan()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), ["K-9.1.2", "K-1.1.1"]);

        Assert.Equal(MatchingPromptBuilder.SystemPrompt, request.SystemPrompt);

        var verwacht = string.Join(Nl,
        [
            "# Beschikbare minimumdoelen",
            "",
            "## Mijlpaal K-",
            "",
            "### Nederlands > Lezen > Vlot lezen",
            "- K-1.1.1: De kleuters kunnen rijm herkennen.",
            "",
            "### Wereldoriëntatie > Natuur",
            "- K-9.1.2: De kleuters kunnen seizoenen onderscheiden.",
            "",
            "# Thema: Herfst",
            "Duur (weken): 4",
            "Invalshoeken: natuur en seizoenen",
            "Kernwoordenschat: blad, boom",
            "Rijke woordenschat: bladverliezende boom",
            "",
            "## Subthema's",
            "- Subthema: Bladeren (leeftijd K3, duur 2 wk)",
            "  Onderzoeksvraag: Welke kleuren zien we?",
            "  Probleemstelling: Waarom vallen bladeren?",
            "  Activiteiten:",
            "  - Bladeren verzamelen (waarneming)",
            "    Hoek: ontdektafel",
            "    Verwachte uitkomsten: sorteren op kleur",
            "",
            "Niet voorstellen (al themadoel, al voorgesteld of geweigerd): K-1.1.1, K-9.1.2",
        ]) + Nl;

        Assert.Equal(verwacht, request.UserPrompt);
    }

    [Fact]
    public void Begint_met_precies_de_lijst_van_de_promptlijst()
    {
        // The list is the stable prefix a later cache can take over (TB-043): the user prompt starts with it, byte for
        // byte, whatever the thema.
        var lijst = MinimumdoelPromptlijst.Bouw(Kandidaten());

        Assert.StartsWith(lijst, MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), []).UserPrompt, StringComparison.Ordinal);
        Assert.StartsWith(lijst, MatchingPromptBuilder.Bouw(new Thema("Water", 5), Kandidaten(), ["K-1.1.1"]).UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Zonder_uitgesloten_codes_zegt_de_laatste_regel_geen()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), []);

        Assert.EndsWith($"Niet voorstellen: (geen){Nl}", request.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), []);
        var volledig = request.SystemPrompt + Nl + request.UserPrompt;

        foreach (var datum in new[]
        {
            "Herfst", "natuur en seizoenen", "blad", "boom", "bladverliezende boom", "Bladeren",
            "Welke kleuren zien we?", "Waarom vallen bladeren?", "K-1.1.1", "De kleuters kunnen rijm herkennen.",
        })
        {
            Assert.Contains(datum, volledig, StringComparison.Ordinal);
        }

        Assert.Contains("Gebruik geen externe kennis", request.SystemPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("http", volledig, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("leerplandoel", request.UserPrompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Systeemprompt_vraagt_het_parsercontract_en_ten_hoogste_acht_voorstellen()
    {
        var systemPrompt = MatchingPromptBuilder.SystemPrompt;

        Assert.Contains("{\"suggesties\": [{\"code\": \"<code van het minimumdoel>\", \"motivatie\": \"<één zin>\"}]}",
            systemPrompt, StringComparison.Ordinal);
        Assert.Contains("{\"suggesties\": []}", systemPrompt, StringComparison.Ordinal);
        Assert.Contains($"ten hoogste {MatchingPromptBuilder.MaxSuggesties} minimumdoelen", systemPrompt, StringComparison.Ordinal);
        Assert.Contains("motivatie van één zin", systemPrompt, StringComparison.Ordinal);
        Assert.Contains(MinimumdoelPromptlijst.Kop.TrimStart('#', ' '), systemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Is_deterministisch_ongeacht_de_volgorde_van_kandidaten_en_uitgeslotenen()
    {
        var a = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), ["K-9.1.2", "K-1.1.1"]);
        var b = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten().Reverse().ToList(), ["K-1.1.1", "K-9.1.2", "K-1.1.1"]);

        Assert.Equal(a.UserPrompt, b.UserPrompt);
    }

    [Fact]
    public void Een_activiteit_zonder_soort_krijgt_geen_haakjes()
    {
        var thema = new Thema("Water", duurWeken: 4);
        thema.VoegSubthemaToe("Drijven", duurWeken: 2, leeftijd: "K3").VoegActiviteitToe("Bootjes", activiteitType: null);

        var request = MatchingPromptBuilder.Bouw(thema, Kandidaten(), []);

        Assert.Contains($"  - Bootjes{Nl}", request.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("Bootjes (", request.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Verwerpt_null_argumenten()
    {
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(null!, Kandidaten(), []));
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(EenThema(), null!, []));
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), null!));
    }
}
