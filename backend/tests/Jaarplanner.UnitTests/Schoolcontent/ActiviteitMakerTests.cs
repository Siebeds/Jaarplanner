using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// An activiteit created by hand records its maker (E6-02, Art. IX.2, ADR-0030 R26). The FK and its SetNull are
/// database guarantees and are pinned against PostgreSQL; this pins what the service writes.
/// </summary>
public sealed class ActiviteitMakerTests : IDisposable
{
    private readonly DbContextOptions<AppDbContext> _options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase($"activiteit_maker_{Guid.NewGuid():N}")
        .Options;

    private SchoolcontentBeheerService NieuweService() => new(new AppDbContext(_options));

    public void Dispose()
    {
        using var context = new AppDbContext(_options);
        context.Database.EnsureDeleted();
    }

    [Fact]
    public async Task Wie_een_activiteit_met_de_hand_maakt_is_haar_maker()
    {
        var an = await BewaarGebruikerAsync();
        var subthemaId = await MaakSubthemaAsync();

        var weergave = await NieuweService().MaakActiviteitAsync(
            subthemaId, an.Id, new ActiviteitCreatie("Plassen meten", ActiviteitType.Waarneming));

        Assert.Equal(an.Id, weergave.MakerId);
        await using var context = new AppDbContext(_options);
        Assert.Equal(an.Id, (await context.Activiteiten.SingleAsync()).MakerId);
    }

    [Fact]
    public async Task Een_maker_die_niet_bestaat_wordt_geen_maker()
    {
        // As a removed maker leaves it (I17): no maker, so only a hoofdleerkracht or directie deletes it.
        var subthemaId = await MaakSubthemaAsync();

        var weergave = await NieuweService().MaakActiviteitAsync(
            subthemaId, Guid.NewGuid(), new ActiviteitCreatie("Plassen meten", ActiviteitType.Waarneming));

        Assert.Null(weergave.MakerId);
    }

    [Fact]
    public async Task Zonder_maker_blijft_de_maker_leeg()
    {
        var subthemaId = await MaakSubthemaAsync();

        var weergave = await NieuweService().MaakActiviteitAsync(
            subthemaId, makerId: null, new ActiviteitCreatie("Plassen meten", ActiviteitType.Waarneming));

        Assert.Null(weergave.MakerId);
    }

    private async Task<Gebruiker> BewaarGebruikerAsync()
    {
        var an = new Gebruiker("an@school.be", "An", isDirectie: false);
        await using var context = new AppDbContext(_options);
        context.Gebruikers.Add(an);
        await context.SaveChangesAsync();
        return an;
    }

    private async Task<Guid> MaakSubthemaAsync()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, "K3"));
        return subthema.Id;
    }
}
