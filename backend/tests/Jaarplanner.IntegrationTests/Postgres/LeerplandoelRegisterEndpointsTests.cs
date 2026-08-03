using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Drives the Doelen register (E1-16) end-to-end against real PostgreSQL: search, the filters, paging at
/// volume, the facets, one doel in full, and the refusals.
/// <para>
/// <b>These tests cannot live on the EF in-memory provider, and that is the whole reason for this file.</b>
/// The register's search is <c>ILIKE</c>, which the in-memory provider does not implement; it also enforces
/// no collation and no ordering, so "ordering is stable across pages" and "a case-variant term finds the row"
/// are both unobservable there. A green in-memory suite would have said nothing about any of it.
/// </para>
/// <para>
/// The seed is deliberately awkward: a <b>subdomein name repeated under two domeinen</b> (Art. VII.0 —
/// subdomein names are not globally unique), a goal with a <b>null cluster</b>, a goal with <b>every optional
/// field empty</b>, a goal concorded to a decreed minimumdoel that <i>is</i> loaded, a goal flagged
/// <c>NietMeerInOpstap</c>, a code containing a LIKE metacharacter, and one thema exercising all four link
/// layers of Art. IX.2 in four different statuses.
/// </para>
/// </summary>
public sealed class LeerplandoelRegisterEndpointsTests : IAsyncLifetime
{
    /// <summary>
    /// How many bulk rows the volume test browses. Chosen to be well past any page size so "the page is
    /// capped" and "the total is the whole match" cannot both be satisfied by accident, and past the point
    /// where an accidental client-side filter would be visible as a timeout rather than as a wrong number.
    /// </summary>
    private const int VolumeAantal = 2_500;

    private const string DisciplineNederlands = "1";
    private const string DisciplineWiskunde = "2";

    /// <summary>
    /// Discipline numbers whose ordering an ordinal sort gets wrong. "10" sorts before "2" ordinally, and
    /// "9.1"/"9.2" are the Art. VII.0 nested split, so seeding all four makes the ordering test real rather
    /// than theoretical.
    /// </summary>
    private const string DisciplineFrans = "10";
    private const string DisciplineLevensstijl = "9.1";
    private const string DisciplineLerenLeren = "9.2";

    /// <summary>The klas that owns the seeded class/age-scoped school content (Art. IX.2).</summary>
    private const string KlasNaam = "K3 doelenregister";

    /// <summary>
    /// Mirrors the API's own serialisation (Program.cs adds a <see cref="JsonStringEnumConverter"/>), so the
    /// enums travel as names and the tests read the same wire form the frontend does. Deserialising into the
    /// real Application records rather than into hand-written string DTOs is deliberate: it means a rename or
    /// a reordered constructor parameter breaks the test instead of silently changing the contract.
    /// </summary>
    private static readonly JsonSerializerOptions JsonOpties = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("doelenregister");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await ZaaiCurriculumAsync();
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    // ── clause 1: a paginated list at real volume ────────────────────────────────────────────────────

    /// <summary>
    /// The register pages in the database at real volume: a page is capped at the requested size, the total
    /// reports the whole match, and the order is identical across page boundaries with no row repeated or
    /// skipped. Proven by walking every page of ~2 500 goals and comparing the concatenation against one
    /// long list, which is what an unstable sort would break.
    /// </summary>
    [PostgresFact]
    public async Task Register_pageert_in_de_database_op_echt_volume()
    {
        var client = _factory.CreateClient();

        var eerste = await Haal(client, "/api/leerplandoelen?aantal=50");
        Assert.Equal(50, eerste.Regels.Count);
        Assert.Equal(50, eerste.Aantal);
        Assert.Equal(0, eerste.Overslaan);

        var totaalInDb = await AantalInDatabaseAsync();
        Assert.Equal(totaalInDb, eerste.Totaal);
        Assert.True(eerste.Totaal > VolumeAantal, $"expected more than {VolumeAantal} goals, got {eerste.Totaal}");

        // Walk every page and rebuild the whole ordered set from the pages alone.
        var uitPaginas = new List<string>();
        for (var overslaan = 0; overslaan < eerste.Totaal; overslaan += 50)
        {
            var pagina = await Haal(client, $"/api/leerplandoelen?aantal=50&overslaan={overslaan}");
            Assert.Equal(eerste.Totaal, pagina.Totaal);
            uitPaginas.AddRange(pagina.Regels.Select(r => r.Code));
        }

        // Distinct proves nothing was served twice; the count proves nothing was skipped.
        Assert.Equal(eerste.Totaal, uitPaginas.Count);
        Assert.Equal(eerste.Totaal, uitPaginas.Distinct(StringComparer.Ordinal).Count());

        // And the page order is the (domein, subdomein, code) order the contract promises: compare against
        // one unpaged read of the same rows straight from the database.
        var verwacht = await VerwachteOrdeningAsync();
        Assert.Equal(verwacht, uitPaginas);
    }

    /// <summary>
    /// Paging past the end returns an empty page with the total intact, so a client can tell "no more rows"
    /// from "nothing matches" without a special case.
    /// </summary>
    [PostgresFact]
    public async Task Voorbij_het_einde_pageren_geeft_een_lege_pagina_met_totaal()
    {
        var client = _factory.CreateClient();

        var pagina = await Haal(client, "/api/leerplandoelen?aantal=10&overslaan=1000000");

        Assert.Empty(pagina.Regels);
        Assert.True(pagina.Totaal > 0);
    }

