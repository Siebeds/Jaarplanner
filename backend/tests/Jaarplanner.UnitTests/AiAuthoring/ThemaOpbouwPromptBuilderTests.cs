using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.AiAuthoring;

/// <summary>
/// Pins the E2-07 authoring prompt builder (Art. IV.4, IV.8): the step 2 (themadoel, minimumdoelen since FB-053)
/// and step 6 (subdoel) prompts are grounded <b>only</b> on the wizard's transient context + the loaded Op.stap
/// goals, are deterministic, and are snapshot-stable. The two snapshot tests are the "Done when"
/// evidence that the wizard can build a grounded request for each hook.
/// </summary>
public sealed class ThemaOpbouwPromptBuilderTests
{
    private const string Nl = "\n";

    private static ThemaOpbouwContext EenThema(IReadOnlyCollection<string>? gekozen = null) => new()
    {
        Naam = "Water",
        DuurWeken = 5,
        Invalshoeken = "natuur en techniek",
        Kernwoordenschat = ["nat", "droog"],
        RijkeWoordenschat = ["waterkringloop"],
        GekozenThemadoelCodes = gekozen,
    };

    private static SubthemaOpbouwContext EenSubthema() => new()
    {
        Naam = "Water in de klas",
        Leeftijd = "3K",
        DuurWeken = 2,
        Probleemstelling = "Waar komt regen vandaan?",
        Onderzoeksvraag = "Hoe stroomt water?",
        Activiteiten =
        [
            new ActiviteitOpbouwContext
            {
                Naam = "Gieten en meten",
                Type = "waarneming",
                Hoek = "watertafel",
                VerwachteUitkomsten = "vergelijkt hoeveelheden",
            },
        ],
    };

    // Deliberately passed in reverse code order to prove the builder orders by the stable code.
    private static IReadOnlyList<Leerplandoel> EenLeerdoelenSet() =>
    [
        new Leerplandoel(
            code: "WAT-K3-02",
            doelsoort: Doelsoort.Gemeenschappelijk,
            jaarFase: "K3",
            domein: "Wereldoriëntatie",
            subdomein: "Natuur",
            disciplineNummer: "9",
            tekst: "De kleuter benoemt nat en droog.",
            woordenschat: "nat, droog"),
        new Leerplandoel(
            code: "WAT-K3-01",
            doelsoort: Doelsoort.Minimumdoel,
            jaarFase: "K3",
            domein: "Wereldoriëntatie",
            subdomein: "Natuur",
            disciplineNummer: "9",
            tekst: "De kleuter onderzoekt water.",
            minimumdoelRef: "K-20"),
    ];

    // Deliberately out of ref order, to prove the list orders them.
    private static IReadOnlyList<Minimumdoel> EenMinimumdoelenSet() =>
    [
        new Minimumdoel("K-9.2.1", "K-", "9.2.1", "De kleuters onderzoeken water.", "Wereldoriëntatie", "Natuur"),
        new Minimumdoel("K-9.1.1", "K-", "9.1.1", "De kleuters benoemen nat en droog.", "Wereldoriëntatie", "Natuur"),
    ];

    // The stable part of step 6 (TB-043): the leerplandoel list alone, the same for every thema over these candidates.
    private static readonly string VerwachteDoelenlijst = string.Join(Nl,
    [
        "# Beschikbare Op.stap-leerplandoelen",
        "",
        "Voor alle doelen hieronder: jaarfase K3.",
        "",
        "## Wereldoriëntatie > Natuur",
        "- WAT-K3-01 (MD): De kleuter onderzoekt water.",
        "- WAT-K3-02 (G): De kleuter benoemt nat en droog.",
    ]) + Nl;

