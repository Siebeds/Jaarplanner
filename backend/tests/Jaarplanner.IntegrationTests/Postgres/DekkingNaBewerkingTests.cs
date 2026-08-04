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
/// E4-01 (FR-6.5, FR-7, Art. V.1): every manual edit is persisted at once, and the next dekking read already
/// accounts for it. <b>One HTTP write, then one HTTP read, with nothing in between.</b>
/// <para>
/// <b>Why a separate file rather than more cases in <see cref="DekkingEndpointsTests"/>.</b> That file seeds
/// placements straight through the <c>DbContext</c> and reads the figure, which proves the read path. It cannot
/// prove this story's criterion, because the criterion is about a <i>sequence</i>: the teacher edits, and no save
/// step exists anywhere for them to forget. Every test here therefore drives the same endpoints the kalender
/// drives (<c>POST …/plaatsingen</c>, <c>PUT …/status</c>, <c>PUT …/blok</c>, <c>DELETE …/plaatsingen/{id}</c>)
/// and then asks <c>GET …/dekking</c> for the consequence. The absence of an intermediate call is the assertion;
/// it is expressed by construction, so a later refactor that introduced a "save" or an invalidation step would
/// have nowhere to put it in these tests without changing them.
/// </para>
/// <para>
/// <b>Against real PostgreSQL, deliberately (E7-16).</b> Dekking is computed by a query over four
/// <c>DoelKoppeling</c> layers, and this project has now been bitten six times by a write path that only ever ran
/// on the in-memory provider. A story whose whole content is "the figure follows the edit" cannot be evidenced by
/// a provider that answers a different query.
/// </para>
/// <para>
/// <b>What is deliberately not here.</b> No claim about a screen: what a teacher sees is E5-02's page, verified in
/// a browser as part of this story rather than asserted here. And no minimumdoel level (E5-04, blocked on E1-12),
/// so every figure below is leerplandoel-level.
/// </para>
/// </summary>
public sealed class DekkingNaBewerkingTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("dekkingbewerking");
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

    [PostgresFact]
    public async Task Een_handmatige_plaatsing_dekt_haar_doel_bij_de_eerstvolgende_read()
    {
        // FR-7.2 + FR-7 in one sequence, and the case with no AI anywhere in it: a class that has never generated,
        // a thema placed by hand, and a coverage figure that has moved by the next read.
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var voor = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.Equal(0, voor.AantalGedekt);
        Assert.Equal(2, voor.AantalLeerplandoelen);

        var plaatsen = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen",
            new { themaId = opzet.HerfstThemaId, blokStart = opzet.EersteBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.OK, plaatsen.StatusCode);

        var na = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.Equal(1, na.AantalGedekt);

        // The figure names its evidence, so this is not a count that happens to have changed for another reason.
        var gedekt = na.Doelen.Single(d => d.Code == "DEK-01");
        Assert.True(gedekt.IsGedekt);
        Assert.Equal(["Herfstthema"], gedekt.DekkendeThemas);

        // And the goal this thema does not carry is untouched: the edit moved the figure by exactly one.
        Assert.False(na.Doelen.Single(d => d.Code == "DEK-02").IsGedekt);
    }

    [PostgresFact]
    public async Task Een_aanvaarding_verhoogt_het_cijfer_bij_de_eerstvolgende_read()
    {
        // The transition E4-02 measured by hand against a browser and nothing pinned: `Voorgesteld` covers nothing
        // (Art. IV.1), the teacher's acceptance is what makes it count (Art. V.1). Pinned here so the two halves
        // cannot drift apart, since only their combination is what a teacher experiences.
        var opzet = await ZetOpAsync();
        var plaatsingId = await ZetPlaatsingOpAsync(opzet, KoppelingStatus.Voorgesteld, opzet.EersteBlok);
        var client = _factory.CreateClient();

        Assert.Equal(0, (await HaalDekkingAsync(client, opzet.KlasId)).AantalGedekt);

        var beslissing = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}/status",
            new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.OK, beslissing.StatusCode);

        var na = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.Equal(1, na.AantalGedekt);
        Assert.Equal(["Herfstthema"], na.Doelen.Single(d => d.Code == "DEK-01").DekkendeThemas);
    }

    [PostgresFact]
    public async Task Een_versleept_AI_voorstel_gaat_meteen_meetellen_want_het_wordt_manueel()
    {
        // The interaction E4-01's story entry warns about, asserted rather than described: a drag sets the placement
        // to `manueel` (`Themaplaatsing.VerplaatsNaar`) and `manueel` counts, so moving a standing proposal RAISES
        // the coverage figure as a side effect of the move. It is correct under Art. V.1 and it is also the kind of
        // consequence a teacher must be told about, which is why the card discloses it before the drag.
        var opzet = await ZetOpAsync();
        var plaatsingId = await ZetPlaatsingOpAsync(opzet, KoppelingStatus.Voorgesteld, opzet.EersteBlok);
        var client = _factory.CreateClient();

        Assert.Equal(0, (await HaalDekkingAsync(client, opzet.KlasId)).AantalGedekt);

        var verplaatsen = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}/blok",
            new { blokStart = opzet.TweedeBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.OK, verplaatsen.StatusCode);

        var na = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.Equal(1, na.AantalGedekt);
        Assert.True(na.IsBetrouwbaar);
    }

    [PostgresFact]
    public async Task Het_uit_de_periode_halen_verlaagt_het_cijfer_bij_de_eerstvolgende_read()
    {
        // The other direction, which is the half a cache would break most quietly: a teacher removes a thema and the
        // overview keeps claiming coverage the plan no longer has. For an inspectie-facing figure that is the wrong
        // way round to be stale, so it is asserted at the HTTP boundary an export would read.
        var opzet = await ZetOpAsync();
        var plaatsingId = await ZetPlaatsingOpAsync(opzet, KoppelingStatus.Manueel, opzet.EersteBlok);
        var client = _factory.CreateClient();

        Assert.Equal(1, (await HaalDekkingAsync(client, opzet.KlasId)).AantalGedekt);

        var verwijderen = await client.DeleteAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}");
        Assert.Equal(HttpStatusCode.OK, verwijderen.StatusCode);

        var na = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.Equal(0, na.AantalGedekt);
        Assert.All(na.Doelen, d => Assert.False(d.IsGedekt));
    }

    [PostgresFact]
    public async Task Een_vervallen_plaatsing_die_opnieuw_geplaatst_wordt_geeft_het_cijfer_terug()
    {
        // The directie ruling of 2026-07-28, clause 4, in both directions and in one sequence: while a placement
        // points at a date that starts no period, the plan may report NO figure at all (E3-07/E5-01), and the moment
        // a human resolves it the figure comes back without any further step. The healing half had never been
        // verified: E5-01 proved the withholding, and nothing proved that resolving it releases the number.
        var opzet = await ZetOpAsync();
        var plaatsingId = await ZetPlaatsingOpAsync(
            opzet,
            KoppelingStatus.Aanvaard,
            // A date outside the school year, which no derived block can ever start on. Same device as
            // DekkingEndpointsTests: asserting the stale path against a guessed date is how a test drifts into
            // proving the other case while claiming this one.
            opzet.SchooljaarStart.AddMonths(-1));
        var client = _factory.CreateClient();

        var voor = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.False(voor.IsBetrouwbaar);
        Assert.Equal(1, voor.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Null(voor.AantalGedekt);

        var herplaatsen = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{plaatsingId}/blok",
            new { blokStart = opzet.EersteBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.OK, herplaatsen.StatusCode);

        var na = await HaalDekkingAsync(client, opzet.KlasId);
        Assert.True(na.IsBetrouwbaar);
        Assert.Equal(0, na.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Equal(1, na.AantalGedekt);
    }

    private static async Task<DekkingDto> HaalDekkingAsync(HttpClient client, Guid klasId)
    {
        var response = await client.GetAsync($"/api/klassen/{klasId}/dekking");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dekking = await response.Content.ReadFromJsonAsync<DekkingDto>();
        Assert.NotNull(dekking);

        return dekking;
    }

    /// <summary>
    /// A kleutergroep, two K3 leerplandoelen, and two thema's each anchored to one of them.
    /// <para>
    /// Two thema's rather than one, so every assertion below can show the figure moved by <i>exactly</i> the edit:
    /// with a single goal in scope, "1 of 1" is also what a service returning "everything is covered" would answer.
    /// The block starts are asked of the real <see cref="IPlanningsblokIndeling"/> seam rather than assumed, for the
    /// reason spelled out on <c>DekkingEndpointsTests</c>.
    /// </para>
    /// </summary>
    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        foreach (var code in new[] { "DEK-01", "DEK-02" })
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code,
                    Doelsoort.Gemeenschappelijk,
                    "K3",
                    "Natuur",
                    "Levende natuur",
                    "9.1",
                    tekst: $"Tekst van {code}"));
            }
        }

        // Truncated to fit Schooljaar.Naam's varchar(32).
        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", leerjaar: 0);
        context.Schooljaren.Add(schooljaar);

        var herfst = new Thema("Herfstthema", duurWeken: 5);
        herfst.VoegThemadoelToe(new DoelKoppeling("DEK-01", KoppelingStatus.Aanvaard, "anchor"));
        var winter = new Thema("Winterthema", duurWeken: 5);
        winter.VoegThemadoelToe(new DoelKoppeling("DEK-02", KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.AddRange(herfst, winter);

        await context.SaveChangesAsync();

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau);

        return new Opzet(
            klas.Id,
            herfst.Id,
            winter.Id,
            schooljaar.Start,
            blokken[0].Start,
            blokken[1].Start);
    }

    /// <summary>
    /// One placement of the herfstthema, written straight through the <c>DbContext</c> because it stands for what a
    /// <i>generation run</i> left behind. Only the edit under test goes over HTTP; seeding the starting state through
    /// the API would make each test depend on a second endpoint's behaviour for its premise.
    /// </summary>
    private async Task<Guid> ZetPlaatsingOpAsync(Opzet opzet, KoppelingStatus status, DateOnly blokStart)
    {
        await using var context = _db.MaakContext();

        var jaarplan = new Jaarplan(opzet.KlasId);
        var plaatsing = jaarplan.VoegPlaatsingToe(
            opzet.HerfstThemaId,
            JaarplanGeneratieService.GeneratieNiveau,
            blokStart,
            status,
            status == KoppelingStatus.Voorgesteld ? "past bij het begin van het schooljaar" : null);
        context.Jaarplannen.Add(jaarplan);

        await context.SaveChangesAsync();

        return plaatsing.Id;
    }

    private sealed record Opzet(
        Guid KlasId,
        Guid HerfstThemaId,
        Guid WinterThemaId,
        DateOnly SchooljaarStart,
        DateOnly EersteBlok,
        DateOnly TweedeBlok);

    private sealed record DekkingDto(
        bool IsBetrouwbaar,
        int AantalOnopgelosteVervallenPlaatsingen,
        int? AantalGedekt,
        int AantalLeerplandoelen,
        List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas);
}
