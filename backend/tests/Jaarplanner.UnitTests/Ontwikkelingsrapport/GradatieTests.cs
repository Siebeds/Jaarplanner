using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="Gradatie"/> and its palette (FB-002, Art. IX.4, ADR-0035 §3.1): a trimmed, required label of at most 60
/// characters, one of the six colours the owner ruled on 2026-09-15 in that order, and a place on the scale. The table
/// has no schooljaar (R7) and keeps the colour by name.
/// </summary>
public sealed class GradatieTests
{
    [Fact]
    public void De_vaste_kleurenlijst_is_de_zes_kleuren_van_de_eigenaar_in_die_volgorde()
    {
        // The order is what the colour choice shows (GET /api/gradaties/kleuren), so it is pinned, not only the set.
        Assert.Equal(["Groen", "Lichtgroen", "Geel", "Oranje", "Rood", "Blauw"], Enum.GetNames<Sterkleur>());
    }

    [Fact]
    public void Een_gradatie_krijgt_een_eigen_id_en_een_getrimd_label()
    {
        var gradatie = new Gradatie("  Volledig bereikt ", Sterkleur.Groen, 1);

        Assert.NotEqual(Guid.Empty, gradatie.Id);
        Assert.NotEqual(gradatie.Id, new Gradatie("Nog niet volledig", Sterkleur.Oranje, 2).Id);
        Assert.Equal("Volledig bereikt", gradatie.Label);
        Assert.Equal(Sterkleur.Groen, gradatie.Kleur);
        Assert.Equal(1, gradatie.Volgorde);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Een_label_is_verplicht(string? label)
    {
        Assert.Throws<ArgumentException>(() => new Gradatie(label!, Sterkleur.Groen, 1));
    }

    [Fact]
    public void Een_label_is_hoogstens_60_tekens_lang_na_het_trimmen()
    {
        Assert.Equal(60, new Gradatie($" {new string('a', 60)} ", Sterkleur.Groen, 1).Label.Length);
        Assert.Throws<ArgumentException>(() => new Gradatie(new string('a', 61), Sterkleur.Groen, 1));
    }

    [Fact]
    public void Een_kleur_buiten_de_lijst_of_een_negatieve_plaats_wordt_geweigerd()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Gradatie("Bijna", (Sterkleur)6, 1));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Gradatie("Bijna", Sterkleur.Geel, -1));
    }

    [Fact]
    public void Wijzig_hernoemt_en_herkleurt_en_een_weigering_verandert_niets()
    {
        var gradatie = new Gradatie("Volledig bereikt", Sterkleur.Groen, 1);

        gradatie.Wijzig(" Bijna ", Sterkleur.Geel);
        Assert.Equal(("Bijna", Sterkleur.Geel), (gradatie.Label, gradatie.Kleur));

        // Both are checked before either changes.
        Assert.Throws<ArgumentOutOfRangeException>(() => gradatie.Wijzig("Anders", (Sterkleur)99));
        Assert.Throws<ArgumentException>(() => gradatie.Wijzig(" ", Sterkleur.Rood));
        Assert.Equal(("Bijna", Sterkleur.Geel), (gradatie.Label, gradatie.Kleur));
    }

    [Fact]
    public void ZetVolgorde_verplaatst_de_ster()
    {
        var gradatie = new Gradatie("Bijna", Sterkleur.Geel, 3);

        gradatie.ZetVolgorde(1);

        Assert.Equal(1, gradatie.Volgorde);
        Assert.Throws<ArgumentOutOfRangeException>(() => gradatie.ZetVolgorde(-1));
    }

    [Fact]
    public void De_tabel_heeft_geen_schooljaar_en_bewaart_de_kleur_bij_naam()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=x")
            .Options;
        using var context = new AppDbContext(options);
        var entiteit = context.Model.FindEntityType(typeof(Gradatie))!;

        Assert.Equal("gradaties", entiteit.GetTableName());
        // R7: one scale for all time. A schooljaar column here would be a different ruling, not a migration.
        Assert.Equal(["Id", "Kleur", "Label", "Volgorde"], entiteit.GetProperties().Select(p => p.Name).Order(StringComparer.Ordinal));
        Assert.Equal(Gradatie.MaxLabelLengte, entiteit.FindProperty(nameof(Gradatie.Label))!.GetMaxLength());

        var kleur = entiteit.FindProperty(nameof(Gradatie.Kleur))!.GetValueConverter()!;
        Assert.Equal("Oranje", kleur.ConvertToProvider(Sterkleur.Oranje));
        Assert.Equal(Sterkleur.Lichtgroen, kleur.ConvertFromProvider("Lichtgroen"));
    }
}
