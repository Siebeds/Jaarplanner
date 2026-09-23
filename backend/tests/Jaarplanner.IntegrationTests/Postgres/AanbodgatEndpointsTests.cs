using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-070 (ADR-0060) end to end against PostgreSQL: the cat notices, five schooldagen before a thema starts, that one
/// discipline is in no dekkingsprognose of the klas, asks the AI for activiteiten on exactly those goals, and stores
/// them as open proposals addressed to the klas. Accepting one makes it the accepter's own activiteit, planned on the
/// suggested moment, which is what finally moves the dekking (G5, Art. V.1).
/// <para>
/// <b>The real detector and the real task run here.</b> No test detector is registered: what is exercised is the
/// wiring the app ships. Only the AI is the factory's stub (Art. IV.6).
/// </para>
/// </summary>
public sealed class AanbodgatEndpointsTests : IAsyncLifetime
{
    /// <summary>The discipline every goal below belongs to; the seed holds it, so the FK resolves.</summary>
    private const string Discipline = "9.1";

    /// <summary>Three goals of that discipline that nothing in the klas aims at: the aanbod-gat (G2).</summary>
    private const string Gat01 = "AG-K3-01";
    private const string Gat02 = "AG-K3-02";
    private const string Gat03 = "AG-K3-03";

    /// <summary>A goal of the same discipline that IS a subdoel, so it sits in the prognose and not in the gap.</summary>
    private const string InPrognose = "AG-K3-50";

    /// <summary>A code the model invents. It is no goal it was sent, so nothing may keep it (Art. IV.4).</summary>
    private const string Verzonnen = "AG-K3-VERZONNEN";

    /// <summary>The API writes enums as text (Program.cs registers the converter), so the reader must too.</summary>
    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private static readonly DateOnly Vandaag = DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>The thema starts three schooldagen from now: inside the five of G3.</summary>
    private static readonly DateOnly Start = Weekdagen(Vandaag, 3);

    private static readonly DateOnly Einde = Weekdagen(Start, 10);

    private static readonly TimeOnly Schoolbegin = new(8, 30);
    private static readonly TimeOnly Schooleinde = new(15, 30);
    private static readonly TimeOnly PauzeBegin = new(12, 0);
    private static readonly TimeOnly PauzeEinde = new(13, 0);

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("aanbodgat");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await using var context = _db.MaakContext();
        context.Leerplandoelen.AddRange(
            Doel(Gat01, "Onderzoekt wat drijft en zinkt."),
            Doel(Gat02, "Beschrijft hoe water beweegt."),
            Doel(Gat03, "Vergelijkt de hoeveelheid water in twee bekers."),
            Doel(InPrognose, "Benoemt de toestanden van water."));
        await context.SaveChangesAsync();
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

    private RechtenTestOpzet Opzet => new(_db, _factory);

    [PostgresFact]
    public async Task Vijf_schooldagen_voor_een_thema_start_legt_de_kat_voorstellen_klaar()
    {
        var opzet = await OpzetAsync();
        _factory.AiAntwoord = Antwoord(
            Item("Drijftafel", [Gat01]),
            Item("Waterrace", [Gat02]),
            Item("Bekers vergelijken", [Gat03]));

        await TikAsync();

        await using var context = _db.MaakContext();
        var voorstellen = await context.Activiteitvoorstellen.AsNoTracking()
            .Where(v => v.KlasId == opzet.KlasId)
            .OrderBy(v => v.Datum).ThenBy(v => v.Begin)
            .ToListAsync();

        Assert.InRange(voorstellen.Count, 2, 3);
        foreach (var voorstel in voorstellen)
        {
            // D1, D2: the cat's source, addressed to the klas and not to one asker, remembering the placement it
            // answered so it brings no second set for it (G3).
            Assert.Equal(Voorstelbron.KatAanbodgat, voorstel.Bron);
            Assert.Null(voorstel.GebruikerId);
            Assert.Equal(opzet.KlasId, voorstel.KlasId);
            Assert.Equal(opzet.PlaatsingId, voorstel.ThemaplaatsingId);
            Assert.Equal(KoppelingStatus.Voorgesteld, voorstel.Status);
            Assert.NotEmpty(voorstel.AiMotivatie);

            // G5: a moment inside the thema's period, on a schooldag, inside the schooluren, never across the pause.
            var datum = Assert.NotNull(voorstel.Datum);
            var begin = Assert.NotNull(voorstel.Begin);
            var eind = Assert.NotNull(voorstel.Einde);
            Assert.InRange(datum, Start, Einde);
            Assert.True(datum.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday), $"{datum} is geen schooldag.");
            Assert.True(begin >= Schoolbegin && eind <= Schooleinde, $"{begin}-{eind} valt buiten de schooluren.");
            Assert.True(eind <= PauzeBegin || begin >= PauzeEinde, $"{begin}-{eind} loopt door de middagpauze.");
        }

