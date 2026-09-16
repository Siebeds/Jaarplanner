using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Dekking;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The coverage reads against <b>real PostgreSQL</b> (Art. V.1/V.6, ADR-0047).
/// <para>
/// <b>Why real Postgres and not the EF in-memory provider.</b> The reads are subqueries over collections nested up to
/// three levels deep (thema → subthema → activiteit → doelkoppeling). The in-memory provider evaluates that in LINQ, so
/// it says nothing about whether Npgsql can translate it; a single <c>Concat</c> over the layers once passed there and
/// threw on PostgreSQL (E5-01). Each layer is therefore its own query, and each gets a test that fails if it is
/// dropped, as does the leeftijd scoping and the placement of a subthema.
/// </para>
/// </summary>
public sealed class DekkingLagenPostgresTests : IAsyncLifetime
{
    private const string Leeftijd = "K3";
    private const string AndereLeeftijd = "L1";

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("dekking");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    // ── The thema-level route: accepted doelsuggesties of placed thema's ────────────────────────────────────────

    [PostgresFact]
    public async Task De_dekkende_lezing_levert_alleen_de_besliste_doelsuggesties_van_de_gevraagde_themas()
    {
        var zet = await ZetOpAsync((context, thema) =>
        {
            thema.VoegDoelsuggestieToe(new DoelKoppeling("SUG-AANVAARD", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Aanvaard);
            thema.VoegDoelsuggestieToe(new DoelKoppeling("SUG-MANUEEL", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Manueel);
            thema.VoegDoelsuggestieToe(new DoelKoppeling("SUG-VOORGESTELD", KoppelingStatus.Voorgesteld, "?"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("SUG-GEWEIGERD", KoppelingStatus.Voorgesteld, "nee"))
                .WijzigStatus(KoppelingStatus.Geweigerd);
            // D5: a themadoel that links a leerplandoel counts nowhere, however decided.
            thema.VoegThemadoelToe(new DoelKoppeling("THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));
            // The subthema layers have their own route; this read never returns them.
            var subthema = thema.VoegSubthemaToe("Bladeren", 2, Leeftijd);
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling("SUBDOEL", KoppelingStatus.Aanvaard));
            return Task.CompletedTask;
        });

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        var koppelingen = await opslag.HaalDekkendeKoppelingenAsync([zet.ThemaId]);
        Assert.Equal(
            ["SUG-AANVAARD", "SUG-MANUEEL"],
            koppelingen.Select(k => k.LeerplandoelCode).OrderBy(c => c, StringComparer.Ordinal));
        Assert.All(koppelingen, k => Assert.Equal(zet.ThemaNaam, k.ThemaNaam));

        Assert.Empty(await opslag.HaalDekkendeKoppelingenAsync([Guid.NewGuid()]));
        Assert.Empty(await opslag.HaalDekkendeKoppelingenAsync([]));
    }

    // ── The subthema route ──────────────────────────────────────────────────────────────────────────────────────

    [PostgresFact]
    public async Task De_subthemalezing_levert_besliste_subdoelen_en_activiteitdoelen_met_hun_inplanning()
    {
        var zet = await ZetOpAsync(async (context, thema) =>
        {
            var gepland = thema.VoegSubthemaToe("Bladeren", 2, Leeftijd);
            gepland.VoegSubdoelToe(Leeftijd, new DoelKoppeling("SUB-GEPLAND", KoppelingStatus.Aanvaard));
            gepland.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming)
                .VoegDoelkoppelingToe(new DoelKoppeling("ACT-GEPLAND", KoppelingStatus.Manueel));

            var nietGepland = thema.VoegSubthemaToe("Kastanjes", 2, Leeftijd);
            nietGepland.VoegSubdoelToe(Leeftijd, new DoelKoppeling("SUB-NIET-GEPLAND", KoppelingStatus.Manueel));
            nietGepland.VoegSubdoelToe(Leeftijd, new DoelKoppeling("SUB-VOORGESTELD", KoppelingStatus.Voorgesteld));
            nietGepland.VoegSubdoelToe(Leeftijd, new DoelKoppeling("SUB-GEWEIGERD", KoppelingStatus.Geweigerd));
            var activiteit = nietGepland.VoegActiviteitToe("Kastanjes rapen", ActiviteitType.Spel);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("ACT-VOORGESTELD", KoppelingStatus.Voorgesteld));

            var andereLeeftijd = thema.VoegSubthemaToe("Tellen", 2, AndereLeeftijd);
            andereLeeftijd.VoegSubdoelToe(AndereLeeftijd, new DoelKoppeling("SUB-L1", KoppelingStatus.Aanvaard));

            thema.VoegThemadoelToe(new DoelKoppeling("THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));
            await context.SaveChangesAsync();

            await PlaatsAsync(context, o => o.KlasId, gepland.Id);
        });

        await using var leescontext = _db.MaakContext();
        var rijen = await new EfDekkingOpslag(leescontext).HaalSubthemakoppelingenAsync(zet.KlasId);

        Assert.Equal(
            [
                new Subthemakoppeling("ACT-GEPLAND", zet.ThemaNaam, "Bladeren", true),
                new Subthemakoppeling("SUB-GEPLAND", zet.ThemaNaam, "Bladeren", true),
                new Subthemakoppeling("SUB-NIET-GEPLAND", zet.ThemaNaam, "Kastanjes", false),
            ],
            rijen.OrderBy(r => r.LeerplandoelCode, StringComparer.Ordinal));
    }

    [PostgresFact]
    public async Task Een_subthema_telt_alleen_als_ingepland_in_de_agenda_van_deze_klas()
    {
        Guid andereKlasId = Guid.Empty;
        var zet = await ZetOpAsync(async (context, thema) =>
        {
            var subthema = thema.VoegSubthemaToe("Bladeren", 2, Leeftijd);
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling("SUB-ELDERS-GEPLAND", KoppelingStatus.Aanvaard));
            await context.SaveChangesAsync();

            // A parallel K3 klas placed the subthema; this klas did not.
            await PlaatsAsync(context, o => o.AndereKlasId, subthema.Id);
        }, metAndereKlas: id => andereKlasId = id);

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        Assert.False(Assert.Single(await opslag.HaalSubthemakoppelingenAsync(zet.KlasId)).IsIngepland);
        Assert.True(Assert.Single(await opslag.HaalSubthemakoppelingenAsync(andereKlasId)).IsIngepland);
    }

    // ── The candidate read ──────────────────────────────────────────────────────────────────────────────────────

    [PostgresFact]
    public async Task De_kandidaatlezing_levert_suggesties_subdoelen_en_activiteitdoelen_zonder_weigeringen()
    {
        var zet = await ZetOpAsync((context, thema) =>
        {
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-SUGGESTIE", KoppelingStatus.Voorgesteld, "past"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-SUG-AANVAARD", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Aanvaard);
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-GEWEIGERD", KoppelingStatus.Voorgesteld, "nee"))
                .WijzigStatus(KoppelingStatus.Geweigerd);
            thema.VoegThemadoelToe(new DoelKoppeling("KAND-THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));

            var subthema = thema.VoegSubthemaToe("Bladeren", 2, Leeftijd);
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling("KAND-SUBDOEL", KoppelingStatus.Manueel));
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling("KAND-SUBDOEL-VOORGESTELD", KoppelingStatus.Voorgesteld));
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling("KAND-SUBDOEL-GEWEIGERD", KoppelingStatus.Geweigerd));
            var activiteit = subthema.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("KAND-ACTIVITEIT", KoppelingStatus.Voorgesteld));
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("KAND-ACT-GEWEIGERD", KoppelingStatus.Geweigerd));

            var andereLeeftijd = thema.VoegSubthemaToe("Tellen", 2, AndereLeeftijd);
            andereLeeftijd.VoegSubdoelToe(AndereLeeftijd, new DoelKoppeling("KAND-L1", KoppelingStatus.Aanvaard));
            return Task.CompletedTask;
        });

