using Jaarplanner.Infrastructure.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// When the cat's job wakes (TB-057, ADR-0059 D1). The moments are read on the school's clock, so a host in UTC ticks
/// at the Belgian hour and not at its own.
/// </summary>
public sealed class TikschemaTests
{
    private static readonly TimeZoneInfo Brussel = TimeZoneInfo.FindSystemTimeZoneById("Europe/Brussels");

    private static readonly TimeOnly[] Momenten = [new(7, 0), new(19, 0)];

    [Fact]
    public void De_ochtendtik_van_vandaag_komt_voor_de_avondtik()
    {
        // 03:00 UTC on a summer day is 05:00 in Brussels: the morning tick is still to come.
        var nu = new DateTimeOffset(2026, 9, 22, 3, 0, 0, TimeSpan.Zero);

        var volgende = Tikschema.VolgendeNa(nu, Momenten, Brussel);

        // 07:00 Brussels in summer is 05:00 UTC.
        Assert.Equal(new DateTimeOffset(2026, 9, 22, 5, 0, 0, TimeSpan.Zero), volgende);
    }

    [Fact]
    public void Na_de_avondtik_volgt_de_ochtendtik_van_morgen()
    {
        // 20:00 Brussels: both of today's moments have passed.
        var nu = new DateTimeOffset(2026, 9, 22, 18, 0, 0, TimeSpan.Zero);

        var volgende = Tikschema.VolgendeNa(nu, Momenten, Brussel);

        Assert.Equal(new DateTimeOffset(2026, 9, 23, 5, 0, 0, TimeSpan.Zero), volgende);
    }

    [Fact]
    public void Precies_op_een_tikmoment_gaat_de_job_naar_het_volgende()
    {
        // Exactly 07:00 Brussels. The tick it is on has been taken; waiting zero seconds for it again would spin.
        var nu = new DateTimeOffset(2026, 9, 22, 5, 0, 0, TimeSpan.Zero);

        var volgende = Tikschema.VolgendeNa(nu, Momenten, Brussel);

        Assert.Equal(new DateTimeOffset(2026, 9, 22, 17, 0, 0, TimeSpan.Zero), volgende);
    }

    [Fact]
    public void De_winteruurwissel_verschuift_de_tik_met_het_uur_mee()
    {
        // The night of 25 October 2026 the clock goes back: 07:00 Brussels is 06:00 UTC, not 05:00.
        var nu = new DateTimeOffset(2026, 10, 25, 3, 0, 0, TimeSpan.Zero);

        var volgende = Tikschema.VolgendeNa(nu, Momenten, Brussel);

        Assert.Equal(new DateTimeOffset(2026, 10, 25, 6, 0, 0, TimeSpan.Zero), volgende);
    }

    [Fact]
    public void Zonder_zone_leest_de_job_de_momenten_als_UTC()
    {
        var nu = new DateTimeOffset(2026, 9, 22, 3, 0, 0, TimeSpan.Zero);

        var volgende = Tikschema.VolgendeNa(nu, Momenten, zone: null);

        Assert.Equal(new DateTimeOffset(2026, 9, 22, 7, 0, 0, TimeSpan.Zero), volgende);
    }

    [Fact]
    public void Een_schema_zonder_momenten_wordt_geweigerd()
    {
        var nu = new DateTimeOffset(2026, 9, 22, 3, 0, 0, TimeSpan.Zero);

        Assert.Throws<ArgumentException>(() => Tikschema.VolgendeNa(nu, [], Brussel));
    }

    [Theory]
    [InlineData("07:00", true)]
    [InlineData("19:00", true)]
    [InlineData("7:00", false)]
    [InlineData("kwart over zeven", false)]
    [InlineData("25:00", false)]
    public void Een_tikmoment_wordt_bij_het_opstarten_nagekeken(string moment, bool geldig)
    {
        var opties = new KatOpties { Tikmomenten = [moment] };

        Assert.Equal(geldig, opties.IsGeldig(out var fout));
        Assert.Equal(geldig, fout is null);
    }

    [Fact]
    public void Een_lege_lijst_tikmomenten_wordt_bij_het_opstarten_geweigerd()
    {
        var opties = new KatOpties { Tikmomenten = [] };

        Assert.False(opties.IsGeldig(out _));
    }
}
