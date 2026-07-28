using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E3-05: the planningsblok grid. These tests exist to prove the story's actual acceptance criterion —
/// "the block unit is <b>configurable behind a seam</b>; default is <b>documented, not compiled-in</b>"
/// (ADR-0013, Art. IX.3/XIV) — and to pin the constitution's hard prohibition on assuming months.
/// </summary>
public sealed class PlanningsblokIndelingTests
{
    // A realistic Belgian school year: 1 Sept 2026 → 30 June 2027, straddling two calendar years.
    private static readonly DateOnly Start = new(2026, 9, 1);
    private static readonly DateOnly Eind = new(2027, 6, 30);

    [Fact]
    public void Standaard_indeling_gebruikt_de_geratificeerde_twee_tier_cadans()
    {
        var indeling = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

        // The documented default (directie 2026-07-14): themaperiode 5 wk (midpoint of 4–6), subthema 2 wk.
        Assert.Contains("themaperiode 5 wk", indeling.Omschrijving);
        Assert.Contains("subthemaperiode 2 wk", indeling.Omschrijving);

        var themaperiodes = indeling.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);
        var subthemaperiodes = indeling.Blokken(Schooljaar(), Planningsblokniveau.Subthemaperiode);

        // The fine tier must subdivide the coarse one, so there are strictly more of them.
        Assert.True(subthemaperiodes.Count > themaperiodes.Count);
        Assert.All(themaperiodes, b => Assert.Equal(Planningsblokniveau.Themaperiode, b.Niveau));
        Assert.All(subthemaperiodes, b => Assert.Equal(Planningsblokniveau.Subthemaperiode, b.Niveau));
    }

    /// <summary>
    /// The heart of the seam: the same code yields a different grain purely from configuration. If this
    /// passes, the ratified default is a configured outcome rather than a compiled-in decision — which is
    /// exactly what ADR-0013 requires so a later directie change is a config edit, not a refactor.
    /// </summary>
    [Fact]
    public void Grain_volgt_configuratie_zonder_codewijziging()
    {
        var vijfWeken = new GeconfigureerdePlanningsblokIndeling(
            new PlanningsblokOptions { ThemaperiodeWeken = 5 });
        var drieWeken = new GeconfigureerdePlanningsblokIndeling(
            new PlanningsblokOptions { ThemaperiodeWeken = 3 });

        var metVijf = vijfWeken.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);
        var metDrie = drieWeken.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);

        // A shorter themaperiode must produce more blocks over the same year.
        Assert.True(metDrie.Count > metVijf.Count);
        Assert.Contains("themaperiode 3 wk", drieWeken.Omschrijving);
    }

    /// <summary>
    /// Blocks never span a vacation, so their spans are uneven — the concrete reason the grid cannot be a
    /// month sequence. A themaperiode interrupted by the kerstvakantie is not one period a teacher can plan
    /// a thema into.
    /// </summary>
    [Fact]
    public void Blokken_lopen_nooit_door_een_vakantie()
    {
        var schooljaar = Schooljaar();
        var indeling = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

        var blokken = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        foreach (var vakantie in schooljaar.Vakanties)
        {
            Assert.DoesNotContain(blokken, b => b.Bevat(vakantie.Start) || b.Bevat(vakantie.Eind));
        }

        // Every day inside a block is a teaching day.
        foreach (var blok in blokken)
        {
            Assert.True(schooljaar.IsLesdag(blok.Start), $"blok {blok.Ordinaal} start op een vakantiedag");
            Assert.True(schooljaar.IsLesdag(blok.Eind), $"blok {blok.Ordinaal} eindigt op een vakantiedag");
        }
    }

    [Fact]
    public void Blokken_blijven_binnen_het_schooljaar_en_zijn_opeenvolgend()
    {
        var schooljaar = Schooljaar();
        var blokken = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions())
            .Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        Assert.NotEmpty(blokken);
        Assert.Equal(schooljaar.Start, blokken[0].Start);
        Assert.Equal(schooljaar.Eind, blokken[^1].Eind);

        // Ordinals are 1-based and gapless, and blocks are in chronological order.
        Assert.Equal(Enumerable.Range(1, blokken.Count), blokken.Select(b => b.Ordinaal));
        for (var i = 1; i < blokken.Count; i++)
        {
            Assert.True(blokken[i].Start > blokken[i - 1].Eind);
        }
    }

    /// <summary>
    /// A too-short remainder is absorbed into the preceding block instead of becoming a stub: a two-day
    /// "period" is not plannable. This is why block spans vary — the grid is pedagogical, not arithmetic.
    /// </summary>
    [Fact]
    public void Te_korte_restduur_wordt_bij_het_vorige_blok_gevoegd()
    {
        // A 16-day stretch with a 14-day block leaves a 2-day tail, below the 5-day minimum.
        var schooljaar = new Schooljaar("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 16));
        var indeling = new GeconfigureerdePlanningsblokIndeling(
            new PlanningsblokOptions { ThemaperiodeWeken = 2, MinimumBlokDagen = 5 });

        var blokken = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        var blok = Assert.Single(blokken);
        Assert.Equal(schooljaar.Eind, blok.Eind);
        Assert.Equal(16, blok.AantalDagen);
    }

    [Fact]
    public void Onbruikbare_configuratie_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(() =>
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions { ThemaperiodeWeken = 0 }));

        // The message must point at the config section, since that is where the fix lives.
        Assert.Contains(PlanningsblokOptions.SectionName, fout.Message);
    }

    /// <summary>
    /// Guards Art. IX.3's prohibition structurally: no tier may be named after a calendar unit. If someone
    /// later adds a <c>Maand</c> member, this fails.
    /// </summary>
    [Fact]
    public void Geen_enkel_niveau_is_een_kalendereenheid()
    {
        var namen = Enum.GetNames<Planningsblokniveau>();

        Assert.Equal(["Themaperiode", "Subthemaperiode"], namen);
        Assert.DoesNotContain("Maand", namen);
    }

    /// <summary>A Belgian school year with the four standard vacations.</summary>
    private static Schooljaar Schooljaar()
    {
        var schooljaar = new Schooljaar("2026-2027", Start, Eind);
        schooljaar.VoegVakantieToe(new Schoolvakantie("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        schooljaar.VoegVakantieToe(new Schoolvakantie("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));
        schooljaar.VoegVakantieToe(new Schoolvakantie("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        schooljaar.VoegVakantieToe(new Schoolvakantie("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));
        return schooljaar;
    }
}
