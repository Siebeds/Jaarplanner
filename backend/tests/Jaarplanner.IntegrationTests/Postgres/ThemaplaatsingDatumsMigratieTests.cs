using System.Reflection;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The migration <c>ThemaplaatsingDatums</c> converts plans keyed on themaperiodes into placements with their own days,
/// by the owner's rules of 2026-09-16 (FB-035, ADR-0049 decision 8). Every expected date below is worked out by hand
/// from the school year in <see cref="BouwSchooljaar"/>, so the PL/pgSQL is checked against the rules rather than
/// against itself.
/// <para>
/// The year runs from Tuesday 1 September 2026 to Wednesday 30 June 2027. Its first teaching stretch, up to the
/// herfstvakantie (2–6 November), is 62 days and becomes two themaperiodes of 31 days: 1 September – 1 October and
/// 2 October – 1 November. The next two stretches (7 November – 20 December, 2 January – 14 February) are 44 days and
/// stay one period each. Wednesday 11 November is a free day, which does not split anything.
/// </para>
/// </summary>
public sealed class ThemaplaatsingDatumsMigratieTests : IAsyncLifetime
{
    private const string VorigeMigratie = "20260916122525_ThemaMinimumdoelen";

    // Fixed ids, so the order the migration puts several thema's of one period in (by thema id) is known here.
    private static readonly Guid Eerste = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Tweede = Guid.Parse("20000000-0000-0000-0000-000000000002");
    private static readonly Guid Derde = Guid.Parse("30000000-0000-0000-0000-000000000003");
    private static readonly Guid Lang = Guid.Parse("40000000-0000-0000-0000-000000000004");
    private static readonly Guid Vijfde = Guid.Parse("50000000-0000-0000-0000-000000000005");

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("fb035", VorigeMigratie);
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    /// <summary>
    /// One plan with the cases a school's real plans hold: a lone thema per period, three thema's in one period of which
    /// the last finds no free day, and a rejected proposal.
    /// </summary>
    [PostgresFact]
    public async Task Zet_periodes_om_naar_eigen_datums()
    {
        var (klasA, _) = await SeedAsync();
        var planA = await MaakJaarplanAsync(klasA);

        await VoegOudePlaatsingToeAsync(planA, Vijfde, D(2026, 9, 1), "Aanvaard", "past bij de start");
        // Three in the second period, in id order: 2 weeks, 3 weeks, then 1 week that no longer fits.
        await VoegOudePlaatsingToeAsync(planA, Eerste, D(2026, 10, 2), "Manueel");
        await VoegOudePlaatsingToeAsync(planA, Tweede, D(2026, 10, 2), "Voorgesteld", "herfst");
        await VoegOudePlaatsingToeAsync(planA, Derde, D(2026, 10, 2), "Manueel");
        await VoegOudePlaatsingToeAsync(planA, Lang, D(2026, 11, 7), "Manueel");
        await VoegOudePlaatsingToeAsync(planA, Vijfde, D(2027, 1, 2), "Geweigerd", "winter");

        await _db.MigreerAsync();

        var plaatsingen = await LaadAsync(klasA);

        Assert.Equal(
            [
                // Alone in 1 Sep – 1 Oct: the period's first and last schooldag.
                (Vijfde, D(2026, 9, 1), D(2026, 10, 1), KoppelingStatus.Aanvaard, (string?)"past bij de start"),
                // Friday 2 Oct + 2 lesweken: the last schooldag before Friday 16 Oct.
                (Eerste, D(2026, 10, 2), D(2026, 10, 15), KoppelingStatus.Manueel, null),
                // From Friday 16 Oct, 3 lesweken would end on Thursday 12 Nov (the herfstvakantie week does not count),
                // but the next occupied period starts on Monday 9 Nov, so it stops on the last schooldag before it.
                (Tweede, D(2026, 10, 16), D(2026, 10, 30), KoppelingStatus.Voorgesteld, "herfst"),
                // Alone in 7 Nov – 20 Dec: first schooldag Monday 9 Nov, last Friday 18 Dec.
                (Lang, D(2026, 11, 9), D(2026, 12, 18), KoppelingStatus.Manueel, null),
            ],
            plaatsingen);
    }

    /// <summary>
    /// Several thema's in the last occupied period run on by their duration and split at a vacation, and a start date
    /// that matches no period starts the thema there.
    /// </summary>
    [PostgresFact]
    public async Task Splitst_bij_een_vakantie_en_behoudt_een_losse_begindatum()
    {
        var (_, klasB) = await SeedAsync();
        var planB = await MaakJaarplanAsync(klasB);

        await VoegOudePlaatsingToeAsync(planB, Eerste, D(2026, 11, 7), "Manueel");
        await VoegOudePlaatsingToeAsync(planB, Lang, D(2026, 11, 7), "Voorgesteld", "voor de kerst");
        // Wednesday 20 January starts no period.
        await VoegOudePlaatsingToeAsync(planB, Tweede, D(2027, 1, 20), "Aanvaard");

        await _db.MigreerAsync();

        var plaatsingen = await LaadAsync(klasB);

        Assert.Equal(
            [
                // Monday 9 Nov + 2 lesweken: the last schooldag before Monday 23 Nov.
                (Eerste, D(2026, 11, 9), D(2026, 11, 20), KoppelingStatus.Manueel, (string?)null),
                // Monday 23 Nov + 5 lesweken, skipping the two kerstvakantie weeks: the last schooldag before Monday
                // 11 Jan. The kerstvakantie splits it; both parts keep the proposal and its motivation.
                (Lang, D(2026, 11, 23), D(2026, 12, 18), KoppelingStatus.Voorgesteld, "voor de kerst"),
                (Lang, D(2027, 1, 4), D(2027, 1, 8), KoppelingStatus.Voorgesteld, "voor de kerst"),
                // Wednesday 20 Jan + 3 lesweken: the last schooldag before Wednesday 10 Feb.
                (Tweede, D(2027, 1, 20), D(2027, 2, 9), KoppelingStatus.Aanvaard, null),
            ],
            plaatsingen);
    }

