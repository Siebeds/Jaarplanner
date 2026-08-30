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
/// E9-06 (FR-9.1): <c>GET …/dekking/voortgang</c> — the two coverage figures without the per-doel list, for the
/// progress bar a teacher watches while linking doelen.
/// <para>
/// <b>The story these tests exist to protect is a copy problem as much as a computation.</b> A doel is covered when a
/// link the teacher stands behind hangs off a thema that is <i>placed in the plan</i> (Art. V.1), so while a teacher
/// links doelen to an unplaced thema the honest figure does not move. The ceiling is what makes that work visible — and
/// it is not coverage (Art. IV.1). Both halves are asserted here, because a screen built on only one of them would
/// either look broken or overclaim.
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
    /// <b>The story's central claim.</b> A thema carrying a linked doel, placed but only <c>Voorgesteld</c>, covers
    /// nothing today and raises the ceiling — so a teacher sees their work reflected without the tool calling an AI
    /// proposal "gedekt" (Art. IV.1/V.1).
    /// </summary>
    [PostgresFact]
    public async Task Een_voorgestelde_plaatsing_dekt_niets_maar_verhoogt_het_plafond()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Voorgesteld);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.True(voortgang!.IsBetrouwbaar);
        Assert.Equal(0, voortgang.AantalGedekt);
        Assert.Equal(1, voortgang.AantalMogelijkGedekt);
    }

    /// <summary>
    /// Accepting the same placement moves the real figure up to the ceiling. This is the pair the bar draws: a solid
    /// segment that only a teacher's decision can grow, and a lighter one that says what accepting would reach.
    /// </summary>
    [PostgresFact]
    public async Task Een_aanvaarde_plaatsing_telt_wel_mee()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Aanvaard);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.Equal(1, voortgang!.AantalGedekt);
        Assert.Equal(1, voortgang.AantalMogelijkGedekt);
    }

    /// <summary>
    /// <b>The honest zero this endpoint has to be able to report.</b> A doel linked to a thema that sits in no period
    /// covers nothing and cannot be reached by accepting anything — which is exactly the state a teacher is in while
    /// they link doelen before generating. A bar built on this must say what is missing rather than look broken.
    /// </summary>
    [PostgresFact]
    public async Task Een_gekoppeld_maar_ongeplaatst_thema_beweegt_geen_van_beide_cijfers()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // A thema with a linked doel, and deliberately NO Themaplaatsing.
        await MaakThemaMetDoelAsync(client, opzet);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.Equal(0, voortgang!.AantalGedekt);
        Assert.Equal(0, voortgang.AantalMogelijkGedekt);
        Assert.Equal(1, voortgang.AantalLeerplandoelen);
    }

    /// <summary>
    /// <b>Both figures are withheld together</b> while a placement is stale (directie 2026-07-28). Withholding only one
    /// would let a screen print a ceiling beside a blank, which reads as coverage of zero — the opposite of what
    /// "we cannot tell you yet" means.
    /// </summary>
    [PostgresFact]
    public async Task Een_vervallen_plaatsing_houdt_beide_cijfers_tegen()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Aanvaard);

        // A placement pointing at a date that is not the start of any derived block: the stale state.
        await using (var context = _db.MaakContext())
        {
            var plan = await context.Jaarplannen.FirstAsync(j => j.KlasId == opzet.KlasId);
            var thema = await context.Themas.FirstAsync();
            plan.VoegPlaatsingToe(
                thema.Id,
                Planningsblokniveau.Themaperiode,
                opzet.EersteBlok.AddDays(3),
                KoppelingStatus.Voorgesteld);
            await context.SaveChangesAsync();
        }

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");

        Assert.False(voortgang!.IsBetrouwbaar);
        Assert.Null(voortgang.AantalGedekt);
        Assert.Null(voortgang.AantalMogelijkGedekt);
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
        await MaakGekoppeldThemaAsync(client, opzet, KoppelingStatus.Aanvaard);

        var voortgang = await client.GetFromJsonAsync<VoortgangDto>(
            $"/api/klassen/{opzet.KlasId}/dekking/voortgang");
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

    private async Task MaakGekoppeldThemaAsync(HttpClient client, Opzet opzet, KoppelingStatus status)
    {
        var themaId = await MaakThemaMetDoelAsync(client, opzet);

        await using var context = _db.MaakContext();
        var plan = await context.Jaarplannen.FirstOrDefaultAsync(j => j.KlasId == opzet.KlasId);
        if (plan is null)
        {
            plan = new Jaarplan(opzet.KlasId);
            context.Jaarplannen.Add(plan);
        }

        plan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, opzet.EersteBlok, status);
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A thema with a themadoel linked as <c>Manueel</c> — a link the teacher stands behind, so only the
    /// <i>placement</i>'s status is left to vary between tests.
    /// </summary>
    private static async Task<Guid> MaakThemaMetDoelAsync(HttpClient client, Opzet opzet)
    {
        var themaResp = await client.PostAsJsonAsync(
            "/api/themas",
            new { naam = $"Water {Guid.NewGuid():N}"[..20], duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<IdDto>();

        var koppel = await client.PostAsJsonAsync(
            $"/api/themas/{thema!.Id}/themadoelen",
            new { leerplandoelCode = "VOR-01" });
        Assert.Equal(HttpStatusCode.OK, koppel.StatusCode);

        return thema.Id;
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

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau);

        return new Opzet(klas.Id, andere.Id, blokken[0].Start);
    }

    private sealed record Opzet(Guid KlasId, Guid AndereKlasId, DateOnly EersteBlok);

    private sealed record IdDto(Guid Id);

    private sealed record VoortgangDto(
        string Bereik,
        bool IsBetrouwbaar,
        int AantalOnopgelosteVervallenPlaatsingen,
        int? AantalGedekt,
        int? AantalMogelijkGedekt,
        int AantalLeerplandoelen,
        int? AantalOnbereikbaar);

    private sealed record DekkingDto(string Bereik, int? AantalGedekt, int AantalLeerplandoelen);
}
