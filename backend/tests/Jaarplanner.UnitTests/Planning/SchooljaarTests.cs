using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The <see cref="Schooljaar"/> aggregate (Art. IX.3): it carries the vakantie-/periodestructuur that the
/// planningsblok-indeling derives the grid from, so its invariants and its <see cref="Schooljaar.Lesperiodes"/>
/// decomposition are the foundation the whole calendar rests on.
/// </summary>
public sealed class SchooljaarTests
{
    [Fact]
    public void Schooljaar_overspant_twee_kalenderjaren()
    {
        // Belgian school year: September → June. Not a calendar year — one reason the grid is not months.
        var schooljaar = new Schooljaar("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));

        Assert.Equal(2026, schooljaar.Start.Year);
        Assert.Equal(2027, schooljaar.Eind.Year);
    }

    [Fact]
    public void Eind_voor_start_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() =>
            new Schooljaar("2026-2027", new DateOnly(2027, 6, 30), new DateOnly(2026, 9, 1)));
    }

    [Fact]
    public void Vakantie_buiten_het_schooljaar_wordt_geweigerd()
    {
        var schooljaar = Basis();

        var fout = Assert.Throws<ArgumentException>(() => schooljaar.VoegSluitingToe(
            new Schoolsluiting("Zomervakantie", new DateOnly(2027, 7, 5), new DateOnly(2027, 7, 20))));

        Assert.Contains("buiten het schooljaar", fout.Message);
    }

    [Fact]
    public void Overlappende_vakanties_worden_geweigerd()
    {
        var schooljaar = Basis();
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));

        var fout = Assert.Throws<ArgumentException>(() => schooljaar.VoegSluitingToe(
            new Schoolsluiting("Extra", new DateOnly(2027, 1, 2), new DateOnly(2027, 1, 9))));

        Assert.Contains("overlapt", fout.Message);
    }

    [Fact]
    public void Lesperiodes_splitsen_het_jaar_rond_de_vakanties()
    {
        var schooljaar = Basis();
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));

        var periodes = schooljaar.Lesperiodes();

        // Two vacations inside the year → three teaching stretches.
        Assert.Equal(3, periodes.Count);
        Assert.Equal(schooljaar.Start, periodes[0].Start);
        Assert.Equal(new DateOnly(2026, 11, 1), periodes[0].Eind);   // day before herfstvakantie
        Assert.Equal(new DateOnly(2026, 11, 9), periodes[1].Start);  // day after it
        Assert.Equal(new DateOnly(2027, 1, 4), periodes[2].Start);   // day after kerstvakantie
        Assert.Equal(schooljaar.Eind, periodes[2].Eind);
    }

    [Fact]
    public void Jaar_zonder_vakanties_is_een_enkele_lesperiode()
    {
        var periodes = Basis().Lesperiodes();

        var enige = Assert.Single(periodes);
        Assert.Equal(new DateOnly(2026, 9, 1), enige.Start);
        Assert.Equal(new DateOnly(2027, 6, 30), enige.Eind);
    }

    [Fact]
    public void Lesdag_sluit_vakantiedagen_en_dagen_buiten_het_jaar_uit()
    {
        var schooljaar = Basis();
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));

        Assert.True(schooljaar.IsLesdag(new DateOnly(2026, 12, 18)));
        Assert.False(schooljaar.IsLesdag(new DateOnly(2026, 12, 25)));  // in the vacation
        Assert.False(schooljaar.IsLesdag(new DateOnly(2027, 8, 15)));   // outside the year
    }

    [Fact]
    public void Vakanties_worden_op_startdatum_geordend()
    {
        var schooljaar = Basis();
        schooljaar.VoegSluitingToe(new Schoolsluiting("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));

        Assert.Equal(["Herfstvakantie", "Paasvakantie"], schooljaar.Vakanties.Select(v => v.Naam));
    }

    private static Schooljaar Basis() =>
        new("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
}
