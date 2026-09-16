using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// FB-060: a thema's icoon is nothing or exactly one emoji, including the emoji that are several code points (a
/// family, a flag, a keycap, a skin tone) and those the app's own picker does not offer, which a teacher can still type
/// through the operating system's emoji panel.
/// </summary>
public sealed class ThemaIcoonTests
{
    [Theory]
    [InlineData("🍂")]
    [InlineData("🦖")]
    [InlineData("☀️")]
    [InlineData("❄")]
    [InlineData("👨‍👩‍👧")]
    [InlineData("👋🏽")]
    [InlineData("🇧🇪")]
    [InlineData("1️⃣")]
    [InlineData("#️⃣")]
    [InlineData("🏴󠁧󠁢󠁳󠁣󠁴󠁿")]
    [InlineData("❤️‍🔥")]
    [InlineData("⤴️")]
    public void Een_emoji_wordt_aanvaard(string emoji) =>
        Assert.Equal(emoji, ThemaIcoon.Normaliseer(emoji));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Niets_wordt_geen_icoon(string? waarde) =>
        Assert.Null(ThemaIcoon.Normaliseer(waarde));

    [Fact]
    public void Witruimte_rond_het_emoji_valt_weg() =>
        Assert.Equal("🐮", ThemaIcoon.Normaliseer(" 🐮 "));

    [Theory]
    [InlineData("a")]
    [InlineData("Herfst")]
    [InlineData("1")]
    [InlineData("é")]
    [InlineData("🍂🍄")]
    [InlineData("🍂 herfst")]
    [InlineData(":)")]
    [InlineData("→a")]
    public void Tekst_of_meer_dan_een_emoji_wordt_geweigerd(string waarde)
    {
        var fout = Assert.Throws<ArgumentException>(() => ThemaIcoon.Normaliseer(waarde));
        Assert.Equal(ThemaIcoon.Foutzin, fout.Message);
    }

    [Fact]
    public void Een_te_lange_reeks_wordt_geweigerd()
    {
        // Twelve people joined into one cluster: 35 UTF-16 units, three over the cap.
        var reeks = string.Concat(Enumerable.Repeat("\U0001F468‍", 11)) + "\U0001F467";
        Assert.True(reeks.Length > ThemaIcoon.MaxLengte);
        Assert.Throws<ArgumentException>(() => ThemaIcoon.Normaliseer(reeks));
    }

    [Fact]
    public void Een_thema_kan_een_icoon_krijgen_en_weer_verliezen()
    {
        var thema = new Thema("Herfst", 4);
        Assert.Null(thema.Icoon);

        thema.WijzigIcoon("🍂");
        Assert.Equal("🍂", thema.Icoon);

        thema.WijzigIcoon(null);
        Assert.Null(thema.Icoon);
    }

    [Fact]
    public async Task De_beheerservice_bewaart_het_icoon_en_weigert_tekst_met_een_zin_voor_de_leerkracht()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"thema_icoon_{Guid.NewGuid():N}")
            .Options;

        var gemaakt = await new SchoolcontentBeheerService(new AppDbContext(options))
            .MaakThemaAsync(new ThemaCreatie("Boerderij", 5, Icoon: "🐮"));
        Assert.Equal("🐮", gemaakt.Icoon);

        var bibliotheek = await new SchoolcontentBeheerService(new AppDbContext(options)).HaalThemaBibliotheekOpAsync();
        Assert.Equal("🐮", Assert.Single(bibliotheek).Icoon);

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() =>
            new SchoolcontentBeheerService(new AppDbContext(options))
                .WijzigThemaAsync(gemaakt.Id, new ThemaWijziging("Boerderij", 5, Icoon: "koe")));
        Assert.Equal(ThemaIcoon.Foutzin, fout.Message);

        var zonder = await new SchoolcontentBeheerService(new AppDbContext(options))
            .WijzigThemaAsync(gemaakt.Id, new ThemaWijziging("Boerderij", 5, Icoon: null));
        Assert.Null(zonder.Icoon);
    }
}
