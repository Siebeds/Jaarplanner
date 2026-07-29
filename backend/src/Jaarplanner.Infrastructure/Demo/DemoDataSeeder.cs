using Jaarplanner.Application.Planning;
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
/// <c>Demo:Seed</c> is true (set in <c>appsettings.Development.json</c>, absent everywhere else), it is
/// idempotent on the school year's name, and it never touches an existing row. It is registered from
/// <c>AddInfrastructure</c> but does nothing at all unless that flag is on, so a production host that somehow
/// loaded this assembly still writes nothing.
/// </para>
/// <para>
/// <b>The placements are seeded as <c>Voorgesteld</c> with a motivation</b> — the state real generation
/// produces (Art. IV.1/IV.2). Seeding them as <c>Aanvaard</c> would show a reviewer a plan that appears
/// already decided, which is precisely the human-in-the-loop claim the review is meant to test.
/// </para>
/// </summary>
public sealed class DemoDataSeeder : IHostedService
{
    /// <summary>The label the seed is idempotent on. A year with this name means the seed already ran.</summary>
    public const string SchooljaarNaam = "2026-2027";

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
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!await context.Database.CanConnectAsync(cancellationToken))
        {
            // No database is not an error here — the app must still start (the /health split exists for
            // exactly this). Log and skip rather than taking the host down over demo data.
            _logger.LogWarning("Demo seed skipped: no database connection.");

            return;
        }

        if (await context.Schooljaren.AnyAsync(s => s.Naam == SchooljaarNaam, cancellationToken))
        {
            _logger.LogInformation("Demo seed skipped: schooljaar {Naam} already exists.", SchooljaarNaam);

            return;
        }

        var schooljaar = BouwSchooljaar();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        context.Schooljaren.Add(schooljaar);

        var themas = BouwThemas();
        context.Themas.AddRange(themas);

        // Place the thema's on the blocks the CONFIGURED seam derives, never on hard-coded dates: a demo plan
        // keyed on invented boundaries would render as stale the moment the grain changed, and the stale
        // notice is one of the things the review is looking at.
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        var jaarplan = new Jaarplan(klas.Id);
        foreach (var (thema, index) in themas.Select((t, i) => (t, i)))
        {
            if (index >= blokken.Count)
            {
                break;
            }

            jaarplan.VoegPlaatsingToe(
                thema.Id,
                Planningsblokniveau.Themaperiode,
                blokken[index].Start,
                KoppelingStatus.Voorgesteld,
                Motivaties[index % Motivaties.Length]);
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
