using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the prompt of a thema's doelsuggesties (FB-053, ADR-0052, Art. IV.4/IV.5): the candidate minimumdoelen as the
/// stable context (TB-043), the thema and the refs not to propose as the user prompt; grounded only on school and
/// Op.stap data; deterministic and snapshot-stable.
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
    public void Bouwt_de_verwachte_prompt_met_de_lijst_als_vast_deel()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), ["K-9.1.2", "K-1.1.1"]);

        Assert.Equal(MatchingPromptBuilder.SystemPrompt, request.SystemPrompt);

        var vast = string.Join(Nl,
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
        ]) + Nl;
        Assert.Equal(vast, request.VasteContext);
        Assert.Equal(MinimumdoelPromptlijst.Bouw(Kandidaten()), request.VasteContext);

        var verwacht = string.Join(Nl,
        [
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
            "# Niet voorstellen",
            "",
            "Al themadoel, al voorgesteld of geweigerd: K-1.1.1, K-9.1.2",
        ]) + Nl;

        Assert.Equal(verwacht, request.UserPrompt);
    }

    [Fact]
    public void Twee_themas_met_dezelfde_kandidaten_delen_het_vaste_deel_en_de_schoolcontent_staat_erna()
    {
        // TB-043: a provider's cache only matches an identical beginning. Two thema's with the same candidates (the same
        // mijlpalen) send the same system prompt and list byte for byte, whatever they exclude.
        var herfst = EenThema();
        var water = new Thema("Water", duurWeken: 6, invalshoeken: "drijven en zinken");
        water.VoegSubthemaToe("Plassen", duurWeken: 2, leeftijd: "K2").VoegActiviteitToe("Bootjes", ActiviteitType.Waarneming);

        var a = MatchingPromptBuilder.Bouw(herfst, Kandidaten(), []);
        var b = MatchingPromptBuilder.Bouw(water, Kandidaten().Reverse().ToList(), ["K-1.1.1"]);

        Assert.Equal(a.SystemPrompt, b.SystemPrompt);
        Assert.Equal(a.VasteContext, b.VasteContext);
        Assert.NotEqual(a.UserPrompt, b.UserPrompt);

        var gevallen = new[]
        {
            (Request: a, Schooldata: new[] { "Herfst", "natuur en seizoenen", "Bladeren", "ontdektafel" }),
            (Request: b, Schooldata: new[] { "Water", "drijven en zinken", "Plassen", "Bootjes", "Al themadoel, al voorgesteld of geweigerd: K-1.1.1" }),
        };
        foreach (var (request, schooldata) in gevallen)
        {
            foreach (var datum in schooldata)
            {
                Assert.DoesNotContain(datum, request.SystemPrompt + request.VasteContext, StringComparison.Ordinal);
                Assert.Contains(datum, request.UserPrompt, StringComparison.Ordinal);
            }

            Assert.StartsWith("# Thema: ", request.UserPrompt, StringComparison.Ordinal);
            Assert.DoesNotContain(MinimumdoelPromptlijst.Kop, request.UserPrompt, StringComparison.Ordinal);
            Assert.StartsWith(MinimumdoelPromptlijst.Kop, request.VasteContext, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Zonder_uit_te_sluiten_codes_is_er_geen_sectie_niet_voorstellen()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), []);

        Assert.DoesNotContain(MatchingPromptBuilder.NietVoorstellenKop, request.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("\"Niet voorstellen\"", MatchingPromptBuilder.SystemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), []);
        var volledig = request.SystemPrompt + Nl + request.VasteContext + request.UserPrompt;

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
        Assert.DoesNotContain("leerplandoel", request.VasteContext + request.UserPrompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Systeemprompt_vraagt_het_parsercontract_en_ten_hoogste_acht_voorstellen_het_best_passende_eerst()
    {
        var systemPrompt = MatchingPromptBuilder.SystemPrompt;

        Assert.Contains("{\"suggesties\": [{\"code\": \"<code van het minimumdoel>\", \"motivatie\": \"<één zin>\"}]}",
            systemPrompt, StringComparison.Ordinal);
        Assert.Contains("{\"suggesties\": []}", systemPrompt, StringComparison.Ordinal);
        Assert.Contains(MatchingPromptBuilder.MaxSuggestiesRegel, systemPrompt, StringComparison.Ordinal);
        Assert.Contains($"hoogstens {MatchingPromptBuilder.MaxSuggesties} minimumdoelen", MatchingPromptBuilder.MaxSuggestiesRegel, StringComparison.Ordinal);
        Assert.Contains("het best passende eerst", MatchingPromptBuilder.MaxSuggestiesRegel, StringComparison.Ordinal);
        Assert.Contains("één korte zin", systemPrompt, StringComparison.Ordinal);
        Assert.Contains("\"Beschikbare minimumdoelen\"", systemPrompt, StringComparison.Ordinal);

        // The list is no longer below the rules in one message (TB-043), so the prompt does not point at it as such.
        Assert.DoesNotContain("hieronder", systemPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("in dit bericht", systemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Is_deterministisch_ongeacht_de_volgorde_van_kandidaten_en_uitgeslotenen()
    {
        var a = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten(), ["K-9.1.2", "K-1.1.1"]);
        var b = MatchingPromptBuilder.Bouw(EenThema(), Kandidaten().Reverse().ToList(), ["K-1.1.1", "K-9.1.2", "K-1.1.1"]);

        Assert.Equal(a.VasteContext, b.VasteContext);
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
