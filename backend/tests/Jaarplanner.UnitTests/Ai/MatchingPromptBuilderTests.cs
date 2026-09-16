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
    private const string LeerplandoelKop = "# Beschikbare Op.stap-leerplandoelen";

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

        // The stable part (TB-043): the Op.stap goals only, grouped under domein > subdomein, with the doelsoort per goal
        // because the two differ and the jaarfase once because they share it.
        var vast = string.Join(Nl,
        [
            "# Beschikbare Op.stap-leerplandoelen",
            "",
            "Voor alle doelen hieronder: jaarfase K3.",
            "",
            "## Natuur > Levende natuur",
            "- NAT-K3-01 (MD): De kleuter herkent bomen.",
            "- NAT-K3-02 (G): De kleuter observeert veranderingen in de natuur.",
            "",
            "# Minimumdoelen (concordantie)",
            "",
            "- K-12: De leerling herkent levende wezens.",
        ]) + Nl;

        Assert.Equal(vast, request.VasteContext);

        // The volatile part: the thema, then the codes it already links.
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
            "# Niet voorstellen",
            "",
            "Al gekoppeld of geweigerd: NAT-K3-01",
        ]) + Nl;

        Assert.Equal(verwacht, request.UserPrompt);
    }

    [Fact]
    public void Twee_themas_van_dezelfde_leeftijd_delen_het_vaste_deel_en_de_schoolcontent_staat_erna()
    {
        // TB-043: a provider's cache only matches an identical beginning. Two different thema's, with subthema's of the
        // same leeftijd and so the same candidates, must send the same system prompt and goal list byte for byte.
        var herfst = EenThema();
        var water = new Thema("Water", duurWeken: 6, invalshoeken: "drijven en zinken");
        water.VoegSubthemaToe("Plassen", duurWeken: 2, leeftijd: "K3").VoegActiviteitToe("Bootjes", ActiviteitType.Waarneming);
        water.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "past"));

        var a = MatchingPromptBuilder.Bouw(herfst, EenLeerdoelenSet());
        var b = MatchingPromptBuilder.Bouw(water, EenLeerdoelenSet().Reverse().ToList());

        Assert.Equal(a.SystemPrompt, b.SystemPrompt);
        Assert.Equal(a.VasteContext, b.VasteContext);
        Assert.NotEqual(a.UserPrompt, b.UserPrompt);

        // No school content in the stable part, all of it in the volatile part.
        var gevallen = new[]
        {
            (Request: a, Schooldata: new[] { "Herfst", "natuur en seizoenen", "Bladeren", "ontdektafel", "# Schoolcontent" }),
            (Request: b, Schooldata: new[] { "Water", "drijven en zinken", "Plassen", "Bootjes", "Al gekoppeld of geweigerd: NAT-K3-02" }),
        };
        foreach (var (request, schooldata) in gevallen)
        {
            foreach (var datum in schooldata)
            {
                Assert.DoesNotContain(datum, request.SystemPrompt + request.VasteContext, StringComparison.Ordinal);
                Assert.Contains(datum, request.UserPrompt, StringComparison.Ordinal);
            }

            Assert.StartsWith("# Schoolcontent", request.UserPrompt, StringComparison.Ordinal);
            Assert.DoesNotContain(LeerplandoelKop, request.UserPrompt, StringComparison.Ordinal);
            Assert.StartsWith(LeerplandoelKop, request.VasteContext, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Gekoppelde_en_geweigerde_doelen_staan_als_niet_voorstellen_in_het_variabele_deel()
    {
        // TB-043: the codes a thema already links or rejected are named in the volatile part; the goal list stays the
        // same list every thema of this leeftijd gets.
        var thema = new Thema("Herfst", duurWeken: 4);
        thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
        var geweigerd = thema.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "past"));
        geweigerd.WijzigStatus(KoppelingStatus.Geweigerd);
        var aanvaard = thema.VoegDoelsuggestieToe(new DoelKoppeling("REK-K3-09", KoppelingStatus.Voorgesteld, "past"));
        aanvaard.WijzigStatus(KoppelingStatus.Aanvaard);
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Manueel, null));

        var zonder = MatchingPromptBuilder.Bouw(new Thema("Leeg", duurWeken: 4), EenLeerdoelenSet());
        var met = MatchingPromptBuilder.Bouw(thema, EenLeerdoelenSet());

        Assert.EndsWith(
            $"# Niet voorstellen{Nl}{Nl}Al gekoppeld of geweigerd: NAT-K3-01, NAT-K3-02, REK-K3-09{Nl}",
            met.UserPrompt,
            StringComparison.Ordinal);
        Assert.Equal(zonder.VasteContext, met.VasteContext);
        Assert.Contains("- NAT-K3-01 (MD): ", met.VasteContext, StringComparison.Ordinal);
        Assert.Contains("- NAT-K3-02 (G): ", met.VasteContext, StringComparison.Ordinal);

        // A thema that links nothing gets no such section, and the system prompt tells the model what the section means.
        Assert.DoesNotContain(MatchingPromptBuilder.NietVoorstellenKop, zonder.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("\"Niet voorstellen\"", MatchingPromptBuilder.SystemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Systeemprompt_begrenst_het_aantal_suggesties_en_de_motivatie()
    {
        Assert.Contains(MatchingPromptBuilder.MaxSuggestiesRegel, MatchingPromptBuilder.SystemPrompt, StringComparison.Ordinal);
        Assert.Contains(
            $"hoogstens {MatchingPromptBuilder.MaxSuggesties} ", MatchingPromptBuilder.MaxSuggestiesRegel, StringComparison.Ordinal);
        Assert.Contains("één korte zin", MatchingPromptBuilder.SystemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Verschillende_doelsoorten_en_jaarfasen_staan_per_doel()
    {
        IReadOnlyList<Leerplandoel> gemengd =
        [
            new Leerplandoel("REK-L1-01", Doelsoort.Gemeenschappelijk, "L1", "Wiskunde", "Getallen", "2", tekst: "telt tot 20."),
            new Leerplandoel("NAT-K3-03", Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "ziet seizoenen."),
            new Leerplandoel("NAT-K3-01", Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."),
        ];

        var vast = MatchingPromptBuilder.Bouw(EenThema(), gemengd).VasteContext;

        Assert.Equal(
            string.Join(Nl,
            [
                "# Beschikbare Op.stap-leerplandoelen",
                "",
                "## Natuur > Levende natuur",
                "- NAT-K3-01 (MD, K3): herkent bomen.",
                "- NAT-K3-03 (MD, K3): ziet seizoenen.",
                "",
                "## Wiskunde > Getallen",
                "- REK-L1-01 (G, L1): telt tot 20.",
            ]) + Nl,
            vast);
    }

    [Fact]
    public void Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), EenLeerdoelenSet(), EenMinimumdoelenSet());
        var volledig = request.SystemPrompt + Nl + request.VasteContext + request.UserPrompt;

        // Positive: every supplied datum appears.
        foreach (var datum in new[]
        {
            "Herfst", "natuur en seizoenen", "blad", "boom", "bladverliezende boom",
            "Bladeren", "Welke kleuren zien we?", "Waarom vallen bladeren?", "ontdektafel",
            "sorteren op kleur", "NAT-K3-01", "NAT-K3-02", "De kleuter herkent bomen.",
            "K-12", "De leerling herkent levende wezens.",
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
    public void Doelen_staan_compact_in_de_prompt()
    {
        // TB-007: code, doelsoort, jaar/fase, domein, subdomein and text only. The long fields made the K3 goals of the
        // Op.stap import alone about 54,000 tokens.
        var request = MatchingPromptBuilder.Bouw(EenThema(), EenLeerdoelenSet());

        foreach (var weggelaten in new[] { "Voorbeelden:", "eik, beuk", "Toelichting:", "  Woordenschat:", "  Minimumdoel:", "> Planten" })
        {
            Assert.DoesNotContain(weggelaten, request.VasteContext + request.UserPrompt, StringComparison.Ordinal);
        }
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

        Assert.Equal(a.VasteContext, b.VasteContext);
        Assert.Equal(a.UserPrompt, b.UserPrompt);
    }

    [Fact]
    public void Minimumdoelen_sectie_ontbreekt_wanneer_geen_minimumdoelen_meegegeven()
    {
        var request = MatchingPromptBuilder.Bouw(EenThema(), EenLeerdoelenSet());

        Assert.DoesNotContain("# Minimumdoelen", request.VasteContext + request.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_activiteit_zonder_soort_krijgt_geen_haakjes()
    {
        var thema = new Thema("Water", duurWeken: 4);
        thema.VoegSubthemaToe("Drijven", duurWeken: 2, leeftijd: "K3").VoegActiviteitToe("Bootjes", activiteitType: null);

        var request = MatchingPromptBuilder.Bouw(thema, EenLeerdoelenSet());

        Assert.Contains($"  - Bootjes{Nl}", request.UserPrompt + Nl, StringComparison.Ordinal);
        Assert.DoesNotContain("Bootjes (", request.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Verwerpt_null_argumenten()
    {
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(null!, EenLeerdoelenSet()));
        Assert.Throws<ArgumentNullException>(() => MatchingPromptBuilder.Bouw(EenThema(), null!));
    }
}
