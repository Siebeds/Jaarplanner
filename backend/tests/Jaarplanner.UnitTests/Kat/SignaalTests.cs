using Jaarplanner.Domain.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>The signal itself (TB-057, ADR-0059 D2, D4).</summary>
public sealed class SignaalTests
{
    private static readonly Guid Klas = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Juf = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Nu = new(2026, 9, 22, 7, 0, 0, TimeSpan.Zero);

    private static Signaal Nieuw() => new(Signaalsoort.MinimumdoelInGevaar, Klas, Juf, "MD-01", Nu);

    [Fact]
    public void Een_nieuw_signaal_is_ongezien_en_niet_uitgesteld()
    {
        var signaal = Nieuw();

        Assert.Null(signaal.GezienOp);
        Assert.Null(signaal.UitgesteldTot);
        Assert.True(signaal.IsZichtbaarOp(new DateOnly(2026, 9, 22)));
    }

    [Fact]
    public void Een_uitgesteld_signaal_blijft_weg_tot_de_dag_die_het_kreeg()
    {
        var signaal = Nieuw();

        signaal.StelUit(new DateOnly(2026, 9, 23));

        Assert.False(signaal.IsZichtbaarOp(new DateOnly(2026, 9, 22)));
        Assert.True(signaal.IsZichtbaarOp(new DateOnly(2026, 9, 23)));
    }

    [Fact]
    public void Twee_keer_gezien_houdt_het_eerste_moment()
    {
        var signaal = Nieuw();

        signaal.MarkeerGezien(Nu);
        signaal.MarkeerGezien(Nu.AddHours(2));

        Assert.Equal(Nu, signaal.GezienOp);
    }

    [Fact]
    public void Een_sleutel_is_verplicht()
    {
        Assert.Throws<ArgumentException>(() => new Signaal(Signaalsoort.Aanbodgat, Klas, Juf, "  ", Nu));
    }

    [Fact]
    public void Een_sleutel_langer_dan_de_grens_wordt_geweigerd()
    {
        var telang = new string('x', Signaal.MaxSleutellengte + 1);

        Assert.Throws<ArgumentException>(() => new Signaal(Signaalsoort.Aanbodgat, Klas, Juf, telang, Nu));
    }

    [Fact]
    public void Een_signaal_zonder_klas_of_ontvanger_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() => new Signaal(Signaalsoort.Aanbodgat, Guid.Empty, Juf, "MD-01", Nu));
        Assert.Throws<ArgumentException>(() => new Signaal(Signaalsoort.Aanbodgat, Klas, Guid.Empty, "MD-01", Nu));
    }

    [Fact]
    public void Een_onbekende_soort_wordt_geweigerd()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Signaal((Signaalsoort)99, Klas, Juf, "MD-01", Nu));
    }
}
