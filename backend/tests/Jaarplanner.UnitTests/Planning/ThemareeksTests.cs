using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// A reeks is the parts of one thema with no schooldag between them (ADR-0049 decision 4). Uses
/// <see cref="TestSchooljaar.MetVakanties"/>: herfstvakantie 2–8 November 2026.
/// </summary>
public sealed class ThemareeksTests
{
    private static readonly Guid Herfst = Guid.NewGuid();
    private static readonly Guid Water = Guid.NewGuid();

    private static DateOnly D(int jaar, int maand, int dag) => new(jaar, maand, dag);

    private static Themakalender Kalender() => new(TestSchooljaar.MetVakanties());

    [Fact]
    public void Delen_rond_een_vakantie_vormen_een_reeks()
    {
        var plan = new Jaarplan(Guid.NewGuid());
        var tweede = plan.VoegPlaatsingToe(Herfst, D(2026, 11, 9), D(2026, 11, 20), KoppelingStatus.Manueel);
        var eerste = plan.VoegPlaatsingToe(Herfst, D(2026, 10, 19), D(2026, 10, 30), KoppelingStatus.Manueel);

        var reeks = Assert.Single(Themareeks.Bepaal(plan.Plaatsingen, Kalender()));

        Assert.Equal(Herfst, reeks.ThemaId);
        Assert.Equal([eerste.Id, tweede.Id], reeks.Delen.Select(p => p.Id));
        Assert.Equal(D(2026, 10, 19), reeks.Van);
        Assert.Equal(D(2026, 11, 20), reeks.Tot);
    }

    [Fact]
    public void Aansluitend_over_een_weekend_is_ook_een_reeks()
    {
        var plan = new Jaarplan(Guid.NewGuid());
        plan.VoegPlaatsingToe(Herfst, D(2026, 9, 7), D(2026, 9, 11), KoppelingStatus.Manueel);
        plan.VoegPlaatsingToe(Herfst, D(2026, 9, 14), D(2026, 9, 18), KoppelingStatus.Manueel);

        Assert.Equal(2, Assert.Single(Themareeks.Bepaal(plan.Plaatsingen, Kalender())).Delen.Count);
    }

    [Fact]
    public void Hetzelfde_thema_met_een_lesweek_ertussen_zijn_twee_reeksen()
    {
        var plan = new Jaarplan(Guid.NewGuid());
        plan.VoegPlaatsingToe(Herfst, D(2026, 9, 7), D(2026, 9, 11), KoppelingStatus.Manueel);
        plan.VoegPlaatsingToe(Herfst, D(2026, 9, 21), D(2026, 9, 25), KoppelingStatus.Manueel);

        var reeksen = Themareeks.Bepaal(plan.Plaatsingen, Kalender());

        Assert.Equal(2, reeksen.Count);
        Assert.All(reeksen, r => Assert.Single(r.Delen));
    }

    [Fact]
    public void Een_ander_thema_ertussen_breekt_de_reeks()
    {
        var plan = new Jaarplan(Guid.NewGuid());
        plan.VoegPlaatsingToe(Herfst, D(2026, 10, 19), D(2026, 10, 29), KoppelingStatus.Manueel);
        plan.VoegPlaatsingToe(Water, D(2026, 10, 30), D(2026, 10, 30), KoppelingStatus.Manueel);
        plan.VoegPlaatsingToe(Herfst, D(2026, 11, 9), D(2026, 11, 20), KoppelingStatus.Manueel);

        Assert.Equal([Herfst, Water, Herfst], Themareeks.Bepaal(plan.Plaatsingen, Kalender()).Select(r => r.ThemaId));
    }

    [Fact]
    public void Een_geweigerde_plaatsing_hoort_bij_geen_reeks()
    {
        var plan = new Jaarplan(Guid.NewGuid());
        plan.VoegPlaatsingToe(Herfst, D(2026, 10, 19), D(2026, 10, 30), KoppelingStatus.Manueel);
        var geweigerd = plan.VoegPlaatsingToe(Herfst, D(2026, 11, 9), D(2026, 11, 20), KoppelingStatus.Geweigerd);

        var reeks = Assert.Single(Themareeks.Bepaal(plan.Plaatsingen, Kalender()));

        Assert.DoesNotContain(reeks.Delen, p => p.Id == geweigerd.Id);
        Assert.Equal(D(2026, 10, 30), reeks.Tot);
    }

    [Fact]
    public void Een_leeg_plan_heeft_geen_reeksen() =>
        Assert.Empty(Themareeks.Bepaal([], Kalender()));

    [Fact]
    public void Null_wordt_geweigerd()
    {
        Assert.Throws<ArgumentNullException>(() => Themareeks.Bepaal(null!, Kalender()));
        Assert.Throws<ArgumentNullException>(() => Themareeks.Bepaal([], null!));
    }
}