    /// <summary>
    /// A filtered search is a bounded number of statements regardless of how many rows match: two (a count
    /// and a page). This is the "prove volume rather than asserting it" half — a query whose statement count
    /// grew with the result set would be an N+1, and the assertion is that the count is the <b>same</b> for a
    /// 3-row match and a ~2 500-row match.
    /// <para>
    /// Measured with a command interceptor on the query class rather than over HTTP, because the HTTP
    /// pipeline issues its own unrelated statements and would make the number meaningless.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Gefilterde_zoekopdracht_is_een_vast_aantal_statements()
    {
        var teller = new CommandTeller();
        await using var context = MaakGeteldeContext(teller);
        var query = new LeerplandoelenQuery(context);

        teller.Aantal = 0;
        var klein = await query.ZoekAsync(new LeerplandoelFilter(Zoekterm: "seizoenen"));
        var statementsKlein = teller.Aantal;

        teller.Aantal = 0;
        var groot = await query.ZoekAsync(new LeerplandoelFilter(Domein: "Volume"));
        var statementsGroot = teller.Aantal;

        Assert.True(klein.Totaal < groot.Totaal, "the two filters must differ in size for this to prove anything");
        Assert.True(groot.Totaal >= VolumeAantal, $"expected at least {VolumeAantal} matches, got {groot.Totaal}");
        Assert.Equal(2, statementsKlein);
        Assert.Equal(statementsKlein, statementsGroot);
    }

    /// <summary>
    /// The facets endpoint issues a <b>fixed</b> number of statements, whatever the curriculum's size — the
    /// property that matters on a table meant to hold every Op.stap goal, since this is fetched on every
    /// filter change.
    /// <para>
    /// Added 2026-07-31 after an audit found the count documented in a comment as "nine" while the method
    /// awaited ten round trips. The point is not the number: it is that nothing was pinning it, so it could
    /// drift again the moment a facet was added. Asserting equality across two filters of very different
    /// sizes is what proves independence from the row count; the absolute value catches a new round trip.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Facetten_zijn_een_vast_aantal_statements()
    {
        var teller = new CommandTeller();
        await using var context = MaakGeteldeContext(teller);
        var query = new LeerplandoelenQuery(context);

        teller.Aantal = 0;
        var klein = await query.HaalFacettenAsync(new LeerplandoelFilter(Zoekterm: "seizoenen"));
        var statementsKlein = teller.Aantal;

        teller.Aantal = 0;
        var groot = await query.HaalFacettenAsync(new LeerplandoelFilter());
        var statementsGroot = teller.Aantal;

        Assert.True(
            klein.TotaalAantalDoelen == groot.TotaalAantalDoelen,
            "the unfiltered total must stay unfiltered — it is what tells 'nothing imported' from 'filtered to nothing'");
        Assert.Equal(10, statementsKlein);
        Assert.Equal(statementsKlein, statementsGroot);
    }

    // ── clause 2: search and filters ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// One search field over both the code and the goal text, matched case-insensitively. The lowercase
    /// terms are the point: Postgres' default collation is case-sensitive, so a plain <c>=</c> or a .NET
    /// <c>OrdinalIgnoreCase</c> comparer would return nothing here and look exactly like "the curriculum
    /// holds nothing for you".
    /// </summary>
    [PostgresFact]
    public async Task Zoeken_werkt_op_code_en_op_vrije_tekst_ongeacht_hoofdletters()
    {
        var client = _factory.CreateClient();

        var opCode = await Haal(client, "/api/leerplandoelen?zoek=nat-k3");
        Assert.Contains(opCode.Regels, r => r.Code == "NAT-K3-01");

        var opTekst = await Haal(client, "/api/leerplandoelen?zoek=SEIZOENEN");
        Assert.Contains(opTekst.Regels, r => r.Code == "NAT-K3-02");

        // A term matching neither returns an honest empty result, not everything.
        var niets = await Haal(client, "/api/leerplandoelen?zoek=ditbestaatniet");
        Assert.Empty(niets.Regels);
        Assert.Equal(0, niets.Totaal);
    }

    /// <summary>
    /// The search term is escaped before it becomes an <c>ILIKE</c> pattern, so <c>%</c> and <c>_</c> are
    /// matched literally. Unescaped, a teacher typing <c>%</c> would silently get the whole curriculum back
    /// (and <c>_</c> would match any character), which is the same defect class this repo already fixed once
    /// in the klas duplicate pre-check.
    /// </summary>
    [PostgresFact]
    public async Task Jokertekens_in_de_zoekterm_worden_letterlijk_vergeleken()
    {
        var client = _factory.CreateClient();

        var procent = await Haal(client, "/api/leerplandoelen?zoek=%25");
        Assert.Single(procent.Regels);
        Assert.Equal("WIS-L4-99", procent.Regels[0].Code);

        // "WIS_L4" as a pattern would wildcard the underscore and match "WIS-L4-…"; literally it matches nothing.
        var underscore = await Haal(client, "/api/leerplandoelen?zoek=WIS_L4");
        Assert.Empty(underscore.Regels);
    }

