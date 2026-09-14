using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the <see cref="MinimumdoelenQuery"/>: the minimumdoelen register in the decree's own ordering (TB-010). The
/// load-bearing behaviour: every minimumdoel is one row in one branch, leergebied › rubriek › subrubriek, in the order of
/// the decree's numbers; the concorded leerplandoelen are summarised on the row and listed per jaar/fase in the detail.
/// Uses the in-memory provider, so the free-text search (<c>ILIKE</c>) is pinned on PostgreSQL by the endpoint tests.
/// </summary>
public sealed class MinimumdoelenQueryTests
{
    private static DbContextOptions<AppDbContext> Options() =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"minimumdoelen_query_{Guid.NewGuid():N}")
            .Options;

    /// <summary>A minimumdoel from its ref (<c>K-1.1.2</c>): leeftijd and number come from the ref, as the mapping reads them.</summary>
    private static Minimumdoel Md(
        string minimumdoelRef,
        string? leergebied = null,
        string? rubriek = null,
        string? subrubriek = null,
        MinimumdoelSoort? soort = null) =>
        new(minimumdoelRef, minimumdoelRef[..2], minimumdoelRef[2..], $"Minimumdoel {minimumdoelRef}.", leergebied, rubriek, subrubriek, soort);

    private static Leerplandoel Leerdoel(
        string code,
        string minimumdoelRef,
        string jaarFase = "L3",
        string disciplineNummer = "1",
        string domein = "Lezen",
        string subdomein = "Tekstbegrip") =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, domein, subdomein, disciplineNummer, tekst: $"doel {code}", minimumdoelRef: minimumdoelRef);

    /// <summary>
    /// Nine minimumdoelen over four leergebieden, one without a subrubriek and one without any ordering, stored in an order
    /// that is none of the orders the register should produce.
    /// </summary>
    private static readonly Minimumdoel[] Decreet =
    [
        Md("4-10.1.1", "Frans", "Woordenschat", "Thematische woordenschat"),
        Md("6-1.1.10", "Nederlands", "Lezen", "Vlot en vloeiend lezen"),
        Md("K-5.5.5"),
        Md("4-1.1.1", "Nederlands", "Lezen", "Vlot en vloeiend lezen"),
        Md("6-9.1.1", "Attitudes", "Leren leren"),
        Md("K-1.2.1", "Nederlands", "Schrijven", "Handschrift en digitale vaardigheden"),
        Md("4-2.1.1", "Wiskunde", "Getallenkennis", "Natuurlijke getallen"),
        Md("6-1.1.9", "Nederlands", "Lezen", "Vlot en vloeiend lezen"),
        Md("K-1.1.2", "Nederlands", "Lezen", "Vlot en vloeiend lezen"),
    ];

    private static async Task<DbContextOptions<AppDbContext>> MetDecreetAsync(Action<AppDbContext>? extra = null)
    {
        var options = Options();
        await using var ctx = new AppDbContext(options);
        ctx.Minimumdoelen.AddRange(Decreet.Select(m => Md(m.Ref, m.Leergebied, m.Rubriek, m.Subrubriek)));
        extra?.Invoke(ctx);
        await ctx.SaveChangesAsync();
        return options;
    }

    [Fact]
    public async Task De_lijst_volgt_de_volgorde_van_het_decreet_en_zet_wat_geen_ordening_heeft_achteraan()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);

        var pagina = await new MinimumdoelenQuery(query).ZoekAsync(new MinimumdoelFilter(Aantal: 200));

        // Leergebieden and rubrieken where their lowest number sits (Frans holds 10, so it comes last, not after 1);
        // within a branch K-, 4-, 6- and then the number as a number (1.1.9 before 1.1.10).
        Assert.Equal(
            ["K-1.1.2", "4-1.1.1", "6-1.1.9", "6-1.1.10", "K-1.2.1", "4-2.1.1", "6-9.1.1", "4-10.1.1", "K-5.5.5"],
            pagina.Regels.Select(r => r.Ref).ToArray());
        Assert.Equal(9, pagina.Totaal);
        var eerste = pagina.Regels[0];
        Assert.Equal(("Nederlands", "Lezen", "Vlot en vloeiend lezen"), (eerste.Leergebied, eerste.Rubriek, eerste.Subrubriek));
        Assert.Null(pagina.Regels[^1].Leergebied);
    }

    [Fact]
    public async Task Een_minimumdoel_staat_een_keer_in_de_lijst_ook_als_zijn_leerplandoelen_in_twee_disciplines_liggen()
    {
        var options = await MetDecreetAsync(ctx => ctx.Leerplandoelen.AddRange(
            Leerdoel("1.1.GL1.1", "4-1.1.1", "L1"),
            Leerdoel("1.1.GL3.2", "4-1.1.1", "L3"),
            Leerdoel("3.1.GL1.1", "4-1.1.1", "L1", disciplineNummer: "3", domein: "Natuur", subdomein: "Leven")));
        await using var query = new AppDbContext(options);

        var pagina = await new MinimumdoelenQuery(query).ZoekAsync(new MinimumdoelFilter(Aantal: 200));

        var regel = Assert.Single(pagina.Regels, r => r.Ref == "4-1.1.1");
        Assert.Equal(3, regel.AantalLeerplandoelen);
        Assert.Equal(["L1", "L3"], regel.JaarFasen);
        Assert.Equal(9, pagina.Totaal);
    }

    [Fact]
    public async Task Een_tak_geeft_alleen_de_minimumdoelen_van_die_tak()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        async Task<string[]> Refs(MinimumdoelFilter filter) => [.. (await sut.ZoekAsync(filter)).Regels.Select(r => r.Ref)];

        Assert.Equal(
            ["K-1.1.2", "4-1.1.1", "6-1.1.9", "6-1.1.10"],
            await Refs(new MinimumdoelFilter(Leergebied: "Nederlands", Rubriek: "Lezen", Subrubriek: "Vlot en vloeiend lezen")));
        Assert.Equal(["K-1.1.2", "4-1.1.1", "6-1.1.9", "6-1.1.10", "K-1.2.1"], await Refs(new MinimumdoelFilter(Leergebied: "Nederlands")));
        Assert.Equal(["6-9.1.1"], await Refs(new MinimumdoelFilter(Leergebied: "Attitudes", Rubriek: "Leren leren", ZonderSubrubriek: true)));
        Assert.Equal(["K-5.5.5"], await Refs(new MinimumdoelFilter(ZonderOrdening: true)));
        Assert.Equal(["6-1.1.9", "6-1.1.10", "6-9.1.1"], await Refs(new MinimumdoelFilter(Leeftijd: "6-")));
    }

    [Fact]
    public async Task De_lijst_pagineert_over_de_geordende_minimumdoelen()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);

        var pagina = await new MinimumdoelenQuery(query).ZoekAsync(new MinimumdoelFilter(Overslaan: 4, Aantal: 3));

        Assert.Equal(["K-1.2.1", "4-2.1.1", "6-9.1.1"], pagina.Regels.Select(r => r.Ref).ToArray());
        Assert.Equal(9, pagina.Totaal);
    }

    [Fact]
    public async Task De_facetten_beschrijven_de_boom_in_de_volgorde_van_het_decreet_en_tellen_minimumdoelen()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);

        var facetten = await new MinimumdoelenQuery(query).HaalFacettenAsync(new MinimumdoelFilter());

        Assert.Equal(9, facetten.TotaalAantalMinimumdoelen);
        Assert.Equal(9, facetten.AantalTreffers);
        Assert.Equal(1, facetten.AantalZonderOrdening);
        Assert.Equal(["Nederlands", "Wiskunde", "Attitudes", "Frans"], facetten.Leergebieden.Select(l => l.Naam).ToArray());
        // Each minimumdoel sits in one branch, so the branches add up to the matches.
        Assert.Equal(facetten.AantalTreffers, facetten.Leergebieden.Sum(l => l.Aantal) + facetten.AantalZonderOrdening);

        var nederlands = facetten.Leergebieden[0];
        Assert.Equal(5, nederlands.Aantal);
        Assert.Equal(["Lezen", "Schrijven"], nederlands.Rubrieken.Select(r => r.Naam).ToArray());
        var lezen = nederlands.Rubrieken[0];
        Assert.Equal(0, lezen.AantalZonderSubrubriek);
        Assert.Equal(new SubrubriekFacet("Vlot en vloeiend lezen", 4), Assert.Single(lezen.Subrubrieken));

        var lerenLeren = Assert.Single(facetten.Leergebieden[2].Rubrieken);
        Assert.Equal(1, lerenLeren.AantalZonderSubrubriek);
        Assert.Empty(lerenLeren.Subrubrieken);

        Assert.Equal(
            [new LeeftijdFacet("K-", 3), new LeeftijdFacet("4-", 3), new LeeftijdFacet("6-", 3)],
            facetten.Leeftijden.ToArray());
    }

    [Fact]
    public async Task Onder_een_leeftijd_tellen_de_takken_mee_en_de_leeftijden_niet_en_een_tak_verandert_de_facetten_niet()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        var kleuter = await sut.HaalFacettenAsync(new MinimumdoelFilter(Leeftijd: "K-"));
        var metTak = await sut.HaalFacettenAsync(new MinimumdoelFilter(Leergebied: "Wiskunde", Rubriek: "Getallenkennis"));

        Assert.Equal(3, kleuter.AantalTreffers);
        Assert.Equal(["Nederlands"], kleuter.Leergebieden.Select(l => l.Naam).ToArray());
        Assert.Equal([3, 3, 3], kleuter.Leeftijden.Select(l => l.Aantal).ToArray());
        Assert.Equal(9, metTak.AantalTreffers);
        Assert.Equal(4, metTak.Leergebieden.Count);
    }

    /// <summary>
    /// The screen's shared leerplandoelen filter reaches a minimumdoel through its concorded goals, and one goal must meet
    /// every condition: a minimumdoel with an L3 goal in Nederlands and a K2 goal in Wiskunde is not a match for
    /// "Wiskunde in L3".
    /// </summary>
    [Fact]
    public async Task Een_concordantiefilter_houdt_een_minimumdoel_als_een_enkel_leerplandoel_aan_alles_voldoet()
    {
        var options = await MetDecreetAsync(ctx => ctx.Leerplandoelen.AddRange(
            Leerdoel("1.1.GL3.1", "4-1.1.1", "L3", disciplineNummer: "1"),
            Leerdoel("2.1.GK2.1", "4-1.1.1", "K2", disciplineNummer: "2", domein: "Getallenkennis", subdomein: "Tellen"),
            Leerdoel("2.1.GL3.1", "4-2.1.1", "L3", disciplineNummer: "2", domein: "Getallenkennis", subdomein: "Tellen")));
        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        async Task<string[]> Refs(MinimumdoelFilter filter) => [.. (await sut.ZoekAsync(filter)).Regels.Select(r => r.Ref)];

        Assert.Equal(["4-1.1.1", "4-2.1.1"], await Refs(new MinimumdoelFilter(JaarFase: "L3")));
        Assert.Equal(["4-2.1.1"], await Refs(new MinimumdoelFilter(Discipline: "2", JaarFase: "L3")));
        Assert.Equal(["4-1.1.1", "4-2.1.1"], await Refs(new MinimumdoelFilter(Domein: "Getallenkennis", Subdomein: "Tellen")));
        Assert.Equal(2, (await sut.HaalFacettenAsync(new MinimumdoelFilter(JaarFase: "L3"))).AantalTreffers);
    }

    /// <summary>The import's reason is about a minimumdoel no stored goal refers to, and is shown only there (owner ruling 2026-09-13).</summary>
    [Fact]
    public async Task De_reden_zonder_leerplandoel_staat_alleen_bij_een_minimumdoel_zonder_leerplandoel()
    {
        var options = Options();
        await using (var ctx = new AppDbContext(options))
        {
            var zwemmen = Md("6-7.1.6", "Lichamelijke opvoeding", "Motorische competenties", "Zwemmen");
            var tellen = Md("4-2.1.7", "Wiskunde", "Getallenkennis", "Natuurlijke getallen");
            ctx.Minimumdoelen.AddRange(zwemmen, tellen);
            ctx.Entry(zwemmen).Property(m => m.ZonderLeerplandoelReden).CurrentValue = ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets;
            ctx.Entry(zwemmen).Property(m => m.ZonderLeerplandoelDoelsets).CurrentValue = "V,Z";
            // A stale reason on a minimumdoel that does have a goal is not shown.
            ctx.Entry(tellen).Property(m => m.ZonderLeerplandoelReden).CurrentValue = ZonderLeerplandoelReden.GeenDoelInOpstap;
            ctx.Leerplandoelen.Add(Leerdoel("2.1.GL3.10", "4-2.1.7"));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);
        var pagina = await sut.ZoekAsync(new MinimumdoelFilter());

        var metDoel = pagina.Regels.Single(r => r.Ref == "4-2.1.7");
        var zonder = pagina.Regels.Single(r => r.Ref == "6-7.1.6");
        Assert.Null(metDoel.ZonderLeerplandoelReden);
        Assert.Empty(metDoel.ZonderLeerplandoelDoelsets);
        Assert.Equal(0, zonder.AantalLeerplandoelen);
        Assert.Empty(zonder.JaarFasen);
        Assert.Equal(ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets, zonder.ZonderLeerplandoelReden);
        Assert.Equal(["V", "Z"], zonder.ZonderLeerplandoelDoelsets);

        Assert.Null((await sut.HaalDetailAsync("4-2.1.7"))!.ZonderLeerplandoelReden);
        Assert.Equal(["V", "Z"], (await sut.HaalDetailAsync("6-7.1.6"))!.ZonderLeerplandoelDoelsets);
    }

    [Fact]
    public async Task Het_detail_geeft_de_leerplandoelen_per_jaarfase_onder_elke_jaarfase_in_volgorde()
    {
        var options = Options();
        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.Add(new Discipline("1", "Nederlands en communicatie"));
            ctx.Minimumdoelen.Add(Md("4-1.1.1", "Nederlands", "Lezen", "Vlot en vloeiend lezen", MinimumdoelSoort.TeBereikenIndividueel));
            var vervallen = Leerdoel("1.1.GL2.3", "4-1.1.1", "L2");
            ctx.Leerplandoelen.AddRange(Leerdoel("1.1.GL1.10", "4-1.1.1", "L1"), vervallen, Leerdoel("1.1.GL1.9", "4-1.1.1", "L1"));
            ctx.Entry(vervallen).Property(l => l.NietMeerInOpstap).CurrentValue = true;
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var detail = await new MinimumdoelenQuery(query).HaalDetailAsync("4-1.1.1");

        Assert.NotNull(detail);
        Assert.Equal(("Nederlands", "Lezen", "Vlot en vloeiend lezen"), (detail.Leergebied, detail.Rubriek, detail.Subrubriek));
        Assert.Equal(MinimumdoelSoort.TeBereikenIndividueel, detail.Soort);
        Assert.Equal(3, detail.AantalLeerplandoelen);
        // Every jaar/fase, in order, so the screen can draw the whole row without a vocabulary of its own.
        Assert.Equal(Jaarfasen.Alle, detail.JaarFasen.Select(f => f.JaarFase).ToArray());
        var l1 = detail.JaarFasen.Single(f => f.JaarFase == "L1").Leerplandoelen;
        Assert.Equal(["1.1.GL1.9", "1.1.GL1.10"], l1.Select(l => l.Code).ToArray());
        Assert.Equal("Nederlands en communicatie", l1[0].DisciplineNaam);
        Assert.True(detail.JaarFasen.Single(f => f.JaarFase == "L2").Leerplandoelen.Single().NietMeerInOpstap);
        Assert.Empty(detail.JaarFasen.Single(f => f.JaarFase == "JK").Leerplandoelen);
        Assert.Null(detail.ZonderLeerplandoelReden);
    }

    [Fact]
    public async Task Het_detail_van_een_ref_die_niet_bestaat_is_er_niet()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        Assert.Null(await sut.HaalDetailAsync("K-9.9.9"));
        Assert.Null(await sut.HaalDetailAsync(" "));
    }

    /// <summary>Right after the minimumdoelen import no leerplandoel exists yet, and the register still lists every minimumdoel.</summary>
    [Fact]
    public async Task Zonder_enig_leerplandoel_staan_alle_minimumdoelen_in_de_lijst()
    {
        var options = await MetDecreetAsync();
        await using var query = new AppDbContext(options);

        var pagina = await new MinimumdoelenQuery(query).ZoekAsync(new MinimumdoelFilter());

        Assert.Equal(9, pagina.Totaal);
        Assert.All(pagina.Regels, r => Assert.Equal(0, r.AantalLeerplandoelen));
    }
}
