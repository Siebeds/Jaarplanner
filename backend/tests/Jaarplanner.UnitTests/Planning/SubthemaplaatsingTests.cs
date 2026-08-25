using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The <see cref="Subthemaplaatsing"/> invariants and the <see cref="Jaarplan"/> verb that creates them (owner ruling,
/// 2026-08-25).
/// <para>
/// <b>The defect these exist for:</b> a subthema's band was derived purely from the days its activiteiten sat on, so a
/// teacher who marked off five days and had one activiteit ready saw a one-day band. Activiteiten are added later,
/// which is the ordinary order of work, so a window has to be able to exist before its content does. The test that
/// matters most is therefore the dullest one below: a window is stored whole, and its length owes nothing to how many
/// activiteiten are in it.
/// </para>
/// </summary>
public sealed class SubthemaplaatsingTests
{
    private static readonly DateOnly Maandag = new(2027, 3, 1);
    private static readonly DateOnly Vrijdag = new(2027, 3, 5);

    [Fact]
    public void Een_venster_bewaart_de_dagen_die_de_leraar_aanduidde()
    {
        var klasId = Guid.NewGuid();
        var subthemaId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);

        var plaatsing = plan.PlaatsSubthema(subthemaId, klasId, Maandag, Vrijdag);

        Assert.Equal(Maandag, plaatsing.Van);
        Assert.Equal(Vrijdag, plaatsing.Tot);
        Assert.Single(plan.Subthemaplaatsingen);

        // Nothing about the window depends on activiteiten: none were placed here at all.
        Assert.True(plaatsing.Omvat(new DateOnly(2027, 3, 3)));
    }

    [Fact]
    public void Een_venster_van_een_dag_mag()
    {
        var klasId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);

        var plaatsing = plan.PlaatsSubthema(Guid.NewGuid(), klasId, Maandag, Maandag);

        Assert.Equal(Maandag, plaatsing.Van);
        Assert.Equal(Maandag, plaatsing.Tot);
    }

    [Fact]
    public void Opnieuw_inplannen_verplaatst_het_overlappende_venster_in_plaats_van_een_tweede_toe_te_voegen()
    {
        var klasId = Guid.NewGuid();
        var subthemaId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);
        plan.PlaatsSubthema(subthemaId, klasId, Maandag, Vrijdag);

        // Two days later, three days shorter: the teacher saying "these days instead".
        var opnieuw = plan.PlaatsSubthema(subthemaId, klasId, new DateOnly(2027, 3, 3), new DateOnly(2027, 3, 4));

        var enige = Assert.Single(plan.Subthemaplaatsingen);
        Assert.Equal(opnieuw.Id, enige.Id);
        Assert.Equal(new DateOnly(2027, 3, 3), enige.Van);

        // The newest answer wins WHOLE. Merging would keep the 1st and the 5th and make a shortened period
        // impossible to express, which is the ordinary reason to reopen the planner.
        Assert.Equal(new DateOnly(2027, 3, 4), enige.Tot);
    }

    [Fact]
    public void Hetzelfde_subthema_kan_een_tweede_keer_in_het_jaar_lopen()
    {
        var klasId = Guid.NewGuid();
        var subthemaId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);
        plan.PlaatsSubthema(subthemaId, klasId, Maandag, Vrijdag);

        // No shared day, so this is a second period rather than a correction of the first.
        plan.PlaatsSubthema(subthemaId, klasId, new DateOnly(2027, 5, 3), new DateOnly(2027, 5, 7));

        Assert.Equal(2, plan.Subthemaplaatsingen.Count);
    }

    [Fact]
    public void Twee_vensters_die_aansluiten_zijn_twee_periodes()
    {
        var klasId = Guid.NewGuid();
        var subthemaId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);
        plan.PlaatsSubthema(subthemaId, klasId, Maandag, Vrijdag);

        // Monday the 8th begins where Friday the 5th ended without sharing a day. Abutting is not overlapping:
        // otherwise a subthema running two fortnights back to back would collapse into one.
        plan.PlaatsSubthema(subthemaId, klasId, new DateOnly(2027, 3, 8), new DateOnly(2027, 3, 12));

        Assert.Equal(2, plan.Subthemaplaatsingen.Count);
    }

    [Fact]
    public void Een_subthema_van_een_andere_klas_wordt_geweigerd()
    {
        var plan = new Jaarplan(Guid.NewGuid());

        var fout = Assert.Throws<ArgumentException>(
            () => plan.PlaatsSubthema(Guid.NewGuid(), Guid.NewGuid(), Maandag, Vrijdag));

        // Dutch, because it reaches a teacher (Art. II.3), and refused because the class scope is structural
        // (Art. IX.2) rather than a filter a screen happens to apply.
        Assert.Contains("eigen klas", fout.Message, StringComparison.Ordinal);
        Assert.Empty(plan.Subthemaplaatsingen);
    }

    [Fact]
    public void Een_venster_dat_achteruit_loopt_wordt_geweigerd()
    {
        var klasId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);

        Assert.Throws<ArgumentException>(() => plan.PlaatsSubthema(Guid.NewGuid(), klasId, Vrijdag, Maandag));
        Assert.Empty(plan.Subthemaplaatsingen);
    }

    [Fact]
    public void Vensters_komen_chronologisch_terug()
    {
        var klasId = Guid.NewGuid();
        var plan = new Jaarplan(klasId);
        plan.PlaatsSubthema(Guid.NewGuid(), klasId, new DateOnly(2027, 5, 3), new DateOnly(2027, 5, 7));
        plan.PlaatsSubthema(Guid.NewGuid(), klasId, Maandag, Vrijdag);

        // Ordered by the stored dates rather than by insertion, so a read view stays stable across a refetch.
        Assert.Equal([Maandag, new DateOnly(2027, 5, 3)], plan.Subthemaplaatsingen.Select(p => p.Van));
    }
}
