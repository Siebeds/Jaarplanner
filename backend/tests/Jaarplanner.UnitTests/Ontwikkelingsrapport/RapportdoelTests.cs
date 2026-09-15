using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="Rapportdoel"/> (FB-002, Art. IX.4, ADR-0035 §3.1, R3): a trimmed, required titel of at most 120 characters,
/// a place in the set, and a set of subdoel ids, each once. And its tables: no schooljaar (R7), and a join that the
/// database empties when a subdoel goes (D3) while <c>Subdoel</c> stays unaware of it. Which subdoelen qualify (D11, D12)
/// is the service's, and is tested over PostgreSQL in <c>RapportsetEndpointsTests</c>.
/// </summary>
public sealed class RapportdoelTests
{
    private static readonly Guid A = Guid.Parse("a1000000-0000-4000-8000-000000000001");
    private static readonly Guid B = Guid.Parse("b2000000-0000-4000-8000-000000000002");
    private static readonly Guid C = Guid.Parse("c3000000-0000-4000-8000-000000000003");

    [Fact]
    public void Een_rapportdoel_krijgt_een_eigen_id_een_getrimde_titel_en_elk_subdoel_een_keer()
    {
        var rapportdoel = new Rapportdoel("  Luisteren en spreken ", 1, [A, B, A]);

        Assert.NotEqual(Guid.Empty, rapportdoel.Id);
        Assert.Equal("Luisteren en spreken", rapportdoel.Titel);
        Assert.Equal(1, rapportdoel.Volgorde);
        Assert.Equal([A, B], rapportdoel.Subdoelen.Select(rs => rs.SubdoelId));
        Assert.All(rapportdoel.Subdoelen, rs => Assert.Equal(rapportdoel.Id, rs.RapportdoelId));
    }

    [Fact]
    public void Het_domein_kent_een_rapportdoel_zonder_subdoelen()
    {
        // The entity allows it, because a delete elsewhere (D3) can empty one through the cascade. Saving one empty is
        // refused by the service (owner, 2026-09-15: at least one subdoel), which `RapportsetEndpointsTests` pins.
        Assert.Empty(new Rapportdoel("Luisteren en spreken", 1, []).Subdoelen);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Een_titel_is_verplicht(string? titel)
    {
        Assert.Throws<ArgumentException>(() => new Rapportdoel(titel!, 1, [A]));
    }

    [Fact]
    public void Een_titel_is_hoogstens_120_tekens_lang_na_het_trimmen()
    {
        Assert.Equal(120, new Rapportdoel($" {new string('a', 120)} ", 1, []).Titel.Length);
        Assert.Throws<ArgumentException>(() => new Rapportdoel(new string('a', 121), 1, []));
    }

    [Fact]
    public void Een_leeg_subdoelid_of_een_negatieve_plaats_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() => new Rapportdoel("Luisteren en spreken", 1, [A, Guid.Empty]));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Rapportdoel("Luisteren en spreken", -1, [A]));
    }

    [Fact]
    public void Wijzig_vervangt_de_set_en_houdt_de_rij_van_een_subdoel_dat_blijft()
    {
        var rapportdoel = new Rapportdoel("Luisteren en spreken", 1, [A, B]);
        var rijVanA = rapportdoel.Subdoelen.Single(rs => rs.SubdoelId == A);

        rapportdoel.Wijzig(" Spreken ", [C, A, C]);

        Assert.Equal("Spreken", rapportdoel.Titel);
        Assert.Equal([A, C], rapportdoel.Subdoelen.Select(rs => rs.SubdoelId).Order());
        // The row that stays is the same object, so EF sees no delete-and-insert of the same key.
        Assert.Same(rijVanA, rapportdoel.Subdoelen.Single(rs => rs.SubdoelId == A));
    }

    [Fact]
    public void Een_geweigerde_wijziging_verandert_niets()
    {
        var rapportdoel = new Rapportdoel("Luisteren en spreken", 1, [A, B]);

        Assert.Throws<ArgumentException>(() => rapportdoel.Wijzig(" ", [C]));
        Assert.Throws<ArgumentException>(() => rapportdoel.Wijzig("Spreken", [C, Guid.Empty]));

        Assert.Equal("Luisteren en spreken", rapportdoel.Titel);
        Assert.Equal([A, B], rapportdoel.Subdoelen.Select(rs => rs.SubdoelId));
    }

    [Fact]
    public void ZetVolgorde_verplaatst_het_rapportdoel()
    {
        var rapportdoel = new Rapportdoel("Luisteren en spreken", 2, []);

        rapportdoel.ZetVolgorde(1);

        Assert.Equal(1, rapportdoel.Volgorde);
    }

    [Fact]
    public void De_tabellen_hebben_geen_schooljaar_en_een_subdoel_neemt_zijn_rij_mee()
    {
        var model = Model();
        var rapportdoel = model.FindEntityType(typeof(Rapportdoel))!;
        var join = model.FindEntityType(typeof(RapportdoelSubdoel))!;

        Assert.Equal("rapportdoelen", rapportdoel.GetTableName());
        Assert.Equal(["Id", "Titel", "Volgorde"], rapportdoel.GetProperties().Select(p => p.Name).Order(StringComparer.Ordinal));
        Assert.Equal(Rapportdoel.MaxTitelLengte, rapportdoel.FindProperty(nameof(Rapportdoel.Titel))!.GetMaxLength());

        Assert.Equal("rapportdoel_subdoelen", join.GetTableName());
        Assert.Equal(["RapportdoelId", "SubdoelId"], join.FindPrimaryKey()!.Properties.Select(p => p.Name));

        // D3: whatever deletes a subdoel deletes its rows here, in the database, loaded or not. And the rapportdoel
        // takes its rows along.
        var naarSubdoel = join.GetForeignKeys().Single(fk => fk.PrincipalEntityType.ClrType == typeof(Subdoel));
        var naarRapportdoel = join.GetForeignKeys().Single(fk => fk.PrincipalEntityType.ClrType == typeof(Rapportdoel));
        Assert.Equal(DeleteBehavior.Cascade, naarSubdoel.DeleteBehavior);
        Assert.Equal(DeleteBehavior.Cascade, naarRapportdoel.DeleteBehavior);

        // Subdoel and Subthema stay unaware of the report: no navigation from their side.
        Assert.Null(naarSubdoel.PrincipalToDependent);
        Assert.DoesNotContain(
            model.FindEntityType(typeof(Subthema))!.GetNavigations(),
            n => n.TargetEntityType.ClrType == typeof(RapportdoelSubdoel));
    }

    private static IModel Model()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=x")
            .Options;
        using var context = new AppDbContext(options);
        return context.Model;
    }
}
