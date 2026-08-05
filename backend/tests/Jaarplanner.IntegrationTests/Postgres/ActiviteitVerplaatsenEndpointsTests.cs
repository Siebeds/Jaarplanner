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
/// E4-08 (FR-7.2, Art. IX.2): an activiteit moves to another subthema over HTTP, and everything a
/// delete-and-retype would have destroyed comes with it.
/// <para>
/// <b>Against real PostgreSQL, and here that is not ceremony.</b> The whole story is a re-parenting write plus a
/// class-scoped read, which is exactly the shape <b>E7-16</b> exists for: the in-memory provider enforces no FK
/// and answers a different query, so it cannot show that the owned <c>DoelKoppeling</c> rows follow their
/// activiteit to a new parent, nor that the destination projection translates at all.
/// </para>
/// <para>
/// <b>The starting state is seeded over the API, not through the DbContext</b>, unlike its dekking sibling. The
/// premise of every test here is "content a teacher created with the screens", and those endpoints
/// (<c>POST /api/themas</c>, <c>…/subthemas</c>, <c>…/activiteiten</c>, <c>…/doelkoppelingen</c>) are the same
/// ones E1-14 drives. A hand-seeded aggregate would let the move pass over rows no screen can produce.
/// </para>
/// <para>
/// The one exception is the <c>Themaplaatsing</c> in the dekking test, which stands for what a generation run
/// left behind and is written through the context for the reason its own comment gives there.
/// </para>
/// </summary>
public sealed class ActiviteitVerplaatsenEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("activiteitverhuis");
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
    public async Task Verhuizen_naar_een_ander_thema_van_dezelfde_klas_behoudt_hoek_uitkomsten_en_koppelingen()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var bron = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", opzet.KlasId, "K3");
        var doel = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", opzet.KlasId, "K3");
        var activiteitId = await MaakActiviteitAsync(client, bron.SubthemaId, "Waterproef", "ontdektafel", "kind benoemt drijven en zinken");
        await KoppelAsync(client, activiteitId, "VER-01");
        await KoppelAsync(client, activiteitId, "VER-02");

        var verhuis = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/subthema",
            new { doelSubthemaId = doel.SubthemaId });

        Assert.Equal(HttpStatusCode.OK, verhuis.StatusCode);
        var na = await verhuis.Content.ReadFromJsonAsync<ActiviteitDto>();

        // The answer itself already carries the evidence: same identity, same attributes, both links.
        Assert.NotNull(na);
        Assert.Equal(activiteitId, na!.Id);
        Assert.Equal("Waterproef", na.Naam);
        Assert.Equal("ontdektafel", na.Hoek);
        Assert.Equal("kind benoemt drijven en zinken", na.VerwachteUitkomsten);
        Assert.Equal(["VER-01", "VER-02"], na.Doelkoppelingen.Select(k => k.LeerplandoelCode).OrderBy(c => c));

        // And it is in the database rather than only in the response: two class-scoped reads, one thema each.
        var bronNa = await LeesVoorKlasAsync(client, bron.ThemaId, opzet.KlasId);
        Assert.Empty(bronNa.Subthemas.Single().Activiteiten);

        var doelNa = await LeesVoorKlasAsync(client, doel.ThemaId, opzet.KlasId);
        var verhuisd = Assert.Single(doelNa.Subthemas.Single().Activiteiten);
        Assert.Equal(activiteitId, verhuisd.Id);
        Assert.Equal("ontdektafel", verhuisd.Hoek);

        // The links are owned rows in their own table, so this is the assertion the in-memory provider cannot make:
        // they were re-parented with the activiteit rather than orphaned or cascaded away.
        Assert.Equal(2, verhuisd.Doelkoppelingen.Count);
        Assert.All(verhuisd.Doelkoppelingen, k => Assert.Equal("Manueel", k.Status));
    }

    [PostgresFact]
    public async Task Verhuizen_naar_een_subthema_van_een_andere_klas_wordt_geweigerd_en_verandert_niets()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var bron = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", opzet.KlasId, "K3");
        var vanAndereKlas = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", opzet.AndereKlasId, "K3");
        var activiteitId = await MaakActiviteitAsync(client, bron.SubthemaId, "Waterproef", "ontdektafel", null);
        await KoppelAsync(client, activiteitId, "VER-01");

        var verhuis = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/subthema",
            new { doelSubthemaId = vanAndereKlas.SubthemaId });

        Assert.Equal(HttpStatusCode.BadRequest, verhuis.StatusCode);

        // The refusal is a sentence a teacher can act on, in Dutch, and it is what the form renders verbatim
        // (Art. II.3 as ratified 2026-07-30). Asserted on the payload rather than on the status alone, because a
        // 400 carrying an English developer diagnostic is the defect E1-14's round 4 found on this same screen.
        var probleem = await verhuis.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.NotNull(probleem);
        Assert.Equal("Een activiteit kan alleen verhuizen naar een subthema van dezelfde klas.", probleem!.Detail);

        // Non-destructive: the activiteit is still where it was, with its link, and the other class received nothing.
        var bronNa = await LeesVoorKlasAsync(client, bron.ThemaId, opzet.KlasId);
        var gebleven = Assert.Single(bronNa.Subthemas.Single().Activiteiten);
        Assert.Equal(activiteitId, gebleven.Id);
        Assert.Single(gebleven.Doelkoppelingen);

        var andereKlasNa = await LeesVoorKlasAsync(client, vanAndereKlas.ThemaId, opzet.AndereKlasId);
        Assert.Empty(andereKlasNa.Subthemas.Single().Activiteiten);
    }

    [PostgresFact]
    public async Task Een_verdwenen_bestemming_is_een_400_en_een_verdwenen_activiteit_een_404()
    {
        // The two "it is gone" cases must be distinguishable by **status**, because the screen has to answer them
        // differently and reading Dutch prose to tell them apart is not an option. The addressed resource is the
        // activiteit, so its absence is a 404 the screen acts on like a delete; a destination that a colleague
        // deleted meanwhile is a referenced resource, so it is a refusal the picker shows while staying open.
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var bron = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", opzet.KlasId, "K3");
        var activiteitId = await MaakActiviteitAsync(client, bron.SubthemaId, "Waterproef", null, null);

        var weg = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/subthema",
            new { doelSubthemaId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, weg.StatusCode);
        var probleem = await weg.Content.ReadFromJsonAsync<ProbleemDto>();
        // The fact, without a remedy: only the screen knows whether another subthema exists to point at, and
        // when it does not, an instruction to choose one lands directly above a sentence saying there is none.
        Assert.Equal("Dit subthema bestaat niet meer.", probleem!.Detail);

        var geenActiviteit = await client.PutAsJsonAsync(
            $"/api/activiteiten/{Guid.NewGuid()}/subthema",
            new { doelSubthemaId = bron.SubthemaId });
        Assert.Equal(HttpStatusCode.NotFound, geenActiviteit.StatusCode);
    }

    [PostgresFact]
    public async Task De_bestemmingenlijst_geeft_alleen_de_subthemas_van_die_ene_klas()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var water = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", opzet.KlasId, "K3");
        var lucht = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", opzet.KlasId, "L1");
        var vanAndereKlas = await MaakThemaMetSubthemaAsync(client, "Vuur", "De vlam", opzet.AndereKlasId, "K3");

        var lijst = await client.GetFromJsonAsync<List<BestemmingDto>>($"/api/subthemas/voor-klas/{opzet.KlasId}");

        Assert.NotNull(lijst);

        // Both thema's of this klas are offered, so a move across thema's has somewhere to go (owner ruling
        // 2026-08-05), and the other klas's subthema is absent: the scope is the answer, not a filter on it.
        var ids = lijst!.Select(b => b.Id).ToList();
        Assert.Equal(2, ids.Count);
        Assert.Contains(water.SubthemaId, ids);
        Assert.Contains(lucht.SubthemaId, ids);
        Assert.DoesNotContain(vanAndereKlas.SubthemaId, ids);

        // Each entry names its thema, which is the only thing that tells two same-named subthema's apart, and its
        // leeftijd, because a move may cross that within one klas.
        var wind = lijst.Single(b => b.Id == lucht.SubthemaId);
        Assert.Equal("Lucht", wind.ThemaNaam);
        Assert.Equal("De wind", wind.Naam);
        Assert.Equal("L1", wind.Leeftijd);

        // Ordered by thema, then subthema: "Lucht" before "Water" under the database collation.
        Assert.Equal(["Lucht", "Water"], lijst.Select(b => b.ThemaNaam));
    }

    [PostgresFact]
    public async Task Verhuizen_naar_een_thema_dat_niet_in_het_jaarplan_staat_verlaagt_de_dekking()
    {
        // The consequence the owner's ruling brings with it, and the reason the copy has to say something: dekking
        // counts an activiteitkoppeling only while the thema it hangs under is placed in this class's jaarplan
        // (Art. V.1, EfDekkingOpslag layer 4). So a move that never leaves the klas can still take a doel out of
        // the figure. Measured rather than argued.
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var geplaatst = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", opzet.KlasId, "K3");
        var nietGeplaatst = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", opzet.KlasId, "K3");
        var activiteitId = await MaakActiviteitAsync(client, geplaatst.SubthemaId, "Waterproef", null, null);
        await KoppelAsync(client, activiteitId, "VER-01");

        var plaatsen = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen",
            new { themaId = geplaatst.ThemaId, blokStart = opzet.EersteBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.OK, plaatsen.StatusCode);

        var voor = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{opzet.KlasId}/dekking");
        Assert.Equal(1, voor!.AantalGedekt);
        Assert.Equal(["Water"], voor.Doelen.Single(d => d.Code == "VER-01").DekkendeThemas);

        var verhuis = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/subthema",
            new { doelSubthemaId = nietGeplaatst.SubthemaId });
        Assert.Equal(HttpStatusCode.OK, verhuis.StatusCode);

        var na = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{opzet.KlasId}/dekking");
        Assert.Equal(0, na!.AantalGedekt);
        Assert.False(na.Doelen.Single(d => d.Code == "VER-01").IsGedekt);
    }

    [PostgresFact]
    public async Task Een_onbekende_klas_wordt_geweigerd_en_niet_als_een_lege_lijst_beantwoord()
    {
        // An empty list and "this klas does not exist" are different facts, and the picker cannot tell them
        // apart: it reads an empty list as "there is nowhere to move to" and hides the control, which turns an
        // infrastructure state into a statement about the school's content (antagonist round 1).
        await ZetOpAsync();
        var client = _factory.CreateClient();

        var antwoord = await client.GetAsync($"/api/subthemas/voor-klas/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.BadRequest, antwoord.StatusCode);
        var probleem = await antwoord.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Equal("Die klas bestaat niet meer. Kies een klas uit de lijst.", probleem!.Detail);
    }

    [PostgresFact]
    public async Task Twee_themas_met_dezelfde_naam_blijven_gescheiden_in_de_bestemmingenlijst()
    {
        /*
          `Thema.Naam` carries no unique index, so two thema's may share a naam, and ordering on the naam alone
          let their subthema's interleave: one thema's rows split around another's.

          Pinned as a property of the **answer** rather than of any consumer: every thema's rows are contiguous,
          whatever the names are. That wording matters, because the client no longer depends on it. The first fix
          for this paired the tie-break with a picker that grouped by *consecutive* thema id, where interleaving
          produced two groups with the same id and label; that picker now groups on a keyed map, so this test
          pins the ordering it asked for and the client half is defence in depth (round 2, MINOR 6).
        */
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // Names chosen so that ordering by subthema naam alone would interleave them: A1, B1, A2, B2.
        var een = await MaakThemaMetSubthemaAsync(client, "Water", "Aa", opzet.KlasId, "K3");
        var twee = await MaakThemaMetSubthemaAsync(client, "Water", "Bb", opzet.KlasId, "K3");
        await VoegSubthemaToeAsync(client, een.ThemaId, "Cc", opzet.KlasId, "K3");
        await VoegSubthemaToeAsync(client, twee.ThemaId, "Dd", opzet.KlasId, "K3");

        var lijst = await client.GetFromJsonAsync<List<BestemmingDto>>($"/api/subthemas/voor-klas/{opzet.KlasId}");

        var idsInOrde = lijst!.Select(b => b.ThemaId).ToList();
        Assert.Equal(4, idsInOrde.Count);

        // Contiguous: the number of blocks equals the number of distinct thema's.
        var blokken = idsInOrde.Where((id, i) => i == 0 || id != idsInOrde[i - 1]).Count();
        Assert.Equal(idsInOrde.Distinct().Count(), blokken);
    }

    // --- Setup helpers. ---

    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        foreach (var code in new[] { "VER-01", "VER-02" })
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

        // Truncated to fit Schooljaar.Naam's varchar(32), as its dekking sibling does.
        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", leerjaar: 0);
        var andere = schooljaar.VoegKlasToe($"L1-{Guid.NewGuid():N}", leerjaar: 1);
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau);

        return new Opzet(klas.Id, andere.Id, blokken[0].Start);
    }

    private static async Task<ThemaMetSubthema> MaakThemaMetSubthemaAsync(
        HttpClient client,
        string themaNaam,
        string subthemaNaam,
        Guid klasId,
        string leeftijd)
    {
        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = themaNaam, duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();

        var subResp = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = subthemaNaam,
            duurWeken = 2,
            klasId,
            leeftijd,
        });
        Assert.Equal(HttpStatusCode.Created, subResp.StatusCode);
        var subthema = await subResp.Content.ReadFromJsonAsync<SubthemaDto>();

        return new ThemaMetSubthema(thema.Id, subthema!.Id);
    }

    private static async Task VoegSubthemaToeAsync(
        HttpClient client,
        Guid themaId,
        string naam,
        Guid klasId,
        string leeftijd)
    {
        var resp = await client.PostAsJsonAsync($"/api/themas/{themaId}/subthemas", new
        {
            naam,
            duurWeken = 2,
            klasId,
            leeftijd,
        });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
    }

    private static async Task<Guid> MaakActiviteitAsync(
        HttpClient client,
        Guid subthemaId,
        string naam,
        string? hoek,
        string? verwachteUitkomsten)
    {
        var resp = await client.PostAsJsonAsync($"/api/subthemas/{subthemaId}/activiteiten", new
        {
            naam,
            activiteitType = nameof(ActiviteitType.Experiment),
            hoek,
            verwachteUitkomsten,
        });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var activiteit = await resp.Content.ReadFromJsonAsync<ActiviteitDto>();
        return activiteit!.Id;
    }

    private static async Task KoppelAsync(HttpClient client, Guid activiteitId, string code)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/doelkoppelingen",
            new { leerplandoelCode = code });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    private static async Task<ThemaWeergaveDto> LeesVoorKlasAsync(HttpClient client, Guid themaId, Guid klasId)
    {
        var weergave = await client.GetFromJsonAsync<ThemaWeergaveDto>($"/api/themas/{themaId}/voor-klas/{klasId}");
        Assert.NotNull(weergave);
        return weergave!;
    }

    private sealed record Opzet(Guid KlasId, Guid AndereKlasId, DateOnly EersteBlok);

    private sealed record ThemaMetSubthema(Guid ThemaId, Guid SubthemaId);

    private sealed record ThemaDto(Guid Id);

    private sealed record SubthemaDto(Guid Id);

    private sealed record ActiviteitDto(
        Guid Id,
        string Naam,
        string? Hoek,
        string? VerwachteUitkomsten,
        List<KoppelingDto> Doelkoppelingen);

    private sealed record KoppelingDto(string LeerplandoelCode, string Status);

    private sealed record ThemaWeergaveDto(List<SubthemaWeergaveDto> Subthemas);

    private sealed record SubthemaWeergaveDto(Guid Id, List<ActiviteitDto> Activiteiten);

    private sealed record BestemmingDto(Guid Id, string Naam, string Leeftijd, Guid ThemaId, string ThemaNaam);

    private sealed record ProbleemDto(string? Detail);

    private sealed record DekkingDto(int? AantalGedekt, List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas);
}
