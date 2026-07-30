using Jaarplanner.Application.Planning;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure.Demo;

/// <summary>
/// Seeds one realistic school year, class and jaarplan so the kalender (E3-06) shows something honest when
/// it is clicked through at the directie/teacher review.
/// <para>
/// <b>Why this exists.</b> E3-06's output is a review artifact: teachers assess it by using it. An empty
/// screen assesses nothing, and the alternative — asking a reviewer to configure Azure AI and run a
/// generation first — makes the session depend on a working model call. This seeds the same shapes the real
/// flow produces, through the same domain aggregates, so what a reviewer sees is what the app renders and not
/// a mock.
/// </para>
/// <para>
/// <b>Guards, because seeding a database on startup is otherwise a trap.</b> It runs only when
/// <c>Demo:Seed</c> is true — set in <c>Properties/launchSettings.json</c>, i.e. only when a developer
/// starts the app by hand, and <b>deliberately not</b> in <c>appsettings.Development.json</c>, which
/// <c>WebApplicationFactory</c> loads (putting it there ran this seeder inside every integration test).
/// Registration additionally requires <c>IsDevelopment()</c>. It is idempotent on the school year's name,
/// it guards the uniquely-indexed class name separately, and <b>no failure here can take the host down</b>:
/// the whole body is wrapped, because an unhandled exception from <see cref="IHostedService.StartAsync"/>
/// aborts startup, and the likeliest first-run state — an existing but unmigrated database — throws on the
/// very first query.
/// </para>
/// <para>
/// <b>The placements are seeded as <c>Voorgesteld</c></b> — the state real generation produces
/// (Art. IV.1/IV.2). Seeding them as <c>Aanvaard</c> would show a reviewer a plan that appears already
/// decided, which is precisely the human-in-the-loop claim the review is meant to test.
/// </para>
/// <para>
/// <b>And the motivations are marked as examples, for the same reason.</b> They are hand-written, not model
/// output, but they land in <c>AiMotivatie</c> and render under "Waarom hier?" — at the very session where
/// teachers judge whether AI motivations are useful. Unmarked, feedback on this fixture prose would be
/// recorded as feedback on the AI. Each one is therefore prefixed with <see cref="Voorbeeldmarkering"/> so
/// the invented text is self-identifying wherever it is rendered, without a UI change.
/// </para>
/// <para>
/// <b>What the demo must be able to show.</b> A review artifact that can only render one card variant
/// teaches the review nothing, so the seed deliberately produces: cards that carry goals (via a handful of
/// leerplandoelen + themadoelen), and one period holding three thema's so the "te vol" flag — the named
/// mitigation for E3-10 question C — is actually visible. It does <b>not</b> produce a stale placement:
/// that would put a permanent alert on every demo. To see that path, edit a vakantie date.
/// </para>
/// </summary>
public sealed class DemoDataSeeder : IHostedService
{
    /// <summary>The label the seed is idempotent on. A year with this name means the seed already ran.</summary>
    public const string SchooljaarNaam = "2026-2027";

    /// <summary>
    /// The class the demo plan belongs to. <c>Klas.Naam</c> is uniquely indexed, so its presence is checked
    /// separately from the school year — otherwise a developer who already created a class by this name
    /// (it is the example name used throughout the constitution and the tests) would get a unique-violation
    /// on startup rather than a demo.
    /// </summary>
    public const string KlasNaam = "L3 derde leerjaar (demo)";

    /// <summary>
    /// Prefix marking a motivation as fixture prose rather than model output. Present in the persisted value
    /// so it cannot be lost by a UI that forgets to say so.
    /// </summary>
    public const string Voorbeeldmarkering = "Voorbeeld (geen AI-antwoord): ";

    private readonly IServiceProvider _services;
    private readonly ILogger<DemoDataSeeder> _logger;

