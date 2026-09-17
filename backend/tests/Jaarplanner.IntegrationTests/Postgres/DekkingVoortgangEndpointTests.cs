using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// E9-06 (FR-9.1): <c>GET …/dekking/voortgang</c> — the coverage figures without the per-doel list, for the
/// progress bar a teacher watches while linking doelen. The bar reads the leerplandoel figure; the minimumdoel
/// forecast beside it is pinned by <c>DekkingsvooruitzichtPostgresTests</c> (TB-052).
/// <para>
/// <b>The story these tests exist to protect is a copy problem as much as a computation.</b> A doel is covered when a
/// link the teacher stands behind hangs off a thema that is <i>placed in the plan</i> (Art. V.1), so while a teacher
/// links doelen to an unplaced thema the honest figure does not move, and a bar built on it must say what is missing
/// rather than look broken.
/// </para>
/// </summary>
public sealed class DekkingVoortgangEndpointTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("voortgang");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>
    /// The payload is figures only. Asserted as an <b>absence</b>, because the whole reason this endpoint exists beside
    /// <c>GET …/dekking</c> is that the latter returns the entire in-scope curriculum unpaged — thousands of rows to
    /// move a bar by one. If a later change starts shipping the list here, this endpoint has quietly become the
    /// expensive one it was built to avoid.
    /// </summary>
    [PostgresFact]
    public async Task De_voortgang_bevat_geen_doelenlijst()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var rauw = await client.GetStringAsync($"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.DoesNotContain("\"doelen\"", rauw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"dekkendeThemas\"", rauw, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Since ADR-0052 no thema placement reaches a leerplandoel: whatever the placement's status, the leerplandoel of
    /// the thema's subthema is covered only once that subthema is in the agenda (Art. V.1).
    /// </summary>
    [PostgresTheory]
    [InlineData(KoppelingStatus.Voorgesteld)]
    [InlineData(KoppelingStatus.Aanvaard)]
    public async Task Een_themaplaatsing_alleen_beweegt_het_leerplandoelcijfer_niet(KoppelingStatus status)
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, status, subthemaIngepland: false);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.True(voortgang!.IsBetrouwbaar);
        Assert.Equal(0, voortgang.AantalGedekt);
    }

    /// <summary>
    /// The subthema placed in the agenda covers its subdoel.
    /// </summary>
    [PostgresFact]
    public async Task Een_ingepland_subthema_telt_in_het_leerplandoelcijfer()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Voorgesteld, subthemaIngepland: true);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.Equal(1, voortgang!.AantalGedekt);
    }

    /// <summary>
    /// <b>The honest zero this endpoint has to be able to report.</b> A doel linked to a thema that sits in no period
    /// covers nothing and cannot be reached by accepting anything — which is exactly the state a teacher is in while
    /// they link doelen before generating. A bar built on this must say what is missing rather than look broken.
    /// </summary>
    [PostgresFact]
    public async Task Een_gekoppeld_maar_ongeplaatst_thema_beweegt_het_leerplandoelcijfer_niet()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // A thema with a linked doel, and deliberately NO Themaplaatsing.
        await MaakThemaMetDoelAsync(client, opzet);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.Equal(0, voortgang!.AantalGedekt);
        Assert.Equal(1, voortgang.AantalLeerplandoelen);
    }

    /// <summary>
    /// <b>Every figure is withheld together</b> while a placement is stale (directie 2026-07-28). Withholding only one
    /// would let a screen print a ceiling beside a blank, which reads as coverage of zero — the opposite of what
    /// "we cannot tell you yet" means.
    /// </summary>
    [PostgresFact]
    public async Task Een_vervallen_plaatsing_houdt_alle_cijfers_tegen()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Aanvaard, subthemaIngepland: true);

        // A placement reaching outside the school year: the vervallen state.
        await using (var context = _db.MaakContext())
        {
            var plan = await context.Jaarplannen.FirstAsync(j => j.KlasId == opzet.KlasId);
            var thema = await context.Themas.FirstAsync();
            plan.VoegPlaatsingToe(
                thema.Id,
                opzet.EersteBlok.AddDays(-20),
                opzet.EersteBlok.AddDays(-10),
                KoppelingStatus.Voorgesteld);
            await context.SaveChangesAsync();
        }

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.False(voortgang!.IsBetrouwbaar);
        Assert.Null(voortgang.AantalGedekt);
        Assert.Null(voortgang.AantalMinimumdoelenGedekt);
        Assert.Null(voortgang.AantalMinimumdoelenMogelijkGedekt);
        Assert.True(voortgang.AantalOnopgelosteVervallenPlaatsingen > 0);
    }

    /// <summary>
    /// It is the <b>same</b> computation as the dekkingsoverzicht's, not a cheaper approximation. A screen showing the
    /// bar and the overview at once must not be able to show two different numbers for the same plan.
    /// </summary>
    [PostgresFact]
    public async Task De_voortgang_geeft_hetzelfde_cijfer_als_het_dekkingsoverzicht()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Aanvaard, subthemaIngepland: true);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");
        Assert.Equal(1, voortgang!.AantalGedekt);
        var overzicht = await client.GetFromJsonAsync<DekkingDto>(
            $"/api/klassen/{opzet.KlasId}/dekking");

        Assert.Equal(overzicht!.AantalGedekt, voortgang!.AantalGedekt);
        Assert.Equal(overzicht.AantalLeerplandoelen, voortgang.AantalLeerplandoelen);
        Assert.Equal(overzicht.Bereik, voortgang.Bereik);
    }

    /// <summary>
    /// <b>0 of 0 is not success.</b> A class whose jaar/fase has no imported doelen yet must report a denominator of 0,
    /// so a bar cannot render it as 100%. E5-02 recorded this as a live case: an L3 class with only kleuterdoelen
    /// loaded.
    /// </summary>
    [PostgresFact]
    public async Task Een_klas_zonder_doelen_in_bereik_rapporteert_nul_als_noemer()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // The seeded doel is K3; this class is L3, so its own scope contains nothing.
        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.AndereKlasId}/dekking/voortgang");

        Assert.Equal(0, voortgang!.AantalLeerplandoelen);
        Assert.Equal(0, voortgang.AantalGedekt);
    }

    private async Task MaakGekoppeldThemaAsync(HttpClient client, Opzet opzet, KoppelingStatus status, bool subthemaIngepland)
    {
        var (themaId, subthemaId) = await MaakThemaMetDoelAsync(client, opzet);

        await using var context = _db.MaakContext();
        var plan = await context.Jaarplannen.FirstOrDefaultAsync(j => j.KlasId == opzet.KlasId);
        if (plan is null)
        {
            plan = new Jaarplan(opzet.KlasId);
            context.Jaarplannen.Add(plan);
        }

        plan.VoegPlaatsingToe(themaId, opzet.EersteBlok, opzet.EersteBlok.AddDays(25), status);
        await context.SaveChangesAsync();

        if (subthemaIngepland)
        {
            context.Subthemaplaatsingen.Add(new Subthemaplaatsing(plan.Id, subthemaId, opzet.EersteBlok, opzet.EersteBlok.AddDays(11)));
            await context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// A thema with a K3 subthema whose subdoel links <c>VOR-01</c> as <c>Manueel</c>: a link the teacher stands behind,
    /// so only the placements are left to vary between tests (Art. V.1, ADR-0047).
    /// </summary>
    private async Task<(Guid ThemaId, Guid SubthemaId)> MaakThemaMetDoelAsync(HttpClient client, Opzet opzet)
    {
        var themaResp = await client.PostAsJsonAsync(
            "/api/themas",
            new { naam = $"Water {Guid.NewGuid():N}"[..20], duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<IdDto>();

        await using (var context = _db.MaakContext())
        {
            var geladen = await context.Themas.Include(t => t.Subthemas).SingleAsync(t => t.Id == thema!.Id);
            var subthema = geladen.VoegSubthemaToe("Regen", 2, "K3");
            subthema.VoegSubdoelToe("K3", new DoelKoppeling("VOR-01", KoppelingStatus.Manueel));
            await context.SaveChangesAsync();
            return (thema!.Id, subthema.Id);
        }
    }

    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        if (!await context.Leerplandoelen.AnyAsync(l => l.Code == "VOR-01"))
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                "VOR-01",
                Doelsoort.Gemeenschappelijk,
                "K3",
                "Natuur",
                "Levende natuur",
                "9.1",
                tekst: "Tekst van VOR-01"));
        }

        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        var andere = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        return new Opzet(klas.Id, andere.Id, schooljaar.Start);
    }

    private sealed record Opzet(Guid KlasId, Guid AndereKlasId, DateOnly EersteBlok);

    private sealed record IdDto(Guid Id);

    private sealed record VoortgangDto(
        string Bereik,
        bool IsBetrouwbaar,
        int AantalOnopgelosteVervallenPlaatsingen,
        int? AantalGedekt,
        int AantalLeerplandoelen,
        int? AantalMinimumdoelenGedekt,
        int? AantalMinimumdoelenMogelijkGedekt);

    private sealed record DekkingDto(string Bereik, int? AantalGedekt, int AantalLeerplandoelen);
}