    /// <summary>
    /// A start that matches no period can lie inside a period that holds one placement. The lone placement then ends
    /// before it, so no two rows share a day; and when both starts roll forward to the same schooldag, the earlier one
    /// has no day left and is deleted rather than breaking the unique first day (antagonist round 1).
    /// </summary>
    [PostgresFact]
    public async Task Een_losse_begindatum_in_een_periode_met_een_thema_overlapt_niet()
    {
        var (klasA, klasB) = await SeedAsync();
        var planA = await MaakJaarplanAsync(klasA);
        var planB = await MaakJaarplanAsync(klasB);

        // Alone in 2 Jan – 14 Feb, and a stale start on Wednesday 20 January inside that period.
        await VoegOudePlaatsingToeAsync(planA, Vijfde, D(2027, 1, 2), "Manueel");
        await VoegOudePlaatsingToeAsync(planA, Tweede, D(2027, 1, 20), "Aanvaard");
        // Alone in 7 Nov – 20 Dec (starting on a Saturday), and a stale start on the Sunday after: both roll to Monday 9 Nov.
        await VoegOudePlaatsingToeAsync(planB, Eerste, D(2026, 11, 7), "Manueel");
        await VoegOudePlaatsingToeAsync(planB, Lang, D(2026, 11, 8), "Manueel");

        await _db.MigreerAsync();

        Assert.Equal(
            [
                // Its period's first schooldag, cut on the last schooldag before 20 January.
                (Vijfde, D(2027, 1, 4), D(2027, 1, 19), KoppelingStatus.Manueel, (string?)null),
                // Wednesday 20 Jan + 3 lesweken: the last schooldag before Wednesday 10 Feb.
                (Tweede, D(2027, 1, 20), D(2027, 2, 9), KoppelingStatus.Aanvaard, null),
            ],
            await LaadAsync(klasA));
        Assert.Equal(
            [
                // Monday 9 Nov + 5 lesweken: the last schooldag before Monday 14 Dec. The lone placement had no day left.
                (Lang, D(2026, 11, 9), D(2026, 12, 11), KoppelingStatus.Manueel, (string?)null),
            ],
            await LaadAsync(klasB));
    }

    private static DateOnly D(int jaar, int maand, int dag) => new(jaar, maand, dag);

    private static Schooljaar BouwSchooljaar()
    {
        var schooljaar = new Schooljaar("2026-2027", D(2026, 9, 1), D(2027, 6, 30));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", D(2026, 11, 2), D(2026, 11, 6), Sluitingssoort.Vakantie));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Wapenstilstand", D(2026, 11, 11), D(2026, 11, 11), Sluitingssoort.VrijeDag));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", D(2026, 12, 21), D(2027, 1, 1), Sluitingssoort.Vakantie));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", D(2027, 2, 15), D(2027, 2, 19), Sluitingssoort.Vakantie));

        return schooljaar;
    }

    private async Task<(Guid KlasA, Guid KlasB)> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = BouwSchooljaar();
        var klasA = schooljaar.VoegKlasToe("FB-035 klas A", "L3");
        var klasB = schooljaar.VoegKlasToe("FB-035 klas B", "L3");
        context.Schooljaren.Add(schooljaar);

        context.Themas.AddRange(
            MetId(new Thema("Vijf weken", duurWeken: 5), Vijfde),
            MetId(new Thema("Twee weken", duurWeken: 2), Eerste),
            MetId(new Thema("Drie weken", duurWeken: 3), Tweede),
            MetId(new Thema("Eén week", duurWeken: 1), Derde),
            MetId(new Thema("Lang", duurWeken: 5), Lang));

        await context.SaveChangesAsync();

        return (klasA.Id, klasB.Id);
    }

    private static Thema MetId(Thema thema, Guid id)
    {
        typeof(Thema).GetProperty(nameof(Thema.Id), BindingFlags.Public | BindingFlags.Instance)!.SetValue(thema, id);

        return thema;
    }

    private async Task<Guid> MaakJaarplanAsync(Guid klasId)
    {
        await using var context = _db.MaakContext();
        var id = Guid.NewGuid();
        await context.Database.ExecuteSqlAsync(
            $"""INSERT INTO jaarplannen ("Id", "KlasId") VALUES ({id}, {klasId})""");

        return id;
    }

    // The table as it was before the migration: a placement keyed on its period's start.
    private async Task VoegOudePlaatsingToeAsync(
        Guid jaarplanId,
        Guid themaId,
        DateOnly blokStart,
        string status,
        string? motivatie = null)
    {
        await using var context = _db.MaakContext();
        await context.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO themaplaatsingen ("Id", "JaarplanId", "ThemaId", "BlokNiveau", "BlokStart", "Status", "AiMotivatie", "Vergrendeld")
            VALUES ({Guid.NewGuid()}, {jaarplanId}, {themaId}, 'Themaperiode', {blokStart}, {status}, {motivatie}, false)
            """);
    }

    private async Task<List<(Guid, DateOnly, DateOnly, KoppelingStatus, string?)>> LaadAsync(Guid klasId)
    {
        await using var context = _db.MaakContext();
        var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId);

        return jaarplan.Plaatsingen
            .Select(p => (p.ThemaId, p.Van, p.Tot, p.Status, p.AiMotivatie))
            .ToList();
    }
}
