using System.Reflection;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Jaarplanner.UnitTests.Persistence;

/// <summary>
/// Guards the <b>precondition</b> of the model-wide <c>ValueGenerated.Never</c> rule in
/// <see cref="AppDbContext.OnModelCreating"/>, which until now was asserted in a comment and enforced nowhere
/// (E1-13 round-3 audit, MINOR 3).
/// <para>
/// The rule is correct today because all Guid keys in this model are assigned by the domain
/// (<c>= Guid.NewGuid()</c> on the property, which runs in the EF materialisation constructor too). But it
/// <b>inverts the failure mode</b>: with <c>Never</c>, a future Guid-keyed entity whose constructor does not
/// assign its key inserts <c>Guid.Empty</c> in silence, and the <i>second</i> row of that type violates the
/// primary key. Nothing about that is easy to diagnose from the outside, and
/// <c>AggregaatGroeiTests</c> only covers it if somebody remembers to add a case for the new collection, which
/// is the same "somebody remembers" this story rejected for the copy guards.
/// </para>
/// <para>
/// The model is built against the Npgsql provider because that is the one production runs and model building
/// opens no connection. Both tests read the <b>finalised</b> model rather than the builder, which matters:
/// the <c>foreach</c> that applies the rule is the last statement in <c>OnModelCreating</c>, so a
/// configuration added after it would override the rule silently. Asserting on the finalised model catches
/// that, so the ordering hazard is guarded rather than merely written down.
/// </para>
/// </summary>
public class GuidSleutelConventieTests
{
    private static IModel BuildModel()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=x")
            .Options;
        using var context = new AppDbContext(options);
        return context.Model;
    }

    private static IEnumerable<(IEntityType Entity, IProperty Property)> GuidSleutelEigenschappen() =>
        BuildModel().GetEntityTypes()
            .SelectMany(entity => entity.GetKeys()
                .SelectMany(key => key.Properties)
                .Where(property => property.ClrType == typeof(Guid))
                .Distinct()
                .Select(property => (entity, property)));

    /// <summary>
    /// No Guid key anywhere in the model is store-generated. This is the rule itself, read back off the
    /// finalised model, so it fails both if the loop is removed and if a later configuration overrides it.
    /// </summary>
    [Fact]
    public void Geen_enkele_Guid_sleutel_wordt_door_de_database_gegenereerd()
    {
        var afwijkend = GuidSleutelEigenschappen()
            .Where(p => p.Property.ValueGenerated != ValueGenerated.Never)
            .Select(p => $"{p.Entity.DisplayName()}.{p.Property.Name} = {p.Property.ValueGenerated}")
            .ToList();

        Assert.True(
            afwijkend.Count == 0,
            "These Guid keys are store-generated, which reintroduces the Added-versus-Modified defect on an " +
            "already-loaded parent. Check whether a configuration was added below the ValueGenerated.Never " +
            $"loop in OnModelCreating: {string.Join(", ", afwijkend)}");

        // Guards the guard: if the model ever stops having Guid keys, the assertion above passes vacuously.
        Assert.NotEmpty(GuidSleutelEigenschappen());
    }

    /// <summary>
    /// Every Guid key the model expects the domain to fill really is filled by the domain. A key property that
    /// is part of a foreign key is exempt: those are set from the parent relationship, not by the constructor.
    /// </summary>
    [Fact]
    public void Elke_Guid_sleutel_wordt_door_de_constructor_gezet()
    {
        var leeg = new List<string>();

        foreach (var (entity, property) in GuidSleutelEigenschappen())
        {
            if (property.IsForeignKey())
            {
                continue; // Assigned by the owning relationship (e.g. an owned type's key to its owner).
            }

            var lid = (MemberInfo?)property.PropertyInfo ?? property.FieldInfo;
            if (lid is null)
            {
                // A shadow Guid key cannot be constructor-assigned at all, so ValueGenerated.Never would make
                // it insert Guid.Empty. If one ever appears, this is the failure that says so.
                leeg.Add($"{entity.DisplayName()}.{property.Name} (shadow property, no CLR member)");
                continue;
            }

            // The parameterless constructor is EF's materialisation constructor in this codebase, and a property
            // initialiser runs in it just as it does in the public one, so this reads exactly the value a new
            // entity starts life with.
            var exemplaar = Activator.CreateInstance(entity.ClrType, nonPublic: true);
            Assert.NotNull(exemplaar);

            var waarde = lid switch
            {
                PropertyInfo p => p.GetValue(exemplaar),
                FieldInfo f => f.GetValue(exemplaar),
                _ => null,
            };

            if (waarde is not Guid sleutel || sleutel == Guid.Empty)
            {
                leeg.Add($"{entity.DisplayName()}.{property.Name}");
            }
        }

        Assert.True(
            leeg.Count == 0,
            "These Guid keys are not assigned by the domain, so ValueGenerated.Never makes them insert " +
            "Guid.Empty and the second row of that type violates the primary key. Give the property a " +
            $"'= Guid.NewGuid()' initialiser: {string.Join(", ", leeg)}");
    }
}
