using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// <c>Leeftijdsinhoud.UitInvoer</c> against the subthema write path's <b>own</b> validation (E6-02 slice 1, fix rounds 2
/// and 3). Slice 3 checks rights on the leeftijd of a subthema create and of an I13 re-scope before the write runs, and
/// may leave an input <c>UitInvoer</c> maps to null for the write to refuse.
/// <para>
/// <b>What a drift would cost.</b> If the rights check refused what the write accepts, a caller deferring to the write
/// would let the write through with <b>no rights check at all</b>. Drifted the other way, a hoofdleerkracht would be
/// refused on their own leeftijd.
/// </para>
/// <para>
/// Both share <c>Jaarfasen.LeesLeeftijd</c> today. This runs both over the same inputs, so widening one without the
/// other fails here. It is a tripwire against un-sharing that function, not a proof over every input.
/// </para>
/// </summary>
public sealed class SubthemaLeeftijdInvoerTests : IDisposable
{
    private readonly DbContextOptions<AppDbContext> _options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase($"subthema_leeftijd_{Guid.NewGuid():N}")
        .Options;

    private SchoolcontentBeheerService NieuweService() => new(new AppDbContext(_options));

    public void Dispose()
    {
        using var context = new AppDbContext(_options);
        context.Database.EnsureDeleted();
    }

    public static TheoryData<string?> Invoer() =>
        new() { "K3", " K3", "L2 ", "  JK  ", "L6", "k3", "3K", "L7", "F1", "", "   ", null };

    [Theory]
    [MemberData(nameof(Invoer))]
    public async Task Het_aanmaken_aanvaardt_precies_wat_UitInvoer_aanvaardt_in_dezelfde_vorm(string? invoer)
    {
        var themaId = (await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4))).Id;
        var bron = Leeftijdsinhoud.UitInvoer(invoer);

        if (bron is null)
        {
            await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
                () => NieuweService().MaakSubthemaAsync(themaId, new SubthemaCreatie("Regen", 2, invoer!)));
            return;
        }

        var subthema = await NieuweService().MaakSubthemaAsync(themaId, new SubthemaCreatie("Regen", 2, invoer!));
        Assert.Equal(bron.Leeftijd, subthema.Leeftijd);
    }

    [Theory]
    [MemberData(nameof(Invoer))]
    public async Task Het_herscopen_aanvaardt_precies_wat_UitInvoer_aanvaardt_in_dezelfde_vorm(string? invoer)
    {
        var themaId = (await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4))).Id;
        var subthemaId = (await NieuweService().MaakSubthemaAsync(themaId, new SubthemaCreatie("Regen", 2, "K2"))).Id;
        var bron = Leeftijdsinhoud.UitInvoer(invoer);

        if (bron is null)
        {
            await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
                () => NieuweService().WijzigSubthemaAsync(subthemaId, new SubthemaWijzigingInvoer("Regen", 2, invoer!)));
            return;
        }

        var subthema = await NieuweService().WijzigSubthemaAsync(subthemaId, new SubthemaWijzigingInvoer("Regen", 2, invoer!));
        Assert.Equal(bron.Leeftijd, subthema.Leeftijd);
    }

    [Fact]
    public async Task De_weigering_van_het_schrijfpad_behoudt_haar_eigen_zin()
    {
        // Sharing the rule did not change what a teacher reads.
        var themaId = (await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4))).Id;

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().MaakSubthemaAsync(themaId, new SubthemaCreatie("Regen", 2, "L7")));

        Assert.Equal("'L7' is geen geldige leeftijd. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6.", fout.Message);
    }
}
