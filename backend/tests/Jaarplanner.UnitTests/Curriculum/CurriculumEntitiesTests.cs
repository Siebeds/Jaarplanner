using System.Reflection;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the read-only curriculum entities (Art. III.1, IX.1): construction sets identity and
/// content, required fields are enforced, optional fields normalise empty→null, and the types are
/// structurally immutable from application code (no public/internal setters or mutator methods).
/// </summary>
public class CurriculumEntitiesTests
{
    [Fact]
    public void Discipline_constructs_with_identity_and_optional_parent()
    {
        var top = new Discipline("1", "Nederlands en communicatie");
        Assert.Equal("1", top.Nummer);
        Assert.Equal("Nederlands en communicatie", top.Naam);
        Assert.Null(top.ParentDisciplineNummer);

        var child = new Discipline("9.2", "Leren leren", parentDisciplineNummer: "9");
        Assert.Equal("9.2", child.Nummer);
        Assert.Equal("9", child.ParentDisciplineNummer);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Discipline_requires_nummer(string? nummer)
    {
        Assert.Throws<ArgumentException>(() => new Discipline(nummer!, "Naam"));
    }

    [Fact]
    public void Discipline_treats_blank_parent_as_null()
    {
        var d = new Discipline("1", "Naam", parentDisciplineNummer: "   ");
        Assert.Null(d.ParentDisciplineNummer);
    }

    [Fact]
    public void Minimumdoel_constructs_with_ref_as_identity()
    {
        var md = new Minimumdoel("6-12", "6-", "12", "De leerling kan ...");
        Assert.Equal("6-12", md.Ref);
        Assert.Equal("6-", md.Leeftijd);
        Assert.Equal("12", md.Nr);
        Assert.Equal("De leerling kan ...", md.Omschrijving);
    }

    [Fact]
    public void Minimumdoel_requires_all_decreed_fields()
    {
        Assert.Throws<ArgumentException>(() => new Minimumdoel("", "6-", "12", "x"));
        Assert.Throws<ArgumentException>(() => new Minimumdoel("6-12", "", "12", "x"));
        Assert.Throws<ArgumentException>(() => new Minimumdoel("6-12", "6-", "", "x"));
        Assert.Throws<ArgumentException>(() => new Minimumdoel("6-12", "6-", "12", ""));
    }

    [Fact]
    public void Leerplandoel_constructs_with_code_as_identity_and_optional_fields()
    {
        var doel = new Leerplandoel(
            code: "NL-LEZ-001",
            doelsoort: Doelsoort.Minimumdoel,
            jaarFase: "L4",
            domein: "Lezen",
            subdomein: "Begrijpend lezen",
            disciplineNummer: "1",
            tekst: "De leerling leest ...",
            minimumdoelRef: "4-07");

        Assert.Equal("NL-LEZ-001", doel.Code);
        Assert.Equal(Doelsoort.Minimumdoel, doel.Doelsoort);
        Assert.Equal("1", doel.DisciplineNummer);
        Assert.Equal("4-07", doel.MinimumdoelRef);
        // Untouched optional fields default to null (cluster is nullable — Art. VII.0).
        Assert.Null(doel.Cluster);
        Assert.Null(doel.Voorbeelden);
        Assert.Null(doel.Toelichting);
        Assert.Null(doel.Woordenschat);
    }

    [Fact]
    public void Leerplandoel_normalises_blank_optionals_to_null()
    {
        var doel = new Leerplandoel(
            code: "X1",
            doelsoort: Doelsoort.Gemeenschappelijk,
            jaarFase: "K3",
            domein: "D",
            subdomein: "S",
            disciplineNummer: "2",
            cluster: "   ",
            tekst: "t",
            voorbeelden: "",
            minimumdoelRef: "  ");

        Assert.Null(doel.Cluster);
        Assert.Null(doel.Voorbeelden);
        Assert.Null(doel.MinimumdoelRef);
    }

    [Fact]
    public void Leerplandoel_requires_identity_taxonomy_and_text()
    {
        Assert.Throws<ArgumentException>(() => Make(code: ""));
        Assert.Throws<ArgumentException>(() => Make(jaarFase: ""));
        Assert.Throws<ArgumentException>(() => Make(domein: ""));
        Assert.Throws<ArgumentException>(() => Make(subdomein: ""));
        Assert.Throws<ArgumentException>(() => Make(disciplineNummer: ""));
        Assert.Throws<ArgumentException>(() => Make(tekst: ""));
    }

    [Fact]
    public void Leerplandoel_rejects_an_undefined_doelsoort()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            Make(doelsoort: (Doelsoort)99));
    }

    /// <summary>
    /// Art. III.1 enforced structurally: the official content cannot be mutated from any
    /// application code path. No property exposes a public/internal setter, and the types
    /// declare no public mutator methods. Only EF Core's private materialisation path may write.
    /// </summary>
    [Theory]
    [InlineData(typeof(Discipline))]
    [InlineData(typeof(Leerplandoel))]
    [InlineData(typeof(Minimumdoel))]
    public void Curriculum_entities_have_no_accessible_setters(Type entityType)
    {
        var settableProps = entityType
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.SetMethod is { IsPublic: true } || p.SetMethod is { IsAssembly: true })
            .Select(p => p.Name)
            .ToArray();

        Assert.Empty(settableProps);
    }

    [Theory]
    [InlineData(typeof(Discipline))]
    [InlineData(typeof(Leerplandoel))]
    [InlineData(typeof(Minimumdoel))]
    public void Curriculum_entities_expose_no_public_mutator_methods(Type entityType)
    {
        // Property getters/setters are excluded; any remaining public instance method that
        // returns void and is not declared on object would be a mutation seam.
        var mutators = entityType
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName && m.DeclaringType == entityType)
            .Select(m => m.Name)
            .ToArray();

        Assert.Empty(mutators);
    }

    private static Leerplandoel Make(
        string code = "C1",
        Doelsoort doelsoort = Doelsoort.Gemeenschappelijk,
        string jaarFase = "L1",
        string domein = "D",
        string subdomein = "S",
        string disciplineNummer = "1",
        string tekst = "t") =>
        new(code, doelsoort, jaarFase, domein, subdomein, disciplineNummer, tekst: tekst);
}
