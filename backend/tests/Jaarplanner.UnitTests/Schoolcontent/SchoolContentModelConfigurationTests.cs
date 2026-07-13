using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Pins the EF Core mapping of the school-content entities without a live database (model building
/// does not open a connection). The headline assertions back the E1-02 acceptance criterion that
/// scoping is enforced: <see cref="Subthema.KlasId"/> is a required FK to <see cref="Klas"/> and
/// <see cref="Subthema.Leeftijd"/> is required (class/age-scoped), while the school-scoped
/// <see cref="Thema"/> owns the two-tier woordenschat and the themadoelen.
/// </summary>
public class SchoolContentModelConfigurationTests
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
    public void All_school_content_entities_are_mapped()
    {
        var model = BuildModel();
        Assert.NotNull(model.FindEntityType(typeof(Klas)));
        Assert.NotNull(model.FindEntityType(typeof(Thema)));
        Assert.NotNull(model.FindEntityType(typeof(Themadoel)));
        Assert.NotNull(model.FindEntityType(typeof(Subthema)));
        Assert.NotNull(model.FindEntityType(typeof(Subdoel)));
        Assert.NotNull(model.FindEntityType(typeof(Activiteit)));
    }

    [Fact]
    public void Subthema_klasId_is_a_required_foreign_key_to_klas()
    {
        var entity = BuildModel().FindEntityType(typeof(Subthema))!;

        var klasId = entity.FindProperty(nameof(Subthema.KlasId))!;
        Assert.False(klasId.IsNullable); // class scope cannot be absent (Art. IX.2)

        var fkToKlas = entity.GetForeignKeys()
            .FirstOrDefault(fk => fk.PrincipalEntityType.ClrType == typeof(Klas));
        Assert.NotNull(fkToKlas);
        Assert.Equal(nameof(Subthema.KlasId), fkToKlas!.Properties[0].Name);
        Assert.True(fkToKlas.IsRequired);
    }

    [Fact]
    public void Subthema_leeftijd_is_required()
    {
        var entity = BuildModel().FindEntityType(typeof(Subthema))!;
        Assert.False(entity.FindProperty(nameof(Subthema.Leeftijd))!.IsNullable);
    }

    [Fact]
    public void Subthema_has_a_klas_age_scoping_index()
    {
        var entity = BuildModel().FindEntityType(typeof(Subthema))!;
        var index = entity.GetIndexes().FirstOrDefault(i =>
            i.Properties.Count == 2 &&
            i.Properties[0].Name == nameof(Subthema.KlasId) &&
            i.Properties[1].Name == nameof(Subthema.Leeftijd));
        Assert.NotNull(index);
    }

    [Fact]
    public void Subdoel_leeftijd_is_required_for_the_subthema_age_differentiation()
    {
        var entity = BuildModel().FindEntityType(typeof(Subdoel))!;
        Assert.False(entity.FindProperty(nameof(Subdoel.Leeftijd))!.IsNullable);
    }

    [Fact]
    public void Thema_owns_two_text_array_vocabulary_collections()
    {
        var entity = BuildModel().FindEntityType(typeof(Thema))!;

        var kern = entity.FindProperty(nameof(Thema.Kernwoordenschat))!;
        var rijk = entity.FindProperty(nameof(Thema.RijkeWoordenschat))!;

        Assert.Equal(typeof(IReadOnlyList<string>), kern.ClrType);
        Assert.Equal(typeof(IReadOnlyList<string>), rijk.ClrType);
        Assert.Equal("text[]", kern.GetColumnType());
        Assert.Equal("text[]", rijk.GetColumnType());
    }

    [Fact]
    public void Themadoel_and_subthema_are_owned_by_the_school_scoped_thema()
    {
        var thema = BuildModel().FindEntityType(typeof(Thema))!;
        var navs = thema.GetNavigations().Select(n => n.Name).ToArray();
        Assert.Contains(nameof(Thema.Themadoelen), navs);
        Assert.Contains(nameof(Thema.Subthemas), navs);
    }

    [Fact]
    public void Thema_owns_the_ai_doelsuggesties_in_their_own_table()
    {
        // E2-04: thema-level AI match suggestions are an owned DoelKoppeling collection in their own
        // table, distinct from the capped themadoelen, each persisted as `voorgesteld` + aiMotivatie.
        var thema = BuildModel().FindEntityType(typeof(Thema))!;
        var nav = thema.GetNavigations().SingleOrDefault(n => n.Name == nameof(Thema.Doelsuggesties));
        Assert.NotNull(nav);

        var owned = nav!.TargetEntityType;
        Assert.True(owned.IsOwned());
        Assert.Equal("thema_doelsuggesties", owned.GetTableName());

        // Shares the single DoelKoppeling mapping: status persisted by its Dutch name, FK to leerplandoel.
        var status = owned.FindProperty(nameof(DoelKoppeling.Status))!;
        Assert.Equal("Voorgesteld", status.GetValueConverter()!.ConvertToProvider(KoppelingStatus.Voorgesteld));
        var fk = owned.GetForeignKeys()
            .FirstOrDefault(f => f.PrincipalEntityType.ClrType == typeof(Domain.Curriculum.Leerplandoel));
        Assert.NotNull(fk);
    }

    [Fact]
    public void DoelKoppeling_status_is_persisted_as_its_dutch_name()
    {
        // The themadoel owns its DoelKoppeling; inspect the owned type's status conversion.
        var themadoel = BuildModel().FindEntityType(typeof(Themadoel))!;
        var koppeling = themadoel.GetNavigations()
            .Single(n => n.Name == nameof(Themadoel.Koppeling)).TargetEntityType;

        var status = koppeling.FindProperty(nameof(DoelKoppeling.Status))!;
        var converter = status.GetValueConverter();
        Assert.NotNull(converter);
        Assert.Equal(typeof(string), converter!.ProviderClrType);
        Assert.Equal("Voorgesteld", converter.ConvertToProvider(KoppelingStatus.Voorgesteld));
        Assert.Equal("Aanvaard", converter.ConvertToProvider(KoppelingStatus.Aanvaard));
    }

    [Fact]
    public void DoelKoppeling_references_the_read_only_leerplandoel_by_code()
    {
        var themadoel = BuildModel().FindEntityType(typeof(Themadoel))!;
        var koppeling = themadoel.GetNavigations()
            .Single(n => n.Name == nameof(Themadoel.Koppeling)).TargetEntityType;

        var fk = koppeling.GetForeignKeys()
            .FirstOrDefault(fk => fk.PrincipalEntityType.ClrType == typeof(Domain.Curriculum.Leerplandoel));
        Assert.NotNull(fk);
        Assert.Equal(nameof(DoelKoppeling.LeerplandoelCode), fk!.Properties[0].Name);
    }

    [Fact]
    public void Activiteit_type_is_persisted_as_its_name()
    {
        var entity = BuildModel().FindEntityType(typeof(Activiteit))!;
        var type = entity.FindProperty(nameof(Activiteit.ActiviteitType))!;
        var converter = type.GetValueConverter();
        Assert.NotNull(converter);
        Assert.Equal("Experiment", converter!.ConvertToProvider(ActiviteitType.Experiment));
    }
}
