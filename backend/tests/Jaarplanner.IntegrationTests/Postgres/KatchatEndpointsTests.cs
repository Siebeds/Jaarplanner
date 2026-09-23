using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Kat.Chat;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The cat's chat over HTTP against PostgreSQL (FB-031, ADR-0066): the real lookups (the goal search, the content and
/// the agenda), what a gebruiker may not see (Art. VI.1), and that no question or answer reaches a log (ADR-0059 D6).
/// The model is the host's stub: it answers what each test sets.
/// </summary>
public sealed class KatchatEndpointsTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly Logvanger _log = new();
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("katchat");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        _factory.Logvangers.Add(_log);
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

    private static async Task<Katantwoord> VraagAsync(HttpClient client, string vraag, Guid? schooljaarId = null)
    {
        using var antwoord = await client.PostAsJsonAsync("/api/kat/chat", new { vraag, schooljaarId });
        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<Katantwoord>(Json))!;
    }

    private static async Task<Katantwoord> ZoekOpAsync(HttpClient client, object opzoeking, Guid? schooljaarId = null)
    {
        using var antwoord = await client.PostAsJsonAsync("/api/kat/chat/opzoeking", new { opzoeking, schooljaarId });
        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<Katantwoord>(Json))!;
    }

    [PostgresFact]
    public async Task Een_doel_op_een_deel_van_zijn_tekst_zit_in_het_thema_dat_het_draagt()
    {
        var code = $"KC-{Guid.NewGuid():N}"[..12];
        await using (var context = _db.MaakContext())
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: "Kastanjes verzamelen en vergelijken"));
            await context.SaveChangesAsync();
        }

        var thema = await Opzet.ThemaAsync();
        await Opzet.LeerplandoelThemadoelAsync(thema, code);
        var juf = await Opzet.GebruikerAsync();
        _factory.AiAntwoord = $$$"""
            {"soort":"opzoeking","opzoeking":{"vraag":"doelInThema","doel":"kastanjes vergelijken","thema":"{{{thema}}}"}}
            """;

        using var client = Opzet.Als(juf);
        var antwoord = await VraagAsync(client, "Zit het doel over kastanjes vergelijken in dat thema?");

        Assert.Equal(Katantwoordsoort.DoelInThema, antwoord.Soort);
        Assert.True(antwoord.Ja);
        Assert.Equal(code, antwoord.Doel!.Code);
        Assert.Equal(Katpleksoort.Themadoel, Assert.Single(antwoord.Plekken).Soort);
    }

    [PostgresFact]
    public async Task Een_eigen_activiteit_vindt_alleen_wie_ze_mag_lezen()
    {
        var school = await Opzet.SchoolAsync();
        var subthema = await Opzet.SubthemaAsync("K3");
        var maker = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var collega = await Opzet.GebruikerAsync(school, klassen: [school.K3Groen]);
        var k2 = await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]);

        using var makerClient = Opzet.Als(maker);
        var activiteit = await Opzet.ActiviteitAsync(subthema, makerClient);
        var naam = await NaamVanAsync(activiteit.Id);
        var opzoeking = new { vraag = "subthemaVanActiviteit", activiteit = naam };

        using var collegaClient = Opzet.Als(collega);
        using var k2Client = Opzet.Als(k2);
        var voorCollega = await ZoekOpAsync(collegaClient, opzoeking);
        var voorK2 = await ZoekOpAsync(k2Client, opzoeking);

        Assert.Equal(Katantwoordsoort.SubthemaVanActiviteit, voorCollega.Soort);
        Assert.Equal("Regen", Assert.Single(voorCollega.Plekken).Subthema);
        Assert.Equal(Katantwoordsoort.NietGevonden, voorK2.Soort);
    }

    [PostgresFact]
    public async Task De_agenda_toont_alleen_de_klassen_die_ze_mag_inkijken()
    {
        var school = await Opzet.SchoolAsync();
        var minimumdoel = $"KC-MD-{Guid.NewGuid():N}"[..14];
        await RechtenTestOpzet.ZaaiMinimumdoelAsync(_db, minimumdoel);
        var vandaag = DateOnly.FromDateTime(DateTime.UtcNow);
        await using (var context = _db.MaakContext())
        {
            var thema = new Thema($"Kastanjes {Guid.NewGuid():N}", duurWeken: 2);
            thema.KoppelMinimumdoel(minimumdoel);
            context.Themas.Add(thema);
            foreach (var klas in new[] { school.K3Blauw, school.K2Rood })
            {
                var jaarplan = new Jaarplan(klas);
                jaarplan.VoegPlaatsingToe(thema.Id, vandaag, vandaag.AddDays(11), KoppelingStatus.Manueel);
                context.Jaarplannen.Add(jaarplan);
            }

            // A rejected placement is not in the agenda, so no answer names it.
            var geweigerd = new Jaarplan(school.K3Groen);
            geweigerd.VoegPlaatsingToe(thema.Id, vandaag, vandaag.AddDays(11), KoppelingStatus.Geweigerd);
            context.Jaarplannen.Add(geweigerd);

            await context.SaveChangesAsync();
        }

        var juf = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var admin = await Opzet.GebruikerAsync(school, admin: true);
        var opzoeking = new { vraag = "waarGebruikt", doel = minimumdoel };

        using var jufClient = Opzet.Als(juf);
        using var adminClient = Opzet.Als(admin);
        var voorJuf = await ZoekOpAsync(jufClient, opzoeking, school.SchooljaarId);
        var voorAdmin = await ZoekOpAsync(adminClient, opzoeking, school.SchooljaarId);

        Assert.Equal([school.K3Blauw], voorJuf.Agenda.Select(p => p.KlasId).ToArray());
        Assert.Equal(
            new[] { school.K3Blauw, school.K2Rood }.Order().ToArray(),
            voorAdmin.Agenda.Select(p => p.KlasId).Order().ToArray());
        Assert.Equal(Katpleksoort.Themadoel, Assert.Single(voorJuf.Plekken).Soort);
    }

    [PostgresFact]
    public async Task Een_vraag_en_zijn_antwoord_komen_in_geen_enkel_log()
    {
        const string VraagMerk = "Zeldzaamvraagwoord";
        const string AntwoordMerk = "Zeldzaamantwoordwoord";
        var juf = await Opzet.GebruikerAsync();
        _factory.AiAntwoord = $$$"""
            {"soort":"uitleg","antwoord":"{{{AntwoordMerk}}}: open de agenda.","hoofdstukken":["De agenda"]}
            """;

        using var client = Opzet.Als(juf);
        var antwoord = await VraagAsync(client, $"Hoe werkt de agenda? {VraagMerk}");

        Assert.Equal(Katantwoordsoort.Uitleg, antwoord.Soort);
        Assert.Contains(AntwoordMerk, antwoord.Uitleg);
        Assert.Contains(VraagMerk, _factory.LaatsteAiVerzoek!.UserPrompt);

        // A lookup run again carries what she typed too: a term that names nothing, so it is also in the answer.
        var opnieuw = await ZoekOpAsync(client, new { vraag = "waarGebruikt", doel = VraagMerk });
        Assert.Equal(VraagMerk, opnieuw.NietGevonden!.Term);

        // The request itself was logged at every level: had the question been in a line, it would be here.
        Assert.Contains(_log.Regels, r => r.Contains("/api/kat/chat", StringComparison.Ordinal));
        Assert.DoesNotContain(_log.Regels, r => r.Contains(VraagMerk, StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(_log.Regels, r => r.Contains(AntwoordMerk, StringComparison.OrdinalIgnoreCase));
    }

    [PostgresFact]
    public async Task Een_lege_vraag_of_een_onvolledige_opzoeking_wordt_geweigerd_zonder_ai()
    {
        var juf = await Opzet.GebruikerAsync();
        using var client = Opzet.Als(juf);

        using var leeg = await client.PostAsJsonAsync("/api/kat/chat", new { vraag = " " });
        using var teLang = await client.PostAsJsonAsync("/api/kat/chat", new { vraag = new string('a', KatchatPromptBuilder.MaxVraagLengte + 1) });
        using var onvolledig = await client.PostAsJsonAsync("/api/kat/chat/opzoeking", new { opzoeking = new { vraag = "doelInThema", doel = "x" } });

        Assert.Equal(HttpStatusCode.BadRequest, leeg.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, teLang.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, onvolledig.StatusCode);
        Assert.Null(_factory.LaatsteAiVerzoek);
    }

    private async Task<string> NaamVanAsync(Guid activiteitId)
    {
        await using var context = _db.MaakContext();
        return await context.Activiteiten.Where(a => a.Id == activiteitId).Select(a => a.Naam).SingleAsync();
    }

    /// <summary>Every log line the host writes, of every category and level, with its exception.</summary>
    private sealed class Logvanger : ILoggerProvider
    {
        private readonly ConcurrentQueue<string> _regels = new();

        public IReadOnlyCollection<string> Regels => _regels;

        public ILogger CreateLogger(string categoryName) => new Logger(categoryName, _regels);

        public void Dispose()
        {
        }

        private sealed class Logger(string categorie, ConcurrentQueue<string> regels) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull
            {
                regels.Enqueue($"{categorie} scope: {state}");
                return null;
            }

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                regels.Enqueue($"{categorie} {logLevel}: {formatter(state, exception)} {exception}");
        }
    }
}