    /// <summary>
    /// The taxonomy filter is the composite <c>(domein, subdomein)</c> (Art. VII.0). The seed repeats the
    /// subdomein name "Bouwstenen" under two different domeinen precisely so an unqualified subdomein filter
    /// would mix them: filtering on the pair returns one domein's goals, and the count proves the other
    /// domein's identically-named subdomein was not swept in.
    /// </summary>
    [PostgresFact]
    public async Task Subdomein_filtert_binnen_zijn_domein()
    {
        var client = _factory.CreateClient();

        var muziek = await Haal(client, "/api/leerplandoelen?domein=Muziek&subdomein=Bouwstenen");
        Assert.Equal(1, muziek.Totaal);
        Assert.Equal("MUZ-L2-01", muziek.Regels[0].Code);

        var beeld = await Haal(client, "/api/leerplandoelen?domein=Beeld&subdomein=Bouwstenen");
        Assert.Equal(1, beeld.Totaal);
        Assert.Equal("BEE-L2-01", beeld.Regels[0].Code);
    }

    /// <summary>
    /// A <c>subdomein</c> without a <c>domein</c> is a <b>400</b>, on both read endpoints.
    /// <para>
    /// This test previously existed under the name
    /// <c>Subdomein_filtert_alleen_binnen_zijn_domein</c> while its first assertion proved the exact opposite:
    /// it asserted that a bare <c>?subdomein=Bouwstenen</c> returns <b>2</b>, i.e. Muziek's and Beeld's rows
    /// summed into one meaningless total. A test whose name contradicts its body is worse than no test, and it
    /// sat next to two comments claiming the server narrowed a subdomein by its domein, which it did not
    /// (antagonist finding 2). The guard now exists at the edge, where it holds for every caller rather than
    /// for the one client that happened to drop the parameter.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Subdomein_zonder_domein_geeft_400()
    {
        var client = _factory.CreateClient();

        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/leerplandoelen?subdomein=Bouwstenen")).StatusCode);

        // Same refusal on the facets endpoint, so one bad request cannot behave differently on the two.
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/leerplandoelen/facetten?subdomein=Bouwstenen")).StatusCode);

        // A blank subdomein is "no filter", not a bad request: an empty select renders as an empty parameter.
        Assert.Equal(
            HttpStatusCode.OK,
            (await client.GetAsync("/api/leerplandoelen?subdomein=")).StatusCode);
    }

    /// <summary>Discipline, doelsoort and jaar/fase each narrow the register, and they combine.</summary>
    [PostgresFact]
    public async Task Discipline_doelsoort_en_jaarfase_filteren_en_combineren()
    {
        var client = _factory.CreateClient();

        var nederlands = await Haal(client, $"/api/leerplandoelen?discipline={DisciplineNederlands}&aantal=200");
        Assert.All(nederlands.Regels, r => Assert.DoesNotContain("WIS", r.Code, StringComparison.Ordinal));

        // Both spellings of the same filter value must work: the enum name the API serialises and the
        // official Op.stap short code.
        var opNaam = await Haal(client, "/api/leerplandoelen?doelsoort=Minimumdoel&aantal=200");
        var opCode = await Haal(client, "/api/leerplandoelen?doelsoort=MD&aantal=200");
        Assert.Equal(opNaam.Totaal, opCode.Totaal);
        Assert.All(opNaam.Regels, r => Assert.Equal(Doelsoort.Minimumdoel, r.Doelsoort));

        // Case-insensitive on the jaar/fase code, which a teacher types by hand elsewhere in the app.
        var kleuter = await Haal(client, "/api/leerplandoelen?jaarFase=k3");
        Assert.NotEmpty(kleuter.Regels);
        Assert.All(kleuter.Regels, r => Assert.Equal("K3", r.JaarFase));

        var gecombineerd = await Haal(client, "/api/leerplandoelen?jaarFase=K3&doelsoort=MD");
        Assert.All(gecombineerd.Regels, r =>
        {
            Assert.Equal("K3", r.JaarFase);
            Assert.Equal(Doelsoort.Minimumdoel, r.Doelsoort);
        });
    }

    /// <summary>
    /// The facets come from the loaded rows, not from a compiled-in list: the domeinen the seed created show
    /// up with their own subdomeinen nested under them, the repeated subdomein name appears once per domein,
    /// and only the doelsoorten/jaarFasen that actually occur are offered. This is the Art. XIV guard — a
    /// hard-coded enum would answer "which disciplines are in scope" and "1K/2K/3K or JK/K2/K3" silently.
    /// </summary>
    [PostgresFact]
    public async Task Facetten_komen_uit_de_data()
    {
        var client = _factory.CreateClient();

        var facetten = await client.GetFromJsonAsync<LeerplandoelFacettenWeergave>("/api/leerplandoelen/facetten", JsonOpties);
        Assert.NotNull(facetten);

        Assert.Equal(await AantalInDatabaseAsync(), facetten!.TotaalAantalDoelen);

        // The seeded discipline names come from the migration's reference data, joined on the number.
        var nederlands = Assert.Single(facetten.Disciplines, d => d.Nummer == DisciplineNederlands);
        Assert.False(string.IsNullOrWhiteSpace(nederlands.Naam));
        Assert.True(nederlands.Aantal > 0);

        // The repeated subdomein name is nested under each of its two domeinen, never merged.
        var muziek = Assert.Single(facetten.Domeinen, d => d.Domein == "Muziek");
        var beeld = Assert.Single(facetten.Domeinen, d => d.Domein == "Beeld");
        Assert.Single(muziek.Subdomeinen, s => s.Subdomein == "Bouwstenen");
        Assert.Single(beeld.Subdomeinen, s => s.Subdomein == "Bouwstenen");

        // A doelsoort no seeded row carries is not offered as a filter.
        Assert.DoesNotContain(facetten.Doelsoorten, d => d.Doelsoort == Doelsoort.AnderstaligeNieuwkomers);
        Assert.Contains(facetten.Doelsoorten, d => d.Doelsoort == Doelsoort.Minimumdoel);

        // Every domein's count is the sum of its subdomeinen's, so the tree cannot drift from its leaves.
        Assert.All(facetten.Domeinen, d => Assert.Equal(d.Aantal, d.Subdomeinen.Sum(s => s.Aantal)));

        Assert.Contains(facetten.JaarFasen, j => j.JaarFase == "K3");
    }