        // A set she can accept whole: the cat does not stack two proposals on one hour.
        foreach (var (eerste, tweede) in voorstellen.Zip(voorstellen.Skip(1)))
        {
            Assert.True(
                eerste.Datum != tweede.Datum || eerste.Einde <= tweede.Begin,
                "Twee voorstellen overlappen elkaar.");
        }
    }

    [PostgresFact]
    public async Task Alleen_doelen_uit_het_aanbod_gat_worden_bewaard()
    {
        var opzet = await OpzetAsync();

        // One goal of the gap, one code the model invented, and one goal that a subthema already aims at: only the
        // first is a candidate (D1, Art. IV.4). InPrognose is no gap goal, so it is not one either (G2).
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01, Verzonnen, InPrognose]));

        await TikAsync();

        await using var context = _db.MaakContext();
        var voorstel = await context.Activiteitvoorstellen.AsNoTracking().SingleAsync(v => v.KlasId == opzet.KlasId);

        Assert.Equal([Gat01], voorstel.LeerplandoelCodes);
    }

    [PostgresFact]
    public async Task De_dag_en_het_uur_van_het_model_worden_overgenomen()
    {
        // ADR-0062 M1: the AI chooses the moment, and the tool leaves a workable one alone.
        var opzet = await OpzetAsync();
        var dag = Weekdagen(Start, 2);
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01], dag, "10:15"));

        await TikAsync();

        await using var context = _db.MaakContext();
        var voorstel = await context.Activiteitvoorstellen.AsNoTracking().SingleAsync(v => v.KlasId == opzet.KlasId);

        Assert.Equal(dag, voorstel.Datum);
        Assert.Equal(new TimeOnly(10, 15), voorstel.Begin);
    }

    [PostgresFact]
    public async Task Een_uur_dat_de_school_niet_kan_geven_schuift_op_en_houdt_de_dag()
    {
        // ADR-0062 D1: a model is poor at timetables. Its day is the pedagogical choice and is kept; the middagpauze
        // is not a moment the school can teach, so the hour moves to the first free one after it.
        var opzet = await OpzetAsync();
        var dag = Weekdagen(Start, 2);
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01], dag, "12:30"));

        await TikAsync();

        await using var context = _db.MaakContext();
        var voorstel = await context.Activiteitvoorstellen.AsNoTracking().SingleAsync(v => v.KlasId == opzet.KlasId);

        Assert.Equal(dag, voorstel.Datum);
        Assert.Equal(PauzeEinde, voorstel.Begin);
    }

    [PostgresFact]
    public async Task Op_de_deurmat_draagt_een_voorstel_van_de_kat_zijn_klas_en_moment_en_geen_verwijzing()
    {
        // FB-071: the cat's window decides it, so it must be able to say for which klas and when accepting plans it.
        var opzet = await OpzetAsync();
        var dag = Weekdagen(Start, 2);
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01], dag, "10:15"));
        await TikAsync();

        using var juf = Opzet.Als(opzet.LeerkrachtId);
        using var antwoord = await juf.GetAsync("/api/deurmat");
        antwoord.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());

        var voorstel = Assert.Single(json.RootElement.GetProperty("voorstellen").EnumerateArray());
        Assert.Equal("Activiteitvoorstel", voorstel.GetProperty("soort").GetString());
        Assert.Equal("Drijftafel", voorstel.GetProperty("titel").GetString());
        Assert.Equal(JsonValueKind.Null, voorstel.GetProperty("verwijzing").ValueKind);
        Assert.False(string.IsNullOrEmpty(voorstel.GetProperty("klasnaam").GetString()));
        Assert.Equal(dag.ToString("yyyy-MM-dd"), voorstel.GetProperty("datum").GetString());
        Assert.Equal("10:15:00", voorstel.GetProperty("begin").GetString());
        Assert.NotEqual(JsonValueKind.Null, voorstel.GetProperty("einde").ValueKind);
    }

    [PostgresFact]
    public async Task Aanvaarden_maakt_een_eigen_activiteit_die_gepland_staat_en_meetelt_voor_de_dekking()
    {
        var opzet = await OpzetAsync();
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01]));
        await TikAsync();

        Guid voorstelId;
        DateOnly datum;
        TimeOnly begin;
        TimeOnly eind;
        await using (var gelezen = _db.MaakContext())
        {
            var voorstel = await gelezen.Activiteitvoorstellen.AsNoTracking().SingleAsync(v => v.KlasId == opzet.KlasId);
            (voorstelId, datum, begin, eind) = (voorstel.Id, voorstel.Datum!.Value, voorstel.Begin!.Value, voorstel.Einde!.Value);
        }

        using var juf = Opzet.Als(opzet.LeerkrachtId);

        // Before: the goal reaches this klas through nothing at all.
        Assert.Equal("Geen", await StapAsync(juf, opzet.KlasId, Gat01));

        var besluit = await BeslisAsync(juf, voorstelId, new { status = "Aanvaard" });
        Assert.Equal("Aanvaard", besluit.Status);
        Assert.Equal(datum, besluit.Datum);
        Assert.Equal(begin, besluit.Begin);

        await using var context = _db.MaakContext();
        var activiteit = await context.Activiteiten.AsNoTracking().SingleAsync(a => a.Id == besluit.ActiviteitId);

        // D2: whoever accepts becomes the owner of the own activiteit it makes (ADR-0049).
        Assert.Equal(opzet.LeerkrachtId, activiteit.EigenaarId);
        Assert.Equal(opzet.SubthemaId, activiteit.SubthemaId);

        // D4, G5: accepting also plans it, because an own activiteit that is not planned counts for nothing.
        var plaatsing = await (
                from p in context.Activiteitplaatsingen.AsNoTracking()
                join plan in context.Jaarplannen.AsNoTracking() on p.JaarplanId equals plan.Id
                where plan.KlasId == opzet.KlasId && p.ActiviteitId == activiteit.Id
                select p)
            .SingleAsync();
        Assert.Equal(datum, plaatsing.Datum);
        Assert.Equal(begin, plaatsing.Begin);
        Assert.Equal(eind, plaatsing.Einde);

        // And that is what moves the dekking (Art. V.1): an own activiteit counts where it is planned.
        Assert.Equal("Gedekt", await StapAsync(juf, opzet.KlasId, Gat01));
    }

    [PostgresFact]
    public async Task Voor_dezelfde_plaatsing_brengt_de_kat_geen_tweede_keer_voorstellen()
    {
        var opzet = await OpzetAsync();
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01]), Item("Waterrace", [Gat02]));

        await TikAsync();

        // The signal disappears and comes back, which is the one way a second tick would reach the task again. The
        // durable guard is the proposals' own ThemaplaatsingId (G3), so this is what proves it rather than the
        // round's "a task runs only for a new finding".
        await using (var opruiming = _db.MaakContext())
        {
            opruiming.Signalen.RemoveRange(await opruiming.Signalen.ToListAsync());
            await opruiming.SaveChangesAsync();
        }

        await TikAsync();

        await using var context = _db.MaakContext();
        Assert.Equal(2, await context.Activiteitvoorstellen.CountAsync(v => v.KlasId == opzet.KlasId));
    }

    [PostgresFact]
    public async Task Het_doel_van_een_geweigerd_voorstel_komt_niet_terug()
    {
        var opzet = await OpzetAsync();
        _factory.AiAntwoord = Antwoord(Item("Drijftafel", [Gat01]));
        await TikAsync();

        Guid voorstelId;
        await using (var gelezen = _db.MaakContext())
        {
            voorstelId = (await gelezen.Activiteitvoorstellen.AsNoTracking().SingleAsync(v => v.KlasId == opzet.KlasId)).Id;
        }

        using var juf = Opzet.Als(opzet.LeerkrachtId);
        Assert.Equal("Geweigerd", (await BeslisAsync(juf, voorstelId, new { status = "Geweigerd" })).Status);

        // A second thema, right after the first, and a tick on the day the first one ends: the cat has a new
        // placement to answer, so the once-per-placement guard is not what keeps it quiet.
        var tweede = await PlaatsTweedeThemaAsync(opzet);
        _factory.AiAntwoord = Antwoord(Item("Drijftafel opnieuw", [Gat01]), Item("Waterrace", [Gat02]));
        await TikAsync(op: Einde);

        await using var context = _db.MaakContext();
        var nieuw = await context.Activiteitvoorstellen.AsNoTracking()
            .Where(v => v.KlasId == opzet.KlasId && v.ThemaplaatsingId == tweede)
            .ToListAsync();

        // It still brings what fits, so the assertion below is about D5 and not about silence: the rejected goal is
        // no longer a candidate, and the proposal that names only it is dropped.
        Assert.NotEmpty(nieuw);
        Assert.DoesNotContain(nieuw, v => v.LeerplandoelCodes.Contains(Gat01));
        Assert.Contains(nieuw, v => v.LeerplandoelCodes.Contains(Gat02));
    }

    /// <summary>Runs one round in the host's own container, as the background job would.</summary>
    private async Task TikAsync(DateOnly? op = null)
    {
        using var scope = _factory.Services.CreateScope();
        var ronde = scope.ServiceProvider.GetRequiredService<Signaalronde>();
        var verslag = await ronde.VoerUitAsync(op ?? Vandaag, CancellationToken.None);

        // A klas whose round or task threw would otherwise show up as "the cat brought nothing", which is also what
        // "nothing fitted" looks like. Fail on the exception instead.
        Assert.True(
            verslag.Mislukkingen.Count == 0 && verslag.Taakfouten.Count == 0,
            string.Join("; ", verslag.Mislukkingen.Concat(verslag.Taakfouten).Select(m => m.Fout.ToString())));
    }

    /// <summary>
    /// A K3 klas with its leerkracht, a thema with one K3 subthema that aims at <see cref="InPrognose"/> only, that
    /// thema placed so it starts three schooldagen from now, and the school's hours.
    /// </summary>
    private async Task<Opstelling> OpzetAsync()
    {
        var school = await Opzet.SchoolAsync();
        var themaId = await Opzet.ThemaAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3", themaId);

        using var admin = Opzet.Admin();

        // The one goal of the discipline that this klas does aim at, so the gap is a share and not everything.
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = InPrognose })));

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(admin.PutAsJsonAsync(
            "/api/schooluren",
            new
            {
                dagen = Enumerable.Range(1, 5).Select(d => new
                {
                    weekdag = d,
                    begin = Schoolbegin,
                    einde = Schooleinde,
                    middagpauzeBegin = PauzeBegin,
                    middagpauzeEinde = PauzeEinde,
                }),
            })));

        var leerkrachtId = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var plaatsingId = await PlaatsAsync(school.K3Blauw, themaId, Start, Einde);

        return new Opstelling(school.K3Blauw, leerkrachtId, subthemaId, themaId, plaatsingId);
    }

    /// <summary>
    /// A second thema, starting the schooldag after the first one ends, so a tick on that last day sees it start
    /// within the five schooldagen of G3.
    /// </summary>
    private async Task<Guid> PlaatsTweedeThemaAsync(Opstelling opzet)
    {
        var themaId = await Opzet.ThemaAsync();
        await Opzet.SubthemaAsync("K3", themaId);
        return await PlaatsAsync(opzet.KlasId, themaId, Weekdagen(Einde, 1), Weekdagen(Einde, 10));
    }

    /// <summary>Places a thema in the klas's agenda as admin, and returns the id of the part that opens the run.</summary>
    private async Task<Guid> PlaatsAsync(Guid klasId, Guid themaId, DateOnly van, DateOnly tot)
    {
        using var admin = Opzet.Admin();
        using var antwoord = await admin.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen",
            new { themaId, van, tot });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());

        var plan = (await antwoord.Content.ReadFromJsonAsync<Jaarplan>(Json))!;
        return plan.Plaatsingen.Where(p => p.ThemaId == themaId).OrderBy(p => p.Van).First().Id;
    }

    /// <summary>Where one leerplandoel stands for this klas, as the dekking reports it.</summary>
    private static async Task<string> StapAsync(HttpClient client, Guid klasId, string code)
    {
        var dekking = await client.GetFromJsonAsync<Dekking>($"/api/klassen/{klasId}/dekking", Json);
        return Assert.Single(dekking!.Doelen, d => d.Code == code).Stap;
    }

    private static async Task<Besluit> BeslisAsync(HttpClient client, Guid voorstelId, object lichaam)
    {
        using var antwoord = await client.PutAsJsonAsync($"/api/activiteitvoorstellen/{voorstelId}/beslissing", lichaam);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<Besluit>(Json))!;
    }

    private static Leerplandoel Doel(string code, string tekst) =>
        new(code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", Discipline, tekst: tekst);

    /// <summary>One activiteit as the model writes it, under S1: the thema's only K3 subthema (D3).</summary>
    /// <summary>
    /// One activiteit as the model writes it. Without <paramref name="dag"/> it names no moment, which the tool then
    /// picks itself, exactly as it did before ADR-0062: the flow has to keep working for an answer that leaves it out.
    /// </summary>
    private static string Item(string naam, string[] doelen, DateOnly? dag = null, string? beginuur = null) =>
        $$"""
        {"naam": "{{naam}}", "subthema": "S1", "soort": "Experiment",
         "verwachteUitkomsten": "De kleuters testen voorwerpen in een bak water.", "lengteInLesuren": 1,
         "onderzoeksvraag": null, "doelen": [{{string.Join(",", doelen.Select(d => $"\"{d}\""))}}],
         "dag": {{(dag is { } d ? $"\"{d:yyyy-MM-dd}\"" : "null")}}, "beginuur": {{(beginuur is null ? "null" : $"\"{beginuur}\"")}},
         "motivatie": "Dit doel past bij het thema water."}
        """;

    private static string Antwoord(params string[] activiteiten) =>
        $"{{\"activiteiten\": [{string.Join(",", activiteiten)}]}}";

    /// <summary>
    /// The date <paramref name="aantal"/> weekdays after <paramref name="van"/>. The seeded schooljaar has no
    /// closures, so a weekday is a schooldag and this is what <c>Themakalender</c> would count.
    /// </summary>
    private static DateOnly Weekdagen(DateOnly van, int aantal)
    {
        var dag = van;
        for (var geteld = 0; geteld < aantal;)
        {
            dag = dag.AddDays(1);
            if (dag.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
            {
                geteld++;
            }
        }

        return dag;
    }

    private sealed record Opstelling(Guid KlasId, Guid LeerkrachtId, Guid SubthemaId, Guid ThemaId, Guid PlaatsingId);

    private sealed record Jaarplan(IReadOnlyList<Plaatsing> Plaatsingen);

    private sealed record Plaatsing(Guid Id, Guid ThemaId, DateOnly Van, DateOnly Tot);

    private sealed record Dekking(IReadOnlyList<Doelstand> Doelen);

    private sealed record Doelstand(string Code, string Stap, bool IsGedekt);

    private sealed record Besluit(string Status, Guid? ActiviteitId, DateOnly? Datum, TimeOnly? Begin, TimeOnly? Einde);
}
