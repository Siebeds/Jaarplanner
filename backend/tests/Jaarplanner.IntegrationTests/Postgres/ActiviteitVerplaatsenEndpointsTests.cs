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
    public async Task Verhuizen_naar_een_ander_thema_van_dezelfde_leeftijd_behoudt_hoek_uitkomsten_en_koppelingen()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var bron = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", "K3");
        var doel = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", "K3");
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

    /// <summary>
    /// <b>The boundary is the leeftijd (owner ruling, 2026-08-30), and this test used to say "klas".</b> It is
    /// rewritten rather than deleted: the state it arranges is the same one it always arranged, which is content
    /// a different class teaches, reached the only way that is still expressible. Under the amended Art. IX.2 a
    /// class no longer owns a subthema, so what separates two classes is the age they teach, and dropping the
    /// test would have left the move endpoint with no scope assertion at all for the eleven days it took anyone
    /// to notice.
    /// </summary>
    [PostgresFact]
    public async Task Verhuizen_naar_een_subthema_van_een_andere_leeftijd_wordt_geweigerd_en_verandert_niets()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var bron = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", "K3");
        var vanAndereLeeftijd = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", "L1");
        var activiteitId = await MaakActiviteitAsync(client, bron.SubthemaId, "Waterproef", "ontdektafel", null);
        await KoppelAsync(client, activiteitId, "VER-01");

        var verhuis = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/subthema",
            new { doelSubthemaId = vanAndereLeeftijd.SubthemaId });

        Assert.Equal(HttpStatusCode.BadRequest, verhuis.StatusCode);

        // The refusal is a sentence a teacher can act on, in Dutch, and it is what the form renders verbatim
        // (Art. II.3 as ratified 2026-07-30). Asserted on the payload rather than on the status alone, because a
        // 400 carrying an English developer diagnostic is the defect E1-14's round 4 found on this same screen.
        var probleem = await verhuis.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.NotNull(probleem);
        Assert.Equal("Een activiteit kan alleen verhuizen naar een subthema van dezelfde leeftijd.", probleem!.Detail);

        // Non-destructive: the activiteit is still where it was, with its link, and the other age received nothing.
        var bronNa = await LeesVoorKlasAsync(client, bron.ThemaId, opzet.KlasId);
        var gebleven = Assert.Single(bronNa.Subthemas.Single().Activiteiten);
        Assert.Equal(activiteitId, gebleven.Id);
        Assert.Single(gebleven.Doelkoppelingen);

        var andereLeeftijdNa = await LeesVoorKlasAsync(client, vanAndereLeeftijd.ThemaId, opzet.AndereKlasId);
        Assert.Empty(andereLeeftijdNa.Subthemas.Single().Activiteiten);
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

        var bron = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", "K3");
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

    /// <summary>
    /// <b>The list is scoped by age now, and that inverts two of its assertions.</b> It used to prove that a
    /// subthema created "for another klas" stays out; since 2026-08-30 a subthema at an age this class teaches is
    /// this class's too, whoever typed it (Art. IX.2), so that row belongs in the answer and its absence would be
    /// the bug. What stays out is an age the class does not teach.
    /// </summary>
    [PostgresFact]
    public async Task De_bestemmingenlijst_geeft_de_subthemas_van_de_leeftijd_die_deze_klas_geeft()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var water = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", "K3");
        var vuur = await MaakThemaMetSubthemaAsync(client, "Vuur", "De vlam", "K3");
        var lucht = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", "L1");

        var lijst = await client.GetFromJsonAsync<List<BestemmingDto>>($"/api/subthemas/voor-klas/{opzet.KlasId}");

        Assert.NotNull(lijst);

        // Both K3 thema's are offered, so a move across thema's has somewhere to go (owner ruling 2026-08-05,
        // the half of it that still stands), and the L1 subthema is absent: the scope is the answer, not a
        // filter on it. Its absence is also what keeps the offer honest, because the move itself refuses a
        // destination at another leeftijd (owner ruling 2026-08-30).
        var ids = lijst!.Select(b => b.Id).ToList();
        Assert.Equal(2, ids.Count);
        Assert.Contains(water.SubthemaId, ids);
        Assert.Contains(vuur.SubthemaId, ids);
        Assert.DoesNotContain(lucht.SubthemaId, ids);

        // Each entry names its thema, which is the only thing that tells two same-named subthema's apart, and its
        // leeftijd, which a teacher needs in order to read the list as the scope it is.
        var vlam = lijst.Single(b => b.Id == vuur.SubthemaId);
        Assert.Equal("Vuur", vlam.ThemaNaam);
        Assert.Equal("De vlam", vlam.Naam);
        Assert.Equal("K3", vlam.Leeftijd);

        // Ordered by thema, then subthema: "Vuur" before "Water" under the database collation, which is the
        // ordering the query asks the database for rather than the one .NET would produce for these two.
        Assert.Equal(["Vuur", "Water"], lijst.Select(b => b.ThemaNaam));
    }

    [PostgresFact]
    public async Task Verhuizen_naar_een_thema_dat_niet_in_het_jaarplan_staat_verlaagt_de_dekking()
    {
        // The consequence the owner's ruling brings with it, and the reason the copy has to say something: dekking
        // counts an activiteitkoppeling only while the subthema it hangs under is placed in this class's agenda
        // (Art. V.1, ADR-0047). So a move that never leaves the klas can still take a doel out of the figure.
        // Measured rather than argued.
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var geplaatst = await MaakThemaMetSubthemaAsync(client, "Water", "De plas", "K3");
        var nietGeplaatst = await MaakThemaMetSubthemaAsync(client, "Lucht", "De wind", "K3");
        var activiteitId = await MaakActiviteitAsync(client, geplaatst.SubthemaId, "Waterproef", null, null);
        await KoppelAsync(client, activiteitId, "VER-01");

        var plaatsen = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen",
            new { themaId = geplaatst.ThemaId, van = opzet.EersteBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.OK, plaatsen.StatusCode);
        await PlaatsSubthemaAsync(opzet.KlasId, geplaatst.SubthemaId);

        var voor = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{opzet.KlasId}/dekking");
        Assert.Equal(1, voor!.AantalGedekt);
        Assert.Equal(["De plas (Water)"], voor.Doelen.Single(d => d.Code == "VER-01").DekkendeThemas);

        var verhuis = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteitId}/subthema",
            new { doelSubthemaId = nietGeplaatst.SubthemaId });
        Assert.Equal(HttpStatusCode.OK, verhuis.StatusCode);

        var na = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{opzet.KlasId}/dekking");
        Assert.Equal(0, na!.AantalGedekt);
        Assert.False(na.Doelen.Single(d => d.Code == "VER-01").IsGedekt);
    }

    /// <summary>Puts a subthema in the klas's agenda, as the weekplanning does.</summary>
    private async Task PlaatsSubthemaAsync(Guid klasId, Guid subthemaId)
    {
        await using var context = _db.MaakContext();
        var jaarplanId = await context.Jaarplannen.Where(j => j.KlasId == klasId).Select(j => j.Id).SingleAsync();
        context.Subthemaplaatsingen.Add(new Jaarplanner.Domain.Planning.Subthemaplaatsing(
            jaarplanId, subthemaId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25)));
        await context.SaveChangesAsync();
    }

    [PostgresFact]
    public async Task Een_onbekende_klas_wordt_geweigerd_en_niet_als_een_lege_lijst_beantwoord()
    {
        // An empty list and "this klas does not exist" are different facts, and the picker cannot tell them
        // apart: it reads an empty list as "there is nowhere to move to" and hides the control, which turns an
        // infrastructure state into a statement about the school's content (antagonist round 1).
        //
        // **A 400 and not a 404, and this test failed on that for eleven days.** The endpoint answered a bare 404
        // while the sentence it should carry sat on the neighbouring method (HaalThemaVoorKlasAsync) with a
        // comment explaining why 404 is the wrong code here: the resource this route ADDRESSES is the list of
        // destinations, which exists; the klas is referenced. A 404 tells the picker its own route is gone.
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
        var een = await MaakThemaMetSubthemaAsync(client, "Water", "Aa", "K3");
        var twee = await MaakThemaMetSubthemaAsync(client, "Water", "Bb", "K3");
        await VoegSubthemaToeAsync(client, een.ThemaId, "Cc", "K3");
        await VoegSubthemaToeAsync(client, twee.ThemaId, "Dd", "K3");

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
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        var andere = schooljaar.VoegKlasToe($"L1-{Guid.NewGuid():N}", "L1");
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        return new Opzet(klas.Id, andere.Id, schooljaar.Start);
    }

    /// <summary>
    /// Creates a thema with one subthema at <paramref name="leeftijd"/>.
    /// <para>
    /// <b>No klasId, and its absence is the change of 2026-08-30.</b> This helper used to take one and post it,
    /// which the API stopped reading when a subthema became age-scoped (Art. IX.2). Keeping the parameter would
    /// have let every test in this file go on reading as though it were arranging one class's content, while the
    /// database recorded something else entirely.
    /// </para>
    /// </summary>
    private static async Task<ThemaMetSubthema> MaakThemaMetSubthemaAsync(
        HttpClient client,
        string themaNaam,
        string subthemaNaam,
        string leeftijd)
    {
        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = themaNaam, duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();

        var subResp = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = subthemaNaam,
            duurWeken = 2,
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
        string leeftijd)
    {
        var resp = await client.PostAsJsonAsync($"/api/themas/{themaId}/subthemas", new
        {
            naam,
            duurWeken = 2,
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