    /// <summary>
    /// The facet <b>counts</b> are scoped to the active filter while the <b>option sets</b> stay put, and a
    /// zero is reported as zero rather than hidden (antagonist finding 12).
    /// <para>
    /// Before this, choosing Discipline = Wiskunde still offered "Natuur (3)": a control stating a positive
    /// number and delivering nothing. Each count is computed under <i>the rest of</i> the filter, so it answers
    /// "how many would I get if I picked this?" — which is the only reading under which the number is true.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Facetaantallen_volgen_het_filter_terwijl_de_opties_blijven_staan()
    {
        var client = _factory.CreateClient();

        var ongefilterd = await Facetten(client, "/api/leerplandoelen/facetten");
        var gefilterd = await Facetten(client, $"/api/leerplandoelen/facetten?discipline={DisciplineWiskunde}");

        // The option sets are identical: nothing disappears from a select while a teacher is using it.
        Assert.Equal(
            ongefilterd.Domeinen.Select(d => d.Domein),
            gefilterd.Domeinen.Select(d => d.Domein));
        Assert.Equal(
            ongefilterd.Disciplines.Select(d => d.Nummer),
            gefilterd.Disciplines.Select(d => d.Nummer));
        Assert.Equal(
            ongefilterd.JaarFasen.Select(j => j.JaarFase),
            gefilterd.JaarFasen.Select(j => j.JaarFase));

        // Natuur holds only Nederlands-discipline goals in this seed, so under discipline=2 it must read 0,
        // and it must still be offered.
        var natuur = Assert.Single(gefilterd.Domeinen, d => d.Domein == "Natuur");
        Assert.Equal(0, natuur.Aantal);
        Assert.All(natuur.Subdomeinen, s => Assert.Equal(0, s.Aantal));

        // Getallen is Wiskunde's, so it keeps a positive count.
        Assert.True(Assert.Single(gefilterd.Domeinen, d => d.Domein == "Getallen").Aantal > 0);

        // The discipline dimension is counted WITHOUT its own selection, so every discipline still reports what
        // choosing it would yield rather than 0 for all but the chosen one.
        Assert.All(gefilterd.Disciplines, d => Assert.Equal(
            ongefilterd.Disciplines.Single(o => o.Nummer == d.Nummer).Aantal,
            d.Aantal));

        // The sum-of-leaves invariant survives scoping.
        Assert.All(gefilterd.Domeinen, d => Assert.Equal(d.Aantal, d.Subdomeinen.Sum(s => s.Aantal)));

        // And the unfiltered total is untouched, because it is what tells "nothing imported" from "filtered to
        // nothing" apart.
        Assert.Equal(ongefilterd.TotaalAantalDoelen, gefilterd.TotaalAantalDoelen);

        // A count that reaches zero everywhere still leaves every option in place.
        var niets = await Facetten(client, "/api/leerplandoelen/facetten?zoek=ditbestaatabsoluutniet");
        Assert.Equal(ongefilterd.Domeinen.Count, niets.Domeinen.Count);
        Assert.All(niets.Domeinen, d => Assert.Equal(0, d.Aantal));
        Assert.Equal(ongefilterd.TotaalAantalDoelen, niets.TotaalAantalDoelen);
    }

    /// <summary>
    /// Discipline numbers are ordered <b>numerically per dot-separated segment</b>, so a full Op.stap import
    /// reads 1, 2, 3, … 9.1, 9.2, 9.3, 10, 11 rather than the ordinal 1, 10, 11, 2, 3 (antagonist finding 5).
    /// The seed covers the case that matters: it contains both "1" and "10", which ordinal sorting puts
    /// adjacent and wrong.
    /// </summary>
    [PostgresFact]
    public async Task Disciplines_staan_op_nummer_niet_alfabetisch()
    {
        var client = _factory.CreateClient();

        var facetten = await Facetten(client, "/api/leerplandoelen/facetten");
        var nummers = facetten.Disciplines.Select(d => d.Nummer).ToList();

        Assert.Contains("1", nummers);
        Assert.Contains("10", nummers);
        Assert.Contains("9.2", nummers);

        // "2" before "10", and "9.2" before "10": both are what an ordinal sort gets wrong.
        Assert.True(nummers.IndexOf("2") < nummers.IndexOf("10"));
        Assert.True(nummers.IndexOf("9.2") < nummers.IndexOf("10"));
        Assert.True(nummers.IndexOf("9.1") < nummers.IndexOf("9.2"));
    }

    // ── clause 3: one doel in full ───────────────────────────────────────────────────────────────────