    [Fact]
    public void Stap2_bouwt_de_verwachte_minimumdoelprompt()
    {
        // FB-053: step 2 proposes minimumdoelen. The list is the stable part (TB-043); the thema and the refs already
        // chosen are the user prompt.
        var request = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(EenThema(gekozen: ["K-9.1.1"]), EenMinimumdoelenSet());

        Assert.Equal(ThemaOpbouwPromptBuilder.SystemPromptThemadoelen, request.SystemPrompt);

        var vast = string.Join(Nl,
        [
            "# Beschikbare minimumdoelen",
            "",
            "## Mijlpaal K-",
            "",
            "### Wereldoriëntatie > Natuur",
            "- K-9.1.1: De kleuters benoemen nat en droog.",
            "- K-9.2.1: De kleuters onderzoeken water.",
        ]) + Nl;
        Assert.Equal(vast, request.VasteContext);

        var verwacht = string.Join(Nl,
        [
            "# Thema (in opbouw)",
            "",
            "## Thema: Water",
            "Duur (weken): 5",
            "Invalshoeken: natuur en techniek",
            "Kernwoordenschat: nat, droog",
            "Rijke woordenschat: waterkringloop",
            "",
            "# Niet voorstellen",
            "",
            "Al gekozen: K-9.1.1",
        ]) + Nl;

        Assert.Equal(verwacht, request.UserPrompt);
        Assert.DoesNotContain("leerplandoel", request.VasteContext + request.UserPrompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Stap2_zonder_gekozen_themadoelen_sluit_niets_uit()
    {
        var request = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(EenThema(), EenMinimumdoelenSet());

        Assert.DoesNotContain("Niet voorstellen", request.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Stap6_bouwt_de_verwachte_grounded_subdoel_prompt()
    {
        // FB-053: the chosen themadoelen are minimumdoelen, written with their text; one no loaded minimumdoel
        // carries keeps its bare ref.
        var request = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(
            EenThema(gekozen: ["K-9.2.1", "K-0.0.0"]), EenSubthema(), EenLeerdoelenSet(), EenMinimumdoelenSet());

        Assert.Equal(ThemaOpbouwPromptBuilder.SystemPromptSubdoelen, request.SystemPrompt);
        Assert.Equal(VerwachteDoelenlijst, request.VasteContext);

        var verwacht = string.Join(Nl,
        [
            "# Thema (in opbouw)",
            "",
            "## Thema: Water",
            "Duur (weken): 5",
            "Invalshoeken: natuur en techniek",
            "Kernwoordenschat: nat, droog",
            "Rijke woordenschat: waterkringloop",
            "Themadoelen (minimumdoelen):",
            "- K-0.0.0",
            "- K-9.2.1: De kleuters onderzoeken water.",
            "",
            "# Subthema (in opbouw)",
            "",
            "## Subthema: Water in de klas (leeftijd 3K)",
            "Duur (weken): 2",
            "Onderzoeksvraag: Hoe stroomt water?",
            "Probleemstelling: Waar komt regen vandaan?",
            "Activiteiten:",
            "- Gieten en meten (waarneming)",
            "  Hoek: watertafel",
            "  Verwachte uitkomsten: vergelijkt hoeveelheden",
        ]) + Nl;

        Assert.Equal(verwacht, request.UserPrompt);
    }

    [Fact]
    public void Het_vaste_deel_hangt_niet_af_van_het_thema_of_het_subthema()
    {
        // TB-043: step 6 over the same leerplandoelen, step 2 over the same minimumdoelen, whatever the thema.
        var andereThema = new ThemaOpbouwContext { Naam = "Vuur", GekozenThemadoelCodes = ["K-9.1.1"] };
        var anderSubthema = new SubthemaOpbouwContext { Naam = "Kampvuur", Leeftijd = "K3" };

        var a = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(EenThema(), EenSubthema(), EenLeerdoelenSet());
        var b = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(andereThema, anderSubthema, EenLeerdoelenSet(), EenMinimumdoelenSet());
        Assert.Equal(a.SystemPrompt + a.VasteContext, b.SystemPrompt + b.VasteContext);
        Assert.DoesNotContain("Water", a.SystemPrompt + a.VasteContext, StringComparison.Ordinal);
        Assert.DoesNotContain("Vuur", b.SystemPrompt + b.VasteContext, StringComparison.Ordinal);
        Assert.StartsWith("# Thema (in opbouw)", b.UserPrompt, StringComparison.Ordinal);

        var c = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(EenThema(), EenMinimumdoelenSet());
        var d = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(andereThema, EenMinimumdoelenSet().Reverse().ToList());
        Assert.Equal(c.SystemPrompt + c.VasteContext, d.SystemPrompt + d.VasteContext);
        Assert.DoesNotContain("K-9.1.1", d.UserPrompt.Replace("Al gekozen: K-9.1.1", string.Empty), StringComparison.Ordinal);
    }

    [Fact]
    public void Is_deterministisch_ongeacht_leerdoelvolgorde()
    {
        var leerdoelen = EenLeerdoelenSet();
        var omgekeerd = leerdoelen.Reverse().ToList();

        var a = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(EenThema(gekozen: ["K-9.2.1", "K-9.1.1"]), EenSubthema(), leerdoelen, EenMinimumdoelenSet());
        var b = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(EenThema(gekozen: ["K-9.1.1", "K-9.2.1"]), EenSubthema(), omgekeerd, EenMinimumdoelenSet().Reverse().ToList());
        Assert.Equal(a.VasteContext, b.VasteContext);
        Assert.Equal(a.UserPrompt, b.UserPrompt);

        var c = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(EenThema(), EenMinimumdoelenSet());
        var d = ThemaOpbouwPromptBuilder.BouwThemadoelRequest(EenThema(), EenMinimumdoelenSet().Reverse().ToList());
        Assert.Equal(c.VasteContext, d.VasteContext);
        Assert.Equal(c.UserPrompt, d.UserPrompt);
    }

    [Fact]
    public void Systeemprompts_vragen_exact_het_parser_contract_en_verbieden_externe_bronnen()
    {
        foreach (var (systemPrompt, soort) in new[]
        {
            (ThemaOpbouwPromptBuilder.SystemPromptThemadoelen, "code van het minimumdoel"),
            (ThemaOpbouwPromptBuilder.SystemPromptSubdoelen, "leerplandoelcode"),
        })
        {
            // Reuses the E2-03 parser contract: the exact `suggesties` envelope + field names.
            Assert.Contains($"{{\"suggesties\": [{{\"code\": \"<{soort}>\", \"motivatie\": \"<één zin>\"}}]}}",
                systemPrompt, StringComparison.Ordinal);
            Assert.Contains("{\"suggesties\": []}", systemPrompt, StringComparison.Ordinal);
            // Grounding: external sources are explicitly ruled out (Art. IV.4).
            Assert.Contains("Gebruik geen externe kennis", systemPrompt, StringComparison.Ordinal);
            // The list is its own part of the request now (TB-043), not a section below the rules.
            Assert.DoesNotContain("hieronder", systemPrompt, StringComparison.Ordinal);
            Assert.DoesNotContain("in dit bericht", systemPrompt, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Systeemprompts_begrenzen_het_aantal_suggesties_het_best_passende_eerst()
    {
        Assert.Contains(ThemaOpbouwPromptBuilder.MaxSuggestiesRegel, ThemaOpbouwPromptBuilder.SystemPromptSubdoelen, StringComparison.Ordinal);
        Assert.Contains(ThemaOpbouwPromptBuilder.MaxMinimumdoelenRegel, ThemaOpbouwPromptBuilder.SystemPromptThemadoelen, StringComparison.Ordinal);
        Assert.Contains("\"Niet voorstellen\"", ThemaOpbouwPromptBuilder.SystemPromptThemadoelen, StringComparison.Ordinal);
        foreach (var regel in new[] { ThemaOpbouwPromptBuilder.MaxSuggestiesRegel, ThemaOpbouwPromptBuilder.MaxMinimumdoelenRegel })
        {
            Assert.Contains($"hoogstens {ThemaOpbouwPromptBuilder.MaxSuggesties} ", regel, StringComparison.Ordinal);
            Assert.Contains("het best passende eerst", regel, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Verwerpt_null_argumenten()
    {
        Assert.Throws<ArgumentNullException>(
            () => ThemaOpbouwPromptBuilder.BouwThemadoelRequest(null!, EenMinimumdoelenSet()));
        Assert.Throws<ArgumentNullException>(
            () => ThemaOpbouwPromptBuilder.BouwThemadoelRequest(EenThema(), null!));
        Assert.Throws<ArgumentNullException>(
            () => ThemaOpbouwPromptBuilder.BouwSubdoelRequest(EenThema(), null!, EenLeerdoelenSet()));
    }
}