    public DemoDataSeeder(IServiceProvider services, ILogger<DemoDataSeeder> logger)
    {
        _services = services;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await SeedAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Demo data must never stop the app from starting. An exception thrown from StartAsync aborts
            // the host, and the likeliest first-run state — `docker compose up -d db` with no migration yet
            // applied — throws 42P01 on the first query below, which would present as "the app is broken"
            // at the exact moment someone is trying to open the review draft.
            _logger.LogWarning(ex, "Demo seed failed and was skipped; the application starts regardless.");
        }
    }

    private async Task SeedAsync(CancellationToken cancellationToken)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!await context.Database.CanConnectAsync(cancellationToken))
        {
            _logger.LogWarning("Demo seed skipped: no database connection.");

            return;
        }

        if (await context.Schooljaren.AnyAsync(s => s.Naam == SchooljaarNaam, cancellationToken))
        {
            _logger.LogInformation("Demo seed skipped: schooljaar {Naam} already exists.", SchooljaarNaam);

            return;
        }

        // Klas.Naam is uniquely indexed school-wide, so it needs its own check: the school year can be
        // absent while a class by this name already exists.
        if (await context.Klassen.AnyAsync(k => k.Naam == KlasNaam, cancellationToken))
        {
            _logger.LogInformation("Demo seed skipped: klas {Naam} already exists.", KlasNaam);

            return;
        }

        var schooljaar = BouwSchooljaar();
        var klas = schooljaar.VoegKlasToe(KlasNaam, leerjaar: 3);
        context.Schooljaren.Add(schooljaar);

        // Thema.Naam is NOT uniquely indexed, so a collision throws nothing — it silently creates a second
        // "Water". That matters because generation resolves a model's answer BY NAME
        // (`themaPerNaam ... g.First()`), so a duplicate would make the developer's own thema unreachable and
        // quietly bind their plan to the demo one instead. Skip rather than duplicate (E3-02 code review).
        var bestaandeNamen = await context.Themas
            .Select(t => t.Naam)
            .ToListAsync(cancellationToken);
        var botsingen = bestaandeNamen.ToHashSet(StringComparer.OrdinalIgnoreCase);

        // The thema is carried together with its block index and its motivation, so dropping one for a name
        // collision cannot shift the others onto different periods — which plain positional filtering would
        // do, quietly undoing the "three thema's in periode 3" the te-vol flag depends on.
        var geplande = BouwThemas()
            .Select((thema, index) => (Thema: thema, BlokIndex: BlokVoorThema[index], Motivatie: Motivaties[index]))
            .Where(p => !botsingen.Contains(p.Thema.Naam))
            .ToList();

        if (geplande.Count == 0)
        {
            _logger.LogInformation("Demo seed skipped: every demo thema name is already taken.");

            return;
        }

        var themas = geplande.Select(p => p.Thema).ToList();

        await KoppelDoelenAsync(context, themas, cancellationToken);
        context.Themas.AddRange(themas);

        // Place the thema's on the blocks the CONFIGURED seam derives, never on hard-coded dates: a demo plan
        // keyed on invented boundaries would render as stale the moment the grain changed, and the stale
        // notice is one of the things the review is looking at.
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        var jaarplan = new Jaarplan(klas.Id);
        foreach (var (thema, blokIndex, motivatie) in geplande)
        {
            if (blokIndex >= blokken.Count)
            {
                // Fewer periods than the layout assumes (a different configured grain). Skip rather than
                // guess: an over-clamped placement would silently invent a crowded period.
                continue;
            }

            jaarplan.VoegPlaatsingToe(
                thema.Id,
                Planningsblokniveau.Themaperiode,
                blokken[blokIndex].Start,
                KoppelingStatus.Voorgesteld,
                Voorbeeldmarkering + motivatie);
        }

        context.Jaarplannen.Add(jaarplan);

        await context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Demo seed created schooljaar {Naam}, klas {KlasId} and {Aantal} placements.",
            SchooljaarNaam,
            klas.Id,
            jaarplan.Plaatsingen.Count);
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Gives each demo thema two themadoelen, so the cards show a goal count instead of all reading
    /// "Nog geen doelen gekoppeld".
    /// <para>
    /// <b>Why it needs leerplandoelen at all.</b> <c>DoelKoppeling.LeerplandoelCode</c> is a real foreign key
    /// to <c>Leerplandoel.Code</c>, and a fresh database has no curriculum (the Op.stap import is E1-15, and
    /// minimumdoelen are blocked on E1-12). So the seed creates a small set of its own — clearly marked
    /// <c>DEMO-*</c> codes against discipline 1, which the E0 migration seeds, and with
    /// <c>minimumdoelRef = null</c> so they need no <c>Minimumdoel</c> row.
    /// </para>
    /// <para>
    /// <b>These are not Op.stap goals and must never be mistaken for them</b> (Art. III.1: imported
    /// curriculum is read-only reference data). The <c>DEMO-</c> prefix and the explicit tekst say so on the
    /// row itself, so a reviewer or a later import sees invented data for what it is. Existing codes are
    /// left untouched: if a real curriculum has been imported, the seed reuses whatever is there instead.
    /// </para>
    /// </summary>
    private static async Task KoppelDoelenAsync(
        AppDbContext context,
        List<Thema> themas,
        CancellationToken cancellationToken)
    {
        var codes = new List<string>();

        for (var i = 1; i <= themas.Count * 2; i++)
        {
            var code = $"DEMO-L3-{i:D2}";
            codes.Add(code);

            if (await context.Leerplandoelen.AnyAsync(d => d.Code == code, cancellationToken))
            {
                continue;
            }

            context.Leerplandoelen.Add(new Leerplandoel(
                code,
                Doelsoort.Gemeenschappelijk,
                jaarFase: "L3",
                domein: "Demo",
                subdomein: "Demo",
                disciplineNummer: "1",
                tekst: $"Voorbeelddoel {i} — demodata voor de review, geen Op.stap-leerplandoel."));
        }

        foreach (var (thema, index) in themas.Select((t, i) => (t, i)))
        {
            // Two per thema: Art. IX.2's advisory lower bound, so the demo does not also illustrate an
            // under-anchored thema while it is illustrating everything else.
            thema.VoegThemadoelToe(new DoelKoppeling(codes[index * 2], KoppelingStatus.Manueel));
            thema.VoegThemadoelToe(new DoelKoppeling(codes[(index * 2) + 1], KoppelingStatus.Manueel));
        }
    }

    /// <summary>
    /// The real Belgian 2026-2027 calendar: four vakanties that break a period, and two single free days that
    /// deliberately do not (ADR-0020 §5). Both kinds are present because the difference between them is
    /// visible in the ribbon — a vakantie is a gap, a vrije dag only narrows a block.
    /// </summary>
    private static Schooljaar BouwSchooljaar()
    {
        var schooljaar = new Schooljaar(SchooljaarNaam, new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));

        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));
        schooljaar.VoegSluitingToe(new Schoolsluiting(
            "Hemelvaart", new DateOnly(2027, 5, 6), new DateOnly(2027, 5, 7), Sluitingssoort.VrijeDag));
        schooljaar.VoegSluitingToe(new Schoolsluiting(
            "Pinkstermaandag", new DateOnly(2027, 5, 17), new DateOnly(2027, 5, 17), Sluitingssoort.VrijeDag));

        return schooljaar;
    }

    /// <summary>
    /// Which themaperiode each thema in <see cref="BouwThemas"/> is placed in, by index.
    /// <para>
    /// Not simply <c>0,1,2,3,…</c>: periode 3 (index 2) deliberately holds <b>three</b> thema's so the
    /// "te vol" flag actually fires in the demo. One card per period would leave
    /// <c>VOORLOPIGE_TE_VOL_DREMPEL</c> unreachable, and E3-10 question C — "when is a period te vol?" —
    /// would go to the review with its own illustration invisible. Periode 4 (index 3) is left empty for
    /// the same reason in reverse: the empty-period state is what a teacher looking for room actually sees.
    /// </para>
    /// </summary>
    private static readonly int[] BlokVoorThema = [0, 1, 2, 2, 2, 4, 5];

    private static List<Thema> BouwThemas() =>
    [
        new("Ik en mijn klas", duurWeken: 5, invalshoeken: "sociale vaardigheden"),
        new("Herfst en oogst", duurWeken: 5, invalshoeken: "natuur"),
        new("Licht en donker", duurWeken: 6, invalshoeken: "natuur, techniek"),
        new("Water", duurWeken: 6, invalshoeken: "natuur, techniek"),
        new("Lente en groei", duurWeken: 6, invalshoeken: "natuur"),
        new("Verkeer", duurWeken: 5, invalshoeken: "veiligheid"),
        new("Zomer en vakantie", duurWeken: 5, invalshoeken: "natuur, cultuur"),
    ];

    /// <summary>
    /// Stand-in motivations in the register a real AI answer uses (Art. IV.3: a short "waarom hier?"). Dutch,
    /// because this is teacher-facing text a reviewer reads on the card.
    /// </summary>
    private static readonly string[] Motivaties =
    [
        "past bij het begin van het schooljaar en de groepsvorming",
        "sluit aan bij het seizoen in deze periode",
        "de donkere maanden maken dit thema concreet waarneembaar",
        "goed te combineren met buitenobservaties in deze periode",
        "het seizoen levert direct waarneembaar materiaal op",
        "sluit aan bij de fietsexamens later in het jaar",
        "rondt het schooljaar af en blikt vooruit",
    ];
}
