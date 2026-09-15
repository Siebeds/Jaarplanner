using Jaarplanner.Infrastructure;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>
/// The school's clock (E6-02 slice 1, fix round 1): Brussels wall time, and, on a host without that zone, UTC with a
/// single warning, whichever caller meets it. The zone and the once-only state are passed in, so the fallback is
/// tested here without a host that lacks time zone data.
/// </summary>
public sealed class SchoolklokTests
{
    private static readonly DateTimeOffset NaMiddernachtBrussel = new(2027, 6, 30, 22, 30, 0, TimeSpan.Zero);

    [Fact]
    public void Met_de_zone_is_het_vandaag_in_Brussel()
    {
        Assert.NotNull(Schoolklok.Zone);
        var logger = new TelLogger();

        var vandaag = Schoolklok.Vandaag(new VasteTijd(NaMiddernachtBrussel), logger);

        Assert.Equal(new DateOnly(2027, 7, 1), vandaag);
        Assert.Equal(0, logger.Waarschuwingen);
    }

    [Fact]
    public void Zonder_zone_valt_de_klok_terug_op_UTC_en_waarschuwt_een_keer()
    {
        var logger = new TelLogger();
        var waarschuwing = new Schoolklok.Eenmalig();
        var tijd = new VasteTijd(NaMiddernachtBrussel);

        var eerste = Schoolklok.Nu(tijd, logger, zone: null, waarschuwing);
        var tweede = Schoolklok.Nu(tijd, logger, zone: null, waarschuwing);

        Assert.Equal(TimeSpan.Zero, eerste.Offset);
        Assert.Equal(new DateOnly(2027, 6, 30), DateOnly.FromDateTime(eerste.DateTime));
        Assert.Equal(eerste, tweede);
        Assert.Equal(1, logger.Waarschuwingen);
    }

    private sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => nu;
    }

    private sealed class TelLogger : ILogger
    {
        public int Waarschuwingen { get; private set; }

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Warning)
            {
                Waarschuwingen++;
            }
        }
    }
}
