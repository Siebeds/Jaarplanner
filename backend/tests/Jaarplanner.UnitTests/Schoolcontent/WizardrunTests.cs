using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// A wizard run's state (E6-02 slice 3, ADR-0030 I23–I25): open until finished, closed or fourteen silent days; every
/// write moves the window; it remembers what it created, per kind, and forgets what it deletes.
/// </summary>
public sealed class WizardrunTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid Thema = Guid.Parse("a0000000-0000-4000-8000-00000000000a");

    [Fact]
    public void Een_nieuwe_wizard_is_open_en_zijn_start_is_zijn_eerste_schrijfactie()
    {
        var run = new Wizardrun(Thema, Guid.NewGuid(), Start);

        Assert.True(run.IsOpen(Start));
        Assert.Equal(Start, run.LaatsteSchrijfactieOp);
        Assert.Equal(Start + TimeSpan.FromDays(14), run.SluitUiterlijkOp);
        Assert.Empty(run.Aangemaakt);
    }

    [Fact]
    public void Veertien_dagen_na_de_laatste_schrijfactie_is_de_wizard_afgelopen()
    {
        var run = new Wizardrun(Thema, null, Start);

        Assert.True(run.IsOpen(Start + TimeSpan.FromDays(14) - TimeSpan.FromSeconds(1)));
        Assert.False(run.IsOpen(Start + TimeSpan.FromDays(14)));
    }

    [Fact]
    public void Elke_schrijfactie_schuift_het_venster_op()
    {
        var run = new Wizardrun(Thema, null, Start);
        var later = Start + TimeSpan.FromDays(10);

        run.RegistreerAanmaak(Wizarditemsoort.Subthema, Guid.NewGuid(), later);
        Assert.True(run.IsOpen(Start + TimeSpan.FromDays(20)));

        run.RegistreerWijziging(Start + TimeSpan.FromDays(20));
        Assert.True(run.IsOpen(Start + TimeSpan.FromDays(33)));

        run.RegistreerVerwijdering([], Start + TimeSpan.FromDays(33));
        Assert.Equal(Start + TimeSpan.FromDays(47), run.SluitUiterlijkOp);
    }

    [Fact]
    public void Afronden_en_sluiten_beeindigen_de_wizard_meteen()
    {
        var afgerond = new Wizardrun(Thema, null, Start);
        var gesloten = new Wizardrun(Thema, null, Start);

        afgerond.RondAf(Start.AddMinutes(5));
        gesloten.Sluit(Start.AddMinutes(5));

        Assert.False(afgerond.IsOpen(Start.AddMinutes(6)));
        Assert.Equal(Start.AddMinutes(5), afgerond.AfgerondOp);
        Assert.False(gesloten.IsOpen(Start.AddMinutes(6)));
        Assert.Equal(Start.AddMinutes(5), gesloten.GeslotenOp);
    }

    [Fact]
    public void Een_afgelopen_wizard_schrijft_niets_meer()
    {
        var run = new Wizardrun(Thema, null, Start);
        run.RondAf(Start);
        var stil = new Wizardrun(Thema, null, Start);
        var na = Start + TimeSpan.FromDays(15);

        Assert.Throws<InvalidOperationException>(() => run.RegistreerAanmaak(Wizarditemsoort.Subdoel, Guid.NewGuid(), Start));
        Assert.Throws<InvalidOperationException>(() => run.Sluit(Start));
        Assert.Throws<InvalidOperationException>(() => stil.RegistreerWijziging(na));
        Assert.Throws<InvalidOperationException>(() => stil.RondAf(na));
    }

    [Fact]
    public void De_wizard_onthoudt_wat_hij_aanmaakte_per_soort_en_vergeet_wat_hij_verwijderde()
    {
        var run = new Wizardrun(Thema, null, Start);
        var subthema = Guid.NewGuid();
        var activiteit = Guid.NewGuid();

        run.RegistreerAanmaak(Wizarditemsoort.Subthema, subthema, Start);
        run.RegistreerAanmaak(Wizarditemsoort.Activiteit, activiteit, Start);

        Assert.True(run.HeeftAangemaakt(Wizarditemsoort.Subthema, subthema));
        Assert.False(run.HeeftAangemaakt(Wizarditemsoort.Activiteit, subthema));
        Assert.False(run.HeeftAangemaakt(Wizarditemsoort.Subthema, Guid.NewGuid()));

        run.RegistreerVerwijdering([subthema, activiteit], Start.AddMinutes(1));

        Assert.Empty(run.Aangemaakt);
    }

    [Fact]
    public void Een_wizard_hoort_bij_een_thema_en_een_lege_starter_is_geen_starter()
    {
        Assert.Throws<ArgumentException>(() => new Wizardrun(Guid.Empty, null, Start));
        Assert.Null(new Wizardrun(Thema, Guid.Empty, Start).GestartDoorId);
        Assert.Throws<ArgumentException>(() => new Wizardrun(Thema, null, Start).RegistreerAanmaak(Wizarditemsoort.Subthema, Guid.Empty, Start));
    }
}
