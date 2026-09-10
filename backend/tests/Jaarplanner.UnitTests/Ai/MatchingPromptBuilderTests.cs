using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the E2-02 prompt builder (Art. IV.4): the built prompt is grounded <b>only</b> on the
/// school's own content and the loaded Op.stap goals, is deterministic, and is snapshot-stable.
/// The <see cref="Bouwt_de_verwachte_grounded_prompt"/> snapshot is the "Done when" evidence.
/// </summary>
public sealed class MatchingPromptBuilderTests
{
    private const string Nl = "\n";

    // A representative thema with school-wide attributes, one themadoel anchor, one subthema with a
    // driving question and one activiteit. All values below are the ONLY school data the prompt may
    // contain — nothing else.
    private static Thema EenThema()
    {
        var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur en seizoenen");
        thema.StelKernwoordenschatIn(["blad", "boom"]);
        thema.StelRijkeWoordenschatIn(["bladverliezende boom"]);
        thema.VoegThemadoelToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "past bij natuurobservatie"));

        var subthema = thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
        subthema.VoegOnderzoeksvraagToe("Welke kleuren zien we?", "Waarom vallen bladeren?");
        subthema.VoegActiviteitToe(
            "Bladeren verzamelen",
            ActiviteitType.Waarneming,
            hoek: "ontdektafel",
            verwachteUitkomsten: "sorteren op kleur");

        return thema;
    }

    // Deliberately passed in reverse code order to prove the builder orders by the stable code.
    private static IReadOnlyList<Leerplandoel> EenLeerdoelenSet() =>
    [
        new Leerplandoel(
            code: "NAT-K3-02",
            doelsoort: Doelsoort.Gemeenschappelijk,
            jaarFase: "K3",
            domein: "Natuur",
            subdomein: "Levende natuur",
            disciplineNummer: "9",
            tekst: "De kleuter observeert veranderingen in de natuur.",
            woordenschat: "seizoen"),
        new Leerplandoel(
            code: "NAT-K3-01",
            doelsoort: Doelsoort.Minimumdoel,
            jaarFase: "K3",
            domein: "Natuur",
            subdomein: "Levende natuur",
            disciplineNummer: "9",
            cluster: "Planten",
            tekst: "De kleuter herkent bomen.",
            voorbeelden: "eik, beuk",
            toelichting: "focus op waarneembare kenmerken",
            minimumdoelRef: "K-12"),
    ];

    private static IReadOnlyList<Minimumdoel> EenMinimumdoelenSet() =>
    [
        new Minimumdoel("K-12", "K-", "12", "De leerling herkent levende wezens."),
    ];

    [Fact]
    public void Bouwt_de_verwachte_grounded_prompt()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), EenLeerdoelenSet(), EenMinimumdoelenSet());

        // The system prompt is the fixed instruction scaffolding — it forbids external sources
        // (Art. IV.4) and asks for structured JSON (Art. IV.5). Snapshot it via the public constant.
        Assert.Equal(MatchingPromptBuilder.SystemPrompt, request.SystemPrompt);

        var verwacht = string.Join(Nl,
        [
            "# Schoolcontent",
            "",
            "## Thema: Herfst",
            "Duur (weken): 4",
            "Invalshoeken: natuur en seizoenen",
            "Kernwoordenschat: blad, boom",
            "Rijke woordenschat: bladverliezende boom",
            "",
            "### Themadoelen (reeds gekoppelde leerplandoelen)",
            "- NAT-K3-01 (status Voorgesteld) — past bij natuurobservatie",
            "",
            "### Subthema's",
            "- Subthema: Bladeren (leeftijd K3, duur 2 wk)",
            "  Onderzoeksvraag: Welke kleuren zien we?",
            "  Probleemstelling: Waarom vallen bladeren?",
            "  Activiteiten:",
            "  - Bladeren verzamelen (waarneming)",
            "    Hoek: ontdektafel",
            "    Verwachte uitkomsten: sorteren op kleur",
            "",
            "# Beschikbare Op.stap-leerplandoelen",
            "",
            "- NAT-K3-01 | MD | K3 | Natuur > Levende natuur > Planten",
            "  Tekst: De kleuter herkent bomen.",
            "  Voorbeelden: eik, beuk",
            "  Toelichting: focus op waarneembare kenmerken",
            "  Minimumdoel: K-12",
            "- NAT-K3-02 | G | K3 | Natuur > Levende natuur",
            "  Tekst: De kleuter observeert veranderingen in de natuur.",
            "  Woordenschat: seizoen",
            "",
            "# Minimumdoelen (concordantie)",
            "",
            "- K-12: De leerling herkent levende wezens.",
        ]) + Nl;

        Assert.Equal(verwacht, request.UserPrompt);
    }

    [Fact]
    public void Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), EenLeerdoelenSet(), EenMinimumdoelenSet());
        var volledig = request.SystemPrompt + Nl + request.UserPrompt;

        // Positive: every supplied datum appears.
        foreach (var datum in new[]
        {
            "Herfst", "natuur en seizoenen", "blad", "boom", "bladverliezende boom",
            "Bladeren", "Welke kleuren zien we?", "Waarom vallen bladeren?", "ontdektafel",
            "sorteren op kleur", "NAT-K3-01", "NAT-K3-02", "De kleuter herkent bomen.",
            "eik, beuk", "K-12", "De leerling herkent levende wezens.",
        })
        {
            Assert.Contains(datum, volledig, StringComparison.Ordinal);
        }

        // Negative: no external/extra content leaks in. The user prompt must be byte-for-byte the
        // data-only render, and the whole request must not mention any source outside school +
        // Op.stap data. The system prompt explicitly rules external sources out.
        Assert.Contains("Gebruik geen externe kennis", request.SystemPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("http", volledig, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("wikipedia", volledig, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("internet als bron", volledig, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Systeemprompt_vraagt_exact_het_parser_contract()
    {
        // E2-04 alignment: the system prompt must instruct the EXACT JSON shape the E2-03 parser
        // accepts — the `suggesties` envelope with load-bearing field names `code`/`motivatie`
        // (Art. IV.5). The parser is the canonical contract; the prompt is made to match it.
        var systemPrompt = MatchingPromptBuilder.SystemPrompt;

        Assert.Contains("{\"suggesties\": [{\"code\": \"<leerplandoelcode>\", \"motivatie\": \"<één zin>\"}]}",
            systemPrompt, StringComparison.Ordinal);
        Assert.Contains("\"suggesties\"", systemPrompt, StringComparison.Ordinal);
        Assert.Contains("\"code\"", systemPrompt, StringComparison.Ordinal);
        Assert.Contains("\"motivatie\"", systemPrompt, StringComparison.Ordinal);
        Assert.Contains("{\"suggesties\": []}", systemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Is_deterministisch_ongeacht_leerdoelvolgorde()
    {
        var leerdoelen = EenLeerdoelenSet();
        var omgekeerd = leerdoelen.Reverse().ToList();

        var a = MatchingPromptBuilder.Bouw(EenThema(), leerdoelen, EenMinimumdoelenSet());
        var b = MatchingPromptBuilder.Bouw(EenThema(), omgekeerd, EenMinimumdoelenSet());

        Assert.Equal(a.UserPrompt, b.UserPrompt);
    }

    [Fact]
    public void Minimumdoelen_sectie_ontbreekt_wanneer_geen_minimumdoelen_meegegeven()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), EenLeerdoelenSet());

        Assert.DoesNotContain("# Minimumdoelen", request.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Verwerpt_null_argumenten()
    {
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(null!, EenLeerdoelenSet()));
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(EenThema(), null!));
    }
}