    /// <summary>
    /// The detail carries every imported field plus the discipline name, the concordance and the school
    /// content that links to it with each link's status (E1-16 clause 3). The four link layers of Art. IX.2
    /// are all represented in the seed, including a <c>voorgesteld</c> suggestion and a <c>geweigerd</c>
    /// one — this screen answers "which thema's mention this doel and what was decided", which is wider
    /// than the Art. V coverage definition, so a rejected link must still be visible.
    /// </summary>
    [PostgresFact]
    public async Task Detail_geeft_elk_veld_de_concordantie_en_de_koppelingen_met_status()
    {
        var client = _factory.CreateClient();

        var doel = await client.GetFromJsonAsync<LeerplandoelDetailWeergave>("/api/leerplandoelen/NAT-K3-01", JsonOpties);
        Assert.NotNull(doel);

        Assert.Equal("NAT-K3-01", doel!.Code);
        Assert.Equal(Doelsoort.Minimumdoel, doel.Doelsoort);
        Assert.Equal("K3", doel.JaarFase);
        Assert.Equal(DisciplineNederlands, doel.DisciplineNummer);
        Assert.False(string.IsNullOrWhiteSpace(doel.DisciplineNaam));
        Assert.Equal("Natuur", doel.Domein);
        Assert.Equal("Levend", doel.Subdomein);
        Assert.Equal("Planten", doel.Cluster);
        Assert.Contains("observeert", doel.Tekst, StringComparison.Ordinal);
        Assert.Equal("een wandeling in het park", doel.Voorbeelden);
        Assert.Equal("Observeren gaat voor benoemen.", doel.Toelichting);
        Assert.Equal("blad, stam, wortel", doel.Woordenschat);
        Assert.False(doel.NietMeerInOpstap);

        // Concorded AND the decreed row is loaded: the omschrijving is available.
        Assert.Equal("K-12", doel.MinimumdoelRef);
        Assert.NotNull(doel.Minimumdoel);
        Assert.Equal("K-", doel.Minimumdoel!.Leeftijd);
        Assert.Equal("De kleuter verkent de natuur in de omgeving.", doel.Minimumdoel.Omschrijving);

        // All four link layers, each with the status the teacher left it in.
        Assert.Equal(4, doel.Koppelingen.Count);
        var themadoel = Assert.Single(doel.Koppelingen, k => k.Herkomst == KoppelingHerkomst.Themadoel);
        Assert.Equal("Herfst", themadoel.ThemaNaam);
        Assert.Equal(KoppelingStatus.Manueel, themadoel.Status);
        Assert.Null(themadoel.Onderdeel);

        var suggestie = Assert.Single(doel.Koppelingen, k => k.Herkomst == KoppelingHerkomst.Doelsuggestie);
        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);

        var subdoel = Assert.Single(doel.Koppelingen, k => k.Herkomst == KoppelingHerkomst.Subdoel);
        Assert.Equal("Bladeren", subdoel.Onderdeel);
        Assert.Equal(KoppelingStatus.Aanvaard, subdoel.Status);

        var activiteit = Assert.Single(doel.Koppelingen, k => k.Herkomst == KoppelingHerkomst.Activiteit);
        Assert.Equal("Bladeren zoeken", activiteit.Onderdeel);
        Assert.Equal(KoppelingStatus.Geweigerd, activiteit.Status);

