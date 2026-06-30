using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the EF Core mapping of the curriculum entities without needing a live database: the
/// model is built against the Npgsql provider (model building does not open a connection).
/// Asserts <see cref="Leerplandoel.Code"/> uniqueness/identity, the nullable cluster, and the
/// queryable composite <c>(domein, subdomein)</c> grouping key (Art. VII.0, IX.1).
/// </summary>
public class CurriculumModelConfigurationTests
{
    private static IModel BuildModel()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=x")
            .Options;
        using var context = new AppDbContext(options);
        return context.Model;
    }

    [Fact]
    public void Leerplandoel_code_is_the_primary_key()
    {
        var entity = BuildModel().FindEntityType(typeof(Leerplandoel))!;
        var pk = entity.FindPrimaryKey()!;

        Assert.Single(pk.Properties);
        Assert.Equal(nameof(Leerplandoel.Code), pk.Properties[0].Name);
    }

    [Fact]
    public void Discipline_nummer_is_the_primary_key()
    {
        var entity = BuildModel().FindEntityType(typeof(Discipline))!;
        Assert.Equal(nameof(Discipline.Nummer), entity.FindPrimaryKey()!.Properties[0].Name);
    }

    [Fact]
    public void Minimumdoel_ref_is_the_primary_key()
    {
        var entity = BuildModel().FindEntityType(typeof(Minimumdoel))!;
        Assert.Equal(nameof(Minimumdoel.Ref), entity.FindPrimaryKey()!.Properties[0].Name);
    }

    [Fact]
    public void Leerplandoel_cluster_is_nullable()
    {
        var entity = BuildModel().FindEntityType(typeof(Leerplandoel))!;
        var cluster = entity.FindProperty(nameof(Leerplandoel.Cluster))!;
        Assert.True(cluster.IsNullable);
    }

    [Fact]
    public void Leerplandoel_minimumdoelRef_is_nullable()
    {
        var entity = BuildModel().FindEntityType(typeof(Leerplandoel))!;
        var minimumdoelRef = entity.FindProperty(nameof(Leerplandoel.MinimumdoelRef))!;
        Assert.True(minimumdoelRef.IsNullable);
    }

    [Fact]
    public void Leerplandoel_has_a_composite_domein_subdomein_grouping_index()
    {
        var entity = BuildModel().FindEntityType(typeof(Leerplandoel))!;

        var compositeIndex = entity.GetIndexes().FirstOrDefault(i =>
            i.Properties.Count == 2 &&
            i.Properties[0].Name == nameof(Leerplandoel.Domein) &&
            i.Properties[1].Name == nameof(Leerplandoel.Subdomein));

        Assert.NotNull(compositeIndex);
    }

    [Fact]
    public void Leerplandoel_doelsoort_is_stored_as_its_short_code_string()
    {
        var entity = BuildModel().FindEntityType(typeof(Leerplandoel))!;
        var doelsoort = entity.FindProperty(nameof(Leerplandoel.Doelsoort))!;

        var converter = doelsoort.GetValueConverter();
        Assert.NotNull(converter);
        Assert.Equal(typeof(string), converter!.ProviderClrType);

        // The converter applies the single-source mapping (MD/G/+/P/S/A).
        var toProvider = converter.ConvertToProvider;
        Assert.Equal("MD", toProvider(Doelsoort.Minimumdoel));
        Assert.Equal("+", toProvider(Doelsoort.Verdieping));
    }

    [Fact]
    public void Three_curriculum_entities_are_mapped()
    {
        var model = BuildModel();
        Assert.NotNull(model.FindEntityType(typeof(Discipline)));
        Assert.NotNull(model.FindEntityType(typeof(Leerplandoel)));
        Assert.NotNull(model.FindEntityType(typeof(Minimumdoel)));
    }
}