        await using var leescontext = _db.MaakContext();
        var kandidaten = await new EfDekkingOpslag(leescontext).HaalKandidaatKoppelingenAsync(zet.KlasId);

        Assert.Equal(
            [
                ("KAND-ACTIVITEIT", false, false),
                ("KAND-SUBDOEL", true, false),
                ("KAND-SUBDOEL-VOORGESTELD", false, false),
                ("KAND-SUG-AANVAARD", true, true),
                ("KAND-SUGGESTIE", false, true),
            ],
            kandidaten
                .Select(k => (k.LeerplandoelCode, k.IsBeslist, k.IsDoelsuggestie))
                .OrderBy(k => k.LeerplandoelCode, StringComparer.Ordinal));
        Assert.All(kandidaten, k => Assert.Equal(zet.ThemaId, k.ThemaId));
    }

    [PostgresFact]
    public async Task De_besliste_suggestiekandidaten_zeggen_hetzelfde_als_de_dekkende_lezing()
    {
        // WachtOpBeslissing leans on this: a decided doelsuggestie on a thema placed as accepted is covered by the
        // other read. Two queries apply one rule, so they are pinned against each other here.
        var zet = await ZetOpAsync((context, thema) =>
        {
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-SUGGESTIE-A", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Aanvaard);
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-SUGGESTIE-M", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Manueel);
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-ONBESLIST", KoppelingStatus.Voorgesteld, "?"));
            return Task.CompletedTask;
        });

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);
        var dekkend = await opslag.HaalDekkendeKoppelingenAsync([zet.ThemaId]);
        var kandidaten = await opslag.HaalKandidaatKoppelingenAsync(zet.KlasId);

        Assert.Equal(
            dekkend.Select(k => (k.LeerplandoelCode, k.ThemaNaam)).OrderBy(p => p.LeerplandoelCode, StringComparer.Ordinal),
            kandidaten
                .Where(k => k.IsBeslist && k.IsDoelsuggestie)
                .Select(k => (k.LeerplandoelCode, k.ThemaNaam))
                .OrderBy(p => p.LeerplandoelCode, StringComparer.Ordinal));
        Assert.Contains(kandidaten, k => k.LeerplandoelCode == "KAND-ONBESLIST" && !k.IsBeslist);
    }

    // ── Minimumdoelen ───────────────────────────────────────────────────────────────────────────────────────────

    [PostgresFact]
    public async Task De_minimumdoelen_van_een_thema_en_van_een_mijlpaal_komen_uit_Postgres()
    {
        var zet = await ZetOpAsync(async (context, thema) =>
        {
            await ZorgVoorMinimumdoelenAsync(context, ("DEK-K-1", "K-"), ("DEK-K-2", "K-"), ("DEK-4-1", "4-"));
            context.ThemaMinimumdoelen.AddRange(thema.KoppelMinimumdoel("DEK-K-1"), thema.KoppelMinimumdoel("DEK-4-1"));
        });

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        var koppelingen = (await opslag.HaalThemaMinimumdoelenAsync()).Where(k => k.ThemaId == zet.ThemaId);
        Assert.Equal(
            [new Themaminimumdoelkoppeling("DEK-4-1", zet.ThemaId, zet.ThemaNaam), new Themaminimumdoelkoppeling("DEK-K-1", zet.ThemaId, zet.ThemaNaam)],
            koppelingen.OrderBy(k => k.MinimumdoelRef, StringComparer.Ordinal));

        var kleuter = await opslag.HaalMinimumdoelenAsync(["K-"]);
        Assert.Contains(kleuter, m => m.Ref == "DEK-K-2");
        Assert.DoesNotContain(kleuter, m => m.Ref == "DEK-4-1");
        Assert.Contains(await opslag.HaalMinimumdoelenAsync(), m => m.Ref == "DEK-4-1");
        Assert.Empty(await opslag.HaalMinimumdoelenAsync([]));
    }

    // ── The whole computation over Postgres ─────────────────────────────────────────────────────────────────────

    [PostgresFact]
    public async Task Een_ingetrokken_doel_blijft_in_de_noemer_en_draagt_zijn_vlag()
    {
        await using (var context = _db.MaakContext())
        {
            await ZorgVoorDoelenAsync(context, ["NOG-IN-OPSTAP", "INGETROKKEN"]);
            var ingetrokken = await context.Leerplandoelen.SingleAsync(l => l.Code == "INGETROKKEN");
            context.Entry(ingetrokken).Property(l => l.NietMeerInOpstap).CurrentValue = true;
            await context.SaveChangesAsync();
        }

        await using var leescontext = _db.MaakContext();
        var doelen = await new EfDekkingOpslag(leescontext).HaalLeerplandoelenAsync();

        Assert.True(doelen.Single(d => d.Code == "INGETROKKEN").NietMeerInOpstap);
        Assert.False(doelen.Single(d => d.Code == "NOG-IN-OPSTAP").NietMeerInOpstap);
    }

    [PostgresFact]
    public async Task De_jaarfase_seam_filtert_echt_en_is_dus_geen_decoratie()
    {
        await using (var context = _db.MaakContext())
        {
            await ZorgVoorDoelenAsync(context, ["FASE-K3"], jaarFase: "K3");
            await ZorgVoorDoelenAsync(context, ["FASE-L6"], jaarFase: "L6");
        }

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        var alles = await opslag.HaalLeerplandoelenAsync();
        Assert.Contains(alles, d => d.Code == "FASE-K3");
        Assert.Contains(alles, d => d.Code == "FASE-L6");

        var alleenK3 = await opslag.HaalLeerplandoelenAsync(["K3"]);
        Assert.Contains(alleenK3, d => d.Code == "FASE-K3");
        Assert.DoesNotContain(alleenK3, d => d.Code == "FASE-L6");

        var leegIsGeenScope = await opslag.HaalLeerplandoelenAsync([]);
        Assert.Contains(leegIsGeenScope, d => d.Code == "FASE-L6");
    }

    [PostgresFact]
    public async Task De_disciplinenamen_komen_uit_de_geseede_referentietabel()
    {
        await using var context = _db.MaakContext();

        var namen = await new EfDekkingOpslag(context).HaalDisciplinenamenAsync();

        Assert.Equal("Wiskunde", namen["2"]);
        Assert.Equal("Veilige en gezonde levensstijl", namen["9.1"]);
    }

    // ── Arrange ─────────────────────────────────────────────────────────────────────────────────────────────────

    private sealed record Opzet(Guid KlasId, Guid AndereKlasId, Guid ThemaId, string ThemaNaam);

    /// <summary>
    /// A K3 klas and a parallel K3 klas in one schooljaar, each with a jaarplan, and one thema the arrange step fills.
    /// The arrange step may save and may place subthema's; the method saves afterwards either way.
    /// </summary>
    private async Task<Opzet> ZetOpAsync(
        Func<AppDbContext, Thema, Task> arrangeer,
        Action<Guid>? metAndereKlas = null)
    {
        await using var context = _db.MaakContext();
        await ZorgVoorDoelenAsync(context, AlleCodes);

        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", Leeftijd);
        var andereKlas = schooljaar.VoegKlasToe($"K3b-{Guid.NewGuid():N}", Leeftijd);
        context.Schooljaren.Add(schooljaar);
        context.Jaarplannen.AddRange(new Jaarplan(klas.Id), new Jaarplan(andereKlas.Id));

        var thema = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        context.Themas.Add(thema);
        await context.SaveChangesAsync();

        _huidig = new Opzet(klas.Id, andereKlas.Id, thema.Id, thema.Naam);
        metAndereKlas?.Invoke(andereKlas.Id);
        await arrangeer(context, thema);
        await context.SaveChangesAsync();
        return _huidig;
    }

    private Opzet _huidig = null!;

    /// <summary>Places a subthema in the agenda of the klas <paramref name="welke"/> picks.</summary>
    private async Task PlaatsAsync(AppDbContext context, Func<Opzet, Guid> welke, Guid subthemaId)
    {
        var klasId = welke(_huidig);
        var jaarplanId = await context.Jaarplannen.Where(j => j.KlasId == klasId).Select(j => j.Id).SingleAsync();
        context.Subthemaplaatsingen.Add(
            new Subthemaplaatsing(jaarplanId, subthemaId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25)));
        await context.SaveChangesAsync();
    }

    private static readonly string[] AlleCodes =
    [
        "SUG-AANVAARD", "SUG-MANUEEL", "SUG-VOORGESTELD", "SUG-GEWEIGERD", "THEMADOEL", "SUBDOEL",
        "SUB-GEPLAND", "ACT-GEPLAND", "SUB-NIET-GEPLAND", "SUB-VOORGESTELD", "SUB-GEWEIGERD", "ACT-VOORGESTELD",
        "SUB-L1", "SUB-ELDERS-GEPLAND",
        "KAND-SUGGESTIE", "KAND-SUG-AANVAARD", "KAND-GEWEIGERD", "KAND-THEMADOEL", "KAND-SUBDOEL",
        "KAND-SUBDOEL-VOORGESTELD", "KAND-SUBDOEL-GEWEIGERD", "KAND-ACTIVITEIT", "KAND-ACT-GEWEIGERD", "KAND-L1",
        "KAND-SUGGESTIE-A", "KAND-SUGGESTIE-M", "KAND-ONBESLIST",
    ];

    private static async Task ZorgVoorDoelenAsync(
        AppDbContext context,
        IEnumerable<string> codes,
        string jaarFase = "K3")
    {
        foreach (var code in codes)
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code,
                    Doelsoort.Gemeenschappelijk,
                    jaarFase,
                    "Natuur",
                    "Levende natuur",
                    "9.1",
                    tekst: $"Tekst van {code}"));
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task ZorgVoorMinimumdoelenAsync(AppDbContext context, params (string Ref, string Mijlpaal)[] doelen)
    {
        foreach (var (minimumdoelRef, mijlpaal) in doelen)
        {
            if (!await context.Minimumdoelen.AnyAsync(m => m.Ref == minimumdoelRef))
            {
                context.Minimumdoelen.Add(new Minimumdoel(minimumdoelRef, mijlpaal, "1", $"Tekst van {minimumdoelRef}"));
            }
        }

        await context.SaveChangesAsync();
    }
}