        // A class/age-scoped link NAMES ITS KLAS, and a school-wide one has none (Art. IX.2, antagonist
        // finding 3). Without this, one class's planning reads as a school-wide fact.
        Assert.Equal(KlasNaam, subdoel.KlasNaam);
        Assert.Equal(KlasNaam, activiteit.KlasNaam);
        Assert.Null(themadoel.KlasNaam);
        Assert.Null(suggestie.KlasNaam);
    }

    /// <summary>
    /// The <see cref="Koppelingzichtbaarheid"/> seam actually gates the class/age-scoped layers (antagonist
    /// finding 3). Driven at the query rather than over HTTP, because the controller deliberately has exactly
    /// one call site with one value: the point of the seam is that the decision lives there, so the test that it
    /// works has to reach past it.
    /// <para>
    /// This is <b>not</b> an assertion about what the app should show. FR-10.2 is an open Art. XIV decision;
    /// this only proves that the narrowing exists and is one argument away, so resolving that decision does not
    /// require rewriting the query.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Zichtbaarheidsseam_houdt_klasgebonden_koppelingen_achter()
    {
        await using var context = _db.MaakContext();
        var query = new LeerplandoelenQuery(context);

        var alles = await query.HaalDetailAsync("NAT-K3-01", Koppelingzichtbaarheid.Alles);
        Assert.Equal(4, alles!.Koppelingen.Count);

        var schoolbreed = await query.HaalDetailAsync("NAT-K3-01", Koppelingzichtbaarheid.AlleenSchoolbreed);
        Assert.Equal(2, schoolbreed!.Koppelingen.Count);
        Assert.All(schoolbreed.Koppelingen, k => Assert.True(
            k.Herkomst is KoppelingHerkomst.Themadoel or KoppelingHerkomst.Doelsuggestie,
            $"{k.Herkomst} is class/age-scoped and must not survive AlleenSchoolbreed"));
        Assert.All(schoolbreed.Koppelingen, k => Assert.Null(k.KlasNaam));
    }

    /// <summary>
    /// A doel whose optional Op.stap columns are empty reports them as null rather than as an empty string,
    /// so the UI can omit the section instead of rendering a label with nothing under it. A null
    /// <c>MinimumdoelRef</c> means "not concorded", which is a different statement from "concorded but the
    /// decreed text is not loaded" and must not be collapsed into it.
    /// <para>
    /// <b>The third combination — a ref set with no decreed row behind it — is not asserted here because the
    /// schema cannot produce it.</b> <c>leerplandoelen.MinimumdoelRef</c> is a <c>Restrict</c> FK to
    /// <c>minimumdoelen.Ref</c>, so a goal carrying a ref whose row does not exist fails to commit
    /// (SQLSTATE 23503) — which is precisely the E1-03/E1-04 blockage, and is why no MD-concorded goal can be
    /// imported until E1-12 supplies the decreed source. Fabricating the state by dropping the constraint in
    /// a fixture would test a database this application never runs against. The read view still models it
    /// (ref and omschrijving are separate fields) and the frontend pins its copy, so the day the FK relaxes,
    /// the UI already tells the truth.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Detail_onderscheidt_leeg_veld_van_ontbrekende_concordantie()
    {
        var client = _factory.CreateClient();

        var kaal = await client.GetFromJsonAsync<LeerplandoelDetailWeergave>("/api/leerplandoelen/NAT-K3-02", JsonOpties);
        Assert.NotNull(kaal);
        Assert.Null(kaal!.Cluster);
        Assert.Null(kaal.Voorbeelden);
        Assert.Null(kaal.Toelichting);
        Assert.Null(kaal.Woordenschat);
        Assert.Null(kaal.MinimumdoelRef);
        Assert.Null(kaal.Minimumdoel);
        Assert.Empty(kaal.Koppelingen);
    }

    /// <summary>
    /// Documents the E1-04 blockage as an executed test rather than as a note: a leerplandoel concorded to a
    /// minimumdoel ref with no decreed row <b>cannot be saved at all</b>. This is the reason the register
    /// shows no minimumdoel-level content today, and it fails at the database, not in this story's code.
    /// </summary>
    [PostgresFact]
    public async Task Concordantie_naar_een_niet_ingeladen_minimumdoel_kan_niet_bewaard_worden()
    {
        await using var context = _db.MaakContext();

        context.Leerplandoelen.Add(new Leerplandoel(
            code: "MD-ZONDER-RIJ",
            doelsoort: Doelsoort.Minimumdoel,
            jaarFase: "L4",
            domein: "Getallen",
            subdomein: "Breuken",
            disciplineNummer: DisciplineWiskunde,
            tekst: "Concorded to a minimumdoel that was never imported.",
            minimumdoelRef: "4-07"));

        var fout = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Contains("23503", fout.InnerException?.ToString() ?? string.Empty, StringComparison.Ordinal);
    }

    /// <summary>
    /// The <c>NietMeerInOpstap</c> review flag reaches both the row and the detail. It is the one field on
    /// this screen that is the tool's own signal rather than decreed content, and a teacher has to see it
    /// while scanning, not only after opening the doel.
    /// </summary>
    [PostgresFact]
    public async Task Vervallen_doel_draagt_de_herzieningsvlag_in_lijst_en_detail()
    {
        var client = _factory.CreateClient();

        var lijst = await Haal(client, "/api/leerplandoelen?zoek=VERVALLEN-1");
        var regel = Assert.Single(lijst.Regels);
        Assert.True(regel.NietMeerInOpstap);

        var detail = await client.GetFromJsonAsync<LeerplandoelDetailWeergave>("/api/leerplandoelen/VERVALLEN-1", JsonOpties);
        Assert.True(detail!.NietMeerInOpstap);
    }

    /// <summary>A code is matched case-insensitively, because it arrives from a URL a teacher may have typed.</summary>
    [PostgresFact]
    public async Task Detail_vindt_de_code_ongeacht_hoofdletters()
    {
        var client = _factory.CreateClient();

        var doel = await client.GetFromJsonAsync<LeerplandoelDetailWeergave>("/api/leerplandoelen/nat-k3-01", JsonOpties);

        Assert.Equal("NAT-K3-01", doel!.Code);
    }

    // ── clause 4: read-only, and refusals ────────────────────────────────────────────────────────────

    /// <summary>
    /// The register offers no write surface at all (Art. III.1): POST, PUT, PATCH and DELETE are refused by
    /// routing itself, because no such action exists to bind them to. Asserted rather than assumed, since
    /// "the UI offers no edit affordance" is only half of read-only if the API accepts one anyway.
    /// </summary>
    [PostgresFact]
    public async Task Curriculum_heeft_geen_schrijfpad()
    {
        var client = _factory.CreateClient();

        var post = await client.PostAsJsonAsync("/api/leerplandoelen", new { code = "HACK-1" });
        var put = await client.PutAsJsonAsync("/api/leerplandoelen/NAT-K3-01", new { tekst = "gewijzigd" });
        var patch = await client.PatchAsJsonAsync("/api/leerplandoelen/NAT-K3-01", new { nietMeerInOpstap = true });
        var delete = await client.DeleteAsync("/api/leerplandoelen/NAT-K3-01");

        foreach (var response in new[] { post, put, patch, delete })
        {
            Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        }

        // And the row is untouched.
        var doel = await client.GetFromJsonAsync<LeerplandoelDetailWeergave>("/api/leerplandoelen/NAT-K3-01", JsonOpties);
        Assert.Contains("observeert", doel!.Tekst, StringComparison.Ordinal);
        Assert.False(doel.NietMeerInOpstap);
    }

    /// <summary>
    /// Invalid input is a 400, never a 500. The <c>doelsoort=99</c> case is the specific defect E3-06 shipped
    /// with <c>?niveau=99</c>: ASP.NET Core binds any integer to an enum parameter without validating it, so
    /// the value travels on as an undefined enum. Bound as a string and parsed explicitly, it is refused.
    /// </summary>
    [PostgresFact]
    public async Task Ongeldige_invoer_geeft_400_geen_500()
    {
        var client = _factory.CreateClient();

        foreach (var pad in new[]
        {
            "/api/leerplandoelen?doelsoort=99",
            "/api/leerplandoelen?doelsoort=bestaatniet",
            "/api/leerplandoelen?aantal=0",
            "/api/leerplandoelen?aantal=100000",
            "/api/leerplandoelen?overslaan=-1",
        })
        {
            var response = await client.GetAsync(pad);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // A non-numeric paging value is refused by model binding, also as a 400.
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/leerplandoelen?aantal=veel")).StatusCode);
    }

    /// <summary>A deep link to a code no leerplandoel carries is a 404, so the UI can say the doel does not exist.</summary>
    [PostgresFact]
    public async Task Onbekende_code_geeft_404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/leerplandoelen/BESTAAT-NIET-1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// The E2-06 gap list keeps answering on its own literal route. Asserted because <c>{code}</c> and
    /// <c>ongekoppeld</c> occupy the same route position: were the precedence to flip, the gap list would
    /// start 404-ing as an unknown leerplandoel code and only the E2 screen would notice.
    /// </summary>
    [PostgresFact]
    public async Task Ongekoppeld_blijft_zijn_eigen_route()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/leerplandoelen/ongekoppeld");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── helpers ──────────────────────────────────────────────────────────────────────────────────────

    private static async Task<LeerplandoelenPagina> Haal(HttpClient client, string pad)
    {
        var pagina = await client.GetFromJsonAsync<LeerplandoelenPagina>(pad, JsonOpties);
        Assert.NotNull(pagina);
        return pagina!;
    }

    private static async Task<LeerplandoelFacettenWeergave> Facetten(HttpClient client, string pad)
    {
        var facetten = await client.GetFromJsonAsync<LeerplandoelFacettenWeergave>(pad, JsonOpties);
        Assert.NotNull(facetten);
        return facetten!;
    }

    private async Task<int> AantalInDatabaseAsync()
    {
        await using var context = _db.MaakContext();
        return await context.Leerplandoelen.CountAsync();
    }

    /// <summary>
    /// The (domein, subdomein, code) order read in one go from the database, as the yardstick for the paged
    /// walk. Read through the same provider and collation the endpoint uses, so this compares the paging
    /// rather than re-implementing Postgres' sort in .NET (which would compare the wrong thing).
    /// </summary>
    private async Task<List<string>> VerwachteOrdeningAsync()
    {
        await using var context = _db.MaakContext();
        return await context.Leerplandoelen
            .AsNoTracking()
            .OrderBy(l => l.Domein)
            .ThenBy(l => l.Subdomein)
            .ThenBy(l => l.Code)
            .Select(l => l.Code)
            .ToListAsync();
    }

    private AppDbContext MaakGeteldeContext(CommandTeller teller) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_db.ConnectionString)
            .AddInterceptors(teller)
            .Options);

    /// <summary>
    /// Seeds the fixture: a handful of hand-written goals that carry the interesting shapes, plus
    /// <see cref="VolumeAantal"/> bulk rows so paging is exercised at the volume a real import produces.
    /// </summary>
    private async Task ZaaiCurriculumAsync()
    {
        await using var context = _db.MaakContext();

        // One decreed minimumdoel exists; the other concordance deliberately points at a ref with no row,
        // which is every MD-concorded goal's state until E1-12 lands.
        context.Minimumdoelen.Add(new Minimumdoel(
            "K-12", "K-", "12", "De kleuter verkent de natuur in de omgeving."));
        await context.SaveChangesAsync();

        var doelen = new List<Leerplandoel>
        {
            // Every optional field filled, concorded to a minimumdoel that IS loaded.
            new(
                code: "NAT-K3-01",
                doelsoort: Doelsoort.Minimumdoel,
                jaarFase: "K3",
                domein: "Natuur",
                subdomein: "Levend",
                disciplineNummer: DisciplineNederlands,
                cluster: "Planten",
                tekst: "De kleuter observeert planten in de omgeving.",
                voorbeelden: "een wandeling in het park",
                toelichting: "Observeren gaat voor benoemen.",
                woordenschat: "blad, stam, wortel",
                minimumdoelRef: "K-12"),

            // Every optional field empty, not concorded, no links.
            new(
                code: "NAT-K3-02",
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: "K3",
                domein: "Natuur",
                subdomein: "Levend",
                disciplineNummer: DisciplineNederlands,
                tekst: "De kleuter benoemt de seizoenen."),

            // Not concorded, so it can commit; see the FK note on the concordance test.
            new(
                code: "WIS-L4-01",
                doelsoort: Doelsoort.Verdieping,
                jaarFase: "L4",
                domein: "Getallen",
                subdomein: "Breuken",
                disciplineNummer: DisciplineWiskunde,
                tekst: "De leerling vergelijkt breuken met gelijke noemer."),

            // A code containing a LIKE metacharacter, to prove the search escapes its pattern.
            new(
                code: "WIS-L4-99",
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: "L4",
                domein: "Getallen",
                subdomein: "Procenten",
                disciplineNummer: DisciplineWiskunde,
                tekst: "De leerling leest 50% als de helft."),

            // The same subdomein name under two different domeinen (Art. VII.0).
            new(
                code: "MUZ-L2-01",
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: "L2",
                domein: "Muziek",
                subdomein: "Bouwstenen",
                disciplineNummer: DisciplineNederlands,
                tekst: "De leerling herkent een puls in muziek."),
            new(
                code: "BEE-L2-01",
                doelsoort: Doelsoort.Specifiek,
                jaarFase: "L2",
                domein: "Beeld",
                subdomein: "Bouwstenen",
                disciplineNummer: DisciplineNederlands,
                tekst: "De leerling herkent lijn en vlak in een beeld."),

            // Three more disciplines, purely so the ordering test has the cases an ordinal sort gets wrong:
            // "10" versus "2", and the 9.x nested split (Art. VII.0).
            new(
                code: "FRA-L5-01",
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: "L5",
                domein: "Frans",
                subdomein: "Woordenschat",
                disciplineNummer: DisciplineFrans,
                tekst: "De leerling begroet iemand in het Frans."),
            new(
                code: "GEZ-L1-01",
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: "L1",
                domein: "Levensstijl",
                subdomein: "Voeding",
                disciplineNummer: DisciplineLevensstijl,
                tekst: "De leerling kiest een gezond tussendoortje."),
            new(
                code: "LER-L1-01",
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: "L1",
                domein: "Leren leren",
                subdomein: "Plannen",
                disciplineNummer: DisciplineLerenLeren,
                tekst: "De leerling plant een korte taak."),

            // Flagged by the re-import as gone from Op.stap while still in use.
            new(
                code: "VERVALLEN-1",
                doelsoort: Doelsoort.Precurriculum,
                jaarFase: "K2",
                domein: "Natuur",
                subdomein: "Niet-levend",
                disciplineNummer: DisciplineNederlands,
                tekst: "Dit doel stond in een eerdere Op.stap-versie."),
        };

        context.Leerplandoelen.AddRange(doelen);

        // Bulk volume. One domein of its own so the volume filter can select exactly these, with several
        // subdomeinen so the (domein, subdomein, code) ordering has real work to do. Codes are zero-padded
        // so their lexical order is their numeric order and the expected ordering is unambiguous.
        for (var i = 0; i < VolumeAantal; i++)
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code: $"VOL-{i:D5}",
                doelsoort: i % 3 == 0 ? Doelsoort.Minimumdoel : Doelsoort.Gemeenschappelijk,
                jaarFase: i % 2 == 0 ? "L1" : "L2",
                domein: "Volume",
                subdomein: $"Deel {i % 7}",
                disciplineNummer: i % 2 == 0 ? DisciplineNederlands : DisciplineWiskunde,
                tekst: $"Bulkdoel nummer {i} voor de volumetest.",
                minimumdoelRef: i % 3 == 0 ? "K-12" : null));
        }

        await context.SaveChangesAsync();

        await ZetReviewVlagAsync(context, "VERVALLEN-1");
        await ZaaiSchoolcontentAsync(context);
    }

    /// <summary>
    /// Raises the import-managed <c>NietMeerInOpstap</c> flag on one seeded goal, through EF's property
    /// metadata — the same mechanism <c>OpstapImportService</c> uses, and the only one available: the domain
    /// entity deliberately exposes no mutator for it, because normal app code must not be able to set it
    /// (Art. III.1). That the fixture had to reach for this is the guarantee working, not a workaround.
    /// </summary>
    private static async Task ZetReviewVlagAsync(AppDbContext context, string code)
    {
        var doel = await context.Leerplandoelen.SingleAsync(l => l.Code == code);
        context.Entry(doel).Property(l => l.NietMeerInOpstap).CurrentValue = true;
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Seeds one thema with all four link layers of Art. IX.2 pointing at NAT-K3-01, each in a different
    /// status, so the detail's koppelingen list has something real to report.
    /// </summary>
    private async Task ZaaiSchoolcontentAsync(AppDbContext context)
    {
        var schooljaar = new Schooljaar(
            "2026-2027",
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        context.Schooljaren.Add(schooljaar);

        var klas = new Klas(schooljaar.Id, KlasNaam, 0);
        context.Klassen.Add(klas);

        var thema = new Thema("Herfst", 5);
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Manueel));
        thema.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "past bij bladeren"));

        var subthema = thema.VoegSubthemaToe("Bladeren", 2, klas.Id, "5");
        subthema.VoegSubdoelToe("5", new DoelKoppeling("NAT-K3-01", KoppelingStatus.Aanvaard));
        var activiteit = subthema.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Geweigerd));

        context.Themas.Add(thema);
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Counts the SQL statements EF Core executes, so "no N+1" can be measured instead of asserted. Both the
    /// sync and async hooks are overridden: which one fires depends on the call path, and counting only one
    /// would silently under-report.
    /// </summary>
    private sealed class CommandTeller : DbCommandInterceptor
    {
        public int Aantal;

        public override InterceptionResult<DbDataReader> ReaderExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result)
        {
            Aantal++;
            return base.ReaderExecuting(command, eventData, result);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Aantal++;
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override InterceptionResult<object> ScalarExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<object> result)
        {
            Aantal++;
            return base.ScalarExecuting(command, eventData, result);
        }

        public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<object> result,
            CancellationToken cancellationToken = default)
        {
            Aantal++;
            return base.ScalarExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
