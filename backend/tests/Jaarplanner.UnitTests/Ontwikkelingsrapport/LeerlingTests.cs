using System.Reflection;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="Leerling"/> (FB-001, Art. IX.4, VI.7): two trimmed, required names of at most 100 characters, an id of its
/// own, and <b>nothing else about a child</b>, in the class and in the table. A refusal names the field, never the name
/// (ADR-0035 §3.8). All names here are made up.
/// </summary>
public sealed class LeerlingTests
{
    private static readonly Guid KlasId = Guid.NewGuid();

    [Fact]
    public void Een_leerling_bewaart_de_namen_getrimd_en_krijgt_een_eigen_id()
    {
        var fien = new Leerling(KlasId, "  Fien ", " Proefmans  ");
        var staf = new Leerling(KlasId, "Staf", "Voorbeeld");

        Assert.Equal("Fien", fien.Voornaam);
        Assert.Equal("Proefmans", fien.Achternaam);
        Assert.Equal(KlasId, fien.KlasId);
        Assert.NotEqual(Guid.Empty, fien.Id);
        Assert.NotEqual(fien.Id, staf.Id);
    }

    [Theory]
    [InlineData(null, "Proefmans")]
    [InlineData("", "Proefmans")]
    [InlineData("   ", "Proefmans")]
    [InlineData("Fien", null)]
    [InlineData("Fien", "")]
    [InlineData("Fien", "  ")]
    public void Een_leerling_zonder_voornaam_of_achternaam_bestaat_niet(string? voornaam, string? achternaam)
    {
        Assert.Throws<ArgumentException>(() => new Leerling(KlasId, voornaam!, achternaam!));
    }

    [Fact]
    public void Een_leerling_zonder_klas_bestaat_niet()
    {
        Assert.Throws<ArgumentException>(() => new Leerling(Guid.Empty, "Fien", "Proefmans"));
    }

    [Fact]
    public void Honderd_tekens_mag_en_honderdeen_niet_ook_na_het_trimmen()
    {
        var honderd = new string('a', Leerling.MaxNaamLengte);

        Assert.Equal(honderd, new Leerling(KlasId, $"  {honderd}  ", honderd).Voornaam);
        Assert.Throws<ArgumentException>(() => new Leerling(KlasId, honderd + "a", "Proefmans"));
        Assert.Throws<ArgumentException>(() => new Leerling(KlasId, "Fien", honderd + "a"));
    }

    [Fact]
    public void Een_weigering_noemt_het_veld_en_nooit_de_naam()
    {
        // A fault can reach a log (ADR-0035 §3.8): the message may say which field, never what was typed.
        var teLang = "Proefmans" + new string('x', Leerling.MaxNaamLengte);

        var fout = Assert.Throws<ArgumentException>(() => new Leerling(KlasId, "Fien", teLang));

        Assert.Equal("achternaam", fout.ParamName);
        Assert.DoesNotContain("Proefmans", fout.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("Fien", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Wijzig_hernoemt_en_een_weigering_verandert_niets()
    {
        var leerling = new Leerling(KlasId, "Staf", "Voorbeeld");

        leerling.Wijzig(" Stef ", "Voorbeeld");
        Assert.Equal("Stef", leerling.Voornaam);

        // The voornaam is valid and the achternaam is not: neither changes.
        Assert.Throws<ArgumentException>(() => leerling.Wijzig("Staf", " "));
        Assert.Equal("Stef", leerling.Voornaam);
        Assert.Equal("Voorbeeld", leerling.Achternaam);
    }

    [Theory]
    [InlineData("K3", true)]
    [InlineData(" K3 ", true)]
    [InlineData("K2", false)]
    [InlineData("JK", false)]
    [InlineData("L1", false)]
    [InlineData("L6", false)]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("K4", false)]
    public void Alleen_een_klas_die_K3_geeft_kan_leerlingen_hebben(string? gesteldeJaarfase, bool verwacht)
    {
        // D9 through the one klas→leeftijden mapping (Leeftijdsrechten), so a klas without a stated jaarfase fails closed.
        Assert.Equal(verwacht, Leerling.KlasKanLeerlingenHebben(gesteldeJaarfase));
    }

    [Fact]
    public void Een_leerling_heeft_geen_ander_gegeven_dan_de_namen_en_de_klas()
    {
        // Art. VI.7: "There is no other field about a child." A property added here is an amendment, not a refactor.
        var eigenschappen = typeof(Leerling)
            .GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
            .Select(p => p.Name)
            .Order(StringComparer.Ordinal);

        Assert.Equal(["Achternaam", "Id", "KlasId", "Voornaam"], eigenschappen);
    }

    [Fact]
    public void De_tabel_leerlingen_heeft_vier_kolommen_en_houdt_de_klas_vast()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=x")
            .Options;
        using var context = new AppDbContext(options);
        var entiteit = context.Model.FindEntityType(typeof(Leerling))!;

        Assert.Equal("leerlingen", entiteit.GetTableName());
        Assert.Equal(
            ["Achternaam", "Id", "KlasId", "Voornaam"],
            entiteit.GetProperties().Select(p => p.Name).Order(StringComparer.Ordinal));
        Assert.Equal(Leerling.MaxNaamLengte, entiteit.FindProperty(nameof(Leerling.Voornaam))!.GetMaxLength());
        Assert.Equal(Leerling.MaxNaamLengte, entiteit.FindProperty(nameof(Leerling.Achternaam))!.GetMaxLength());

        // Restrict, not Cascade: a klas delete must not take a child and their reports along in silence.
        var klas = Assert.Single(entiteit.GetForeignKeys());
        Assert.Equal(typeof(Klas), klas.PrincipalEntityType.ClrType);
        Assert.Equal(DeleteBehavior.Restrict, klas.DeleteBehavior);
    }
}
