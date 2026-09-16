using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The jaarplan as a teacher builds it by hand (FR-6, FR-7, ADR-0049), against <see cref="FakeJaarplanOpslag"/> with no
/// database. The year is <see cref="TestSchooljaar.MetVakanties"/>: Tuesday 1 September 2026 to Wednesday 30 June 2027,
/// herfstvakantie 2–8 Nov, kerstvakantie 21 Dec – 3 Jan, krokusvakantie 15–21 Feb, paasvakantie 5–18 Apr. Herfst lasts
/// 5 weeks and Water 2.
/// </summary>
public sealed class JaarplanServiceTests
{
    private static DateOnly D(int jaar, int maand, int dag) => new(jaar, maand, dag);

    private sealed record Opzet(
        JaarplanService Service,
        FakeJaarplanOpslag Opslag,
        Klas Klas,
        Schooljaar Schooljaar,
        Thema Herfst,
        Thema Water);

    private static Opzet Maak(Action<Jaarplan, Thema, Thema>? plan = null)
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", "L3");

        var herfst = new Thema("Herfst", duurWeken: 5);
        herfst.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Aanvaard, "anchor"));
        var water = new Thema("Water", duurWeken: 2);

        Jaarplan? jaarplan = null;
        if (plan is not null)
        {
            jaarplan = new Jaarplan(klas.Id);
            plan(jaarplan, herfst, water);
        }

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst, water], jaarplan);

        return new Opzet(new JaarplanService(opslag), opslag, klas, schooljaar, herfst, water);
    }

    private static (DateOnly Van, DateOnly Tot)[] Dagen(Jaarplan jaarplan) =>
        jaarplan.Plaatsingen.Select(p => (p.Van, p.Tot)).ToArray();

    [Fact]
    public void Service_verwerpt_een_null_opslag() =>
        Assert.Throws<ArgumentNullException>(() => new JaarplanService(null!));

    // --- HaalJaarplan ---

    [Fact]
    public async Task Een_klas_zonder_jaarplan_leest_als_een_leeg_jaar_met_al_zijn_lesweken()
    {
        var o = Maak();

        var plan = await o.Service.HaalJaarplanAsync(o.Klas.Id);

        Assert.Equal(o.Klas.Id, plan.KlasId);
        Assert.Equal(o.Schooljaar.Naam, plan.SchooljaarNaam);
        Assert.Equal(D(2026, 9, 1), plan.EersteSchooldag);
        Assert.Equal(D(2027, 6, 30), plan.LaatsteSchooldag);
        Assert.Empty(plan.Plaatsingen);

        // 44 Mondays from 31 Aug to 28 Jun, minus the six weeks that are all vacation.
        Assert.Equal(38, plan.Lesweken.Count);
        Assert.All(plan.Lesweken, w => Assert.False(w.HeeftThema));
        Assert.Equal(new JaarbalansWeergave(38, 0, 38), plan.Balans);
        Assert.DoesNotContain(plan.Lesweken, w => w.Maandag == D(2026, 11, 2));
    }

    [Fact]
    public async Task Een_onbekende_klas_is_niet_gevonden()
    {
        var o = Maak();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => o.Service.HaalJaarplanAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Het_plan_toont_plaatsingen_lesweken_en_balans()
    {
        var o = Maak((plan, herfst, water) =>
        {
            // Herfst's proposed end from Mon 7 Sep is Fri 9 Oct (5 lesweken).
            plan.VoegPlaatsingToe(herfst.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Voorgesteld, "herfst past hier");

            // Water's proposed end from Mon 12 Oct is Fri 23 Oct; the teacher stopped it on Thu 22 Oct.
            plan.VoegPlaatsingToe(water.Id, D(2026, 10, 12), D(2026, 10, 22), KoppelingStatus.Manueel);
        });

        var plan = await o.Service.HaalJaarplanAsync(o.Klas.Id);

        var herfst = plan.Plaatsingen[0];
        Assert.Equal("Herfst", herfst.ThemaNaam);
        Assert.Equal((D(2026, 9, 7), D(2026, 10, 9)), (herfst.Van, herfst.Tot));
        Assert.Equal("Voorgesteld", herfst.Status);
        Assert.Equal("herfst past hier", herfst.AiMotivatie);
        Assert.Equal(5, herfst.DuurWeken);
        Assert.Contains("NAT-K3-01", herfst.Doelcodes);
        Assert.False(herfst.IsVervallen);
        Assert.Equal(new ReeksWeergave(1, 1, D(2026, 9, 7), D(2026, 10, 9), 5, false, false), herfst.Reeks);

        var water = plan.Plaatsingen[1];
        Assert.Empty(water.Doelcodes);
        Assert.Equal(new ReeksWeergave(1, 1, D(2026, 10, 12), D(2026, 10, 22), 1, true, false), water.Reeks);

        // Five weeks of Herfst and two of Water; the week of 31 Aug is empty.
        Assert.Equal(new JaarbalansWeergave(38, 7, 31), plan.Balans);
        Assert.False(plan.Lesweken.Single(w => w.Maandag == D(2026, 8, 31)).HeeftThema);
        Assert.True(plan.Lesweken.Single(w => w.Maandag == D(2026, 10, 19)).HeeftThema);
        Assert.False(plan.Lesweken.Single(w => w.Maandag == D(2026, 10, 26)).HeeftThema);
    }

    [Fact]
    public async Task Delen_rond_een_vakantie_worden_als_een_reeks_genummerd()
    {
        var o = Maak((plan, _, water) =>
        {
            // Water from Mon 26 Oct: 26 Oct, herfstvakantie skipped, 9 Nov; proposed end Fri 13 Nov.
            plan.VoegPlaatsingToe(water.Id, D(2026, 10, 26), D(2026, 10, 30), KoppelingStatus.Manueel);
            plan.VoegPlaatsingToe(water.Id, D(2026, 11, 9), D(2026, 11, 13), KoppelingStatus.Manueel);
        });

        var plan = await o.Service.HaalJaarplanAsync(o.Klas.Id);

        Assert.Equal(
            [
                new ReeksWeergave(1, 2, D(2026, 10, 26), D(2026, 11, 13), 2, false, false),
                new ReeksWeergave(2, 2, D(2026, 10, 26), D(2026, 11, 13), 2, false, false),
            ],
            plan.Plaatsingen.Select(p => p.Reeks));
        Assert.All(plan.Plaatsingen, p => Assert.False(p.IsVervallen));
    }

    [Fact]
    public async Task Een_thema_dat_door_het_einde_van_het_jaar_stopt_wordt_zo_gemeld()
    {
        var o = Maak((plan, herfst, _) =>
            // From Mon 14 Jun, 5 lesweken would end in July; the proposal is cut to Wed 30 Jun.
            plan.VoegPlaatsingToe(herfst.Id, D(2027, 6, 14), D(2027, 6, 30), KoppelingStatus.Manueel));

        var reeks = (await o.Service.HaalJaarplanAsync(o.Klas.Id)).Plaatsingen.Single().Reeks!;

        Assert.True(reeks.StoptBijEindeSchooljaar);
        Assert.False(reeks.EindeAangepast);
        Assert.Equal(2, reeks.Weken);
    }

    [Fact]
    public async Task Een_ingekort_thema_aan_het_einde_van_het_jaar_is_aangepast_niet_gestopt()
    {
        var o = Maak((plan, herfst, _) =>
            plan.VoegPlaatsingToe(herfst.Id, D(2027, 6, 14), D(2027, 6, 25), KoppelingStatus.Manueel));

        var reeks = (await o.Service.HaalJaarplanAsync(o.Klas.Id)).Plaatsingen.Single().Reeks!;

        Assert.True(reeks.EindeAangepast);
        Assert.False(reeks.StoptBijEindeSchooljaar);
    }

    [Fact]
    public async Task Een_nieuwe_vakantie_in_een_plaatsing_maakt_ze_vervallen_zonder_iets_te_verschuiven()
    {
        var o = Maak((plan, herfst, water) =>
        {
            plan.VoegPlaatsingToe(water.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel);
            plan.VoegPlaatsingToe(herfst.Id, D(2026, 9, 21), D(2026, 10, 23), KoppelingStatus.Manueel);
        });

        o.Schooljaar.VoegSluitingToe(new Schoolsluiting("Extra vakantie", D(2026, 9, 14), D(2026, 9, 15)));
        var plan = await o.Service.HaalJaarplanAsync(o.Klas.Id);

        Assert.True(plan.Plaatsingen[0].IsVervallen);
        Assert.Equal((D(2026, 9, 7), D(2026, 9, 18)), (plan.Plaatsingen[0].Van, plan.Plaatsingen[0].Tot));
        Assert.False(plan.Plaatsingen[1].IsVervallen);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_geweigerde_plaatsing_telt_niet_als_week_met_thema_en_heeft_geen_reeks()
    {
        var o = Maak((plan, herfst, _) =>
            plan.VoegPlaatsingToe(herfst.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Geweigerd));

        var plan = await o.Service.HaalJaarplanAsync(o.Klas.Id);

        Assert.Null(plan.Plaatsingen.Single().Reeks);
        Assert.Equal(0, plan.Balans.MetThema);
    }

    // --- StelEindeVoor ---

    [Fact]
    public async Task Het_voorstel_volgt_de_duur_van_het_thema_en_schrijft_niets()
    {
        var o = Maak();

        var voorstel = await o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 7));

        Assert.Equal(D(2026, 9, 7), voorstel.Van);
        Assert.Equal(D(2026, 10, 9), voorstel.Tot);
        Assert.Equal([new DeelWeergave(D(2026, 9, 7), D(2026, 10, 9))], voorstel.Delen);
        Assert.Null(voorstel.BeperktDoor);
        Assert.Null(voorstel.VolgendThemaNaam);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
        Assert.Null(o.Opslag.Jaarplan);
    }

    [Fact]
    public async Task Het_voorstel_toont_de_delen_rond_een_vakantie()
    {
        var o = Maak();

        // Mon 19 Oct + 5: 19 Oct, 26 Oct, (herfst), 9, 16, 23 Nov; target Mon 30 Nov, so Fri 27 Nov.
        var voorstel = await o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 10, 19));

        Assert.Equal(D(2026, 11, 27), voorstel.Tot);
        Assert.Equal(
            [new DeelWeergave(D(2026, 10, 19), D(2026, 10, 30)), new DeelWeergave(D(2026, 11, 9), D(2026, 11, 27))],
            voorstel.Delen);
    }

    [Fact]
    public async Task Het_voorstel_stopt_voor_het_volgende_thema_en_noemt_het()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 9, 28), D(2026, 10, 9), KoppelingStatus.Manueel));

        var voorstel = await o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 7));

        Assert.Equal(D(2026, 9, 25), voorstel.Tot);
        Assert.Equal(JaarplanService.BeperktDoorVolgendThema, voorstel.BeperktDoor);
        Assert.Equal("Water", voorstel.VolgendThemaNaam);
    }

    [Fact]
    public async Task Een_later_thema_na_het_voorgestelde_einde_beperkt_niets()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 10, 12), D(2026, 10, 23), KoppelingStatus.Manueel));

        var voorstel = await o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 7));

        Assert.Equal(D(2026, 10, 9), voorstel.Tot);
        Assert.Null(voorstel.BeperktDoor);
    }

    [Fact]
    public async Task Het_voorstel_stopt_op_de_laatste_schooldag()
    {
        var o = Maak();

        var voorstel = await o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2027, 6, 14));

        Assert.Equal(D(2027, 6, 30), voorstel.Tot);
        Assert.Equal(JaarplanService.BeperktDoorSchooljaar, voorstel.BeperktDoor);
    }

    [Fact]
    public async Task Een_begin_zonder_school_wordt_geweigerd_met_de_datum()
    {
        var o = Maak();

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 5)));

        Assert.Contains("5 september 2026", fout.Message);
        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 11, 4)));
    }

    [Fact]
    public async Task Een_begin_buiten_het_schooljaar_wordt_geweigerd_met_de_grenzen()
    {
        var o = Maak();

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 8, 31)));

        Assert.Contains("1 september 2026", fout.Message);
        Assert.Contains("30 juni 2027", fout.Message);
    }

    [Fact]
    public async Task Een_begin_op_een_bezette_dag_wordt_geweigerd_met_het_thema()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel));

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.StelEindeVoorAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 10)));

        Assert.Contains("'Water'", fout.Message);
        Assert.Contains("7 september 2026", fout.Message);
    }

    [Fact]
    public async Task Een_onbekend_thema_of_een_onbekende_klas_is_niet_gevonden()
    {
        var o = Maak();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => o.Service.StelEindeVoorAsync(o.Klas.Id, Guid.NewGuid(), D(2026, 9, 7)));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => o.Service.StelEindeVoorAsync(Guid.NewGuid(), o.Herfst.Id, D(2026, 9, 7)));
    }

    // --- PlaatsThema ---

    [Fact]
    public async Task Plaatsen_maakt_het_jaarplan_aan_met_een_manuele_plaatsing()
    {
        var o = Maak();

        var plan = await o.Service.PlaatsThemaAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 7), D(2026, 10, 9));

        var jaarplan = o.Opslag.Jaarplan!;
        Assert.Equal(o.Klas.Id, jaarplan.KlasId);
        var plaatsing = Assert.Single(jaarplan.Plaatsingen);
        Assert.Equal(o.Herfst.Id, plaatsing.ThemaId);
        Assert.Equal((D(2026, 9, 7), D(2026, 10, 9)), (plaatsing.Van, plaatsing.Tot));
        Assert.Equal(KoppelingStatus.Manueel, plaatsing.Status);
        Assert.Null(plaatsing.AiMotivatie);
        Assert.Equal(1, o.Opslag.AantalKeerBewaard);
        Assert.Equal(plaatsing.Id, Assert.Single(plan.Plaatsingen).Id);
    }

    [Fact]
    public async Task Plaatsen_over_een_vakantie_bewaart_twee_manuele_delen()
    {
        var o = Maak();

        var plan = await o.Service.PlaatsThemaAsync(o.Klas.Id, o.Herfst.Id, D(2026, 10, 19), D(2026, 11, 27));

        Assert.Equal(
            [(D(2026, 10, 19), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 27))],
            Dagen(o.Opslag.Jaarplan!));
        Assert.All(o.Opslag.Jaarplan!.Plaatsingen, p => Assert.Equal(KoppelingStatus.Manueel, p.Status));
        Assert.Equal([2, 2], plan.Plaatsingen.Select(p => p.Reeks!.AantalDelen));
        Assert.All(plan.Plaatsingen, p => Assert.False(p.Reeks!.EindeAangepast));
    }

    [Fact]
    public async Task Zonder_einde_wordt_het_voorstel_gebruikt()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 9, 28), D(2026, 10, 9), KoppelingStatus.Manueel));

        await o.Service.PlaatsThemaAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 7), tot: null);

        Assert.Equal((D(2026, 9, 7), D(2026, 9, 25)), Dagen(o.Opslag.Jaarplan!)[0]);
    }

    [Fact]
    public async Task Een_einde_na_het_schooljaar_wordt_de_laatste_schooldag()
    {
        var o = Maak();

        await o.Service.PlaatsThemaAsync(o.Klas.Id, o.Water.Id, D(2027, 6, 21), D(2027, 7, 9));

        Assert.Equal([(D(2027, 6, 21), D(2027, 6, 30))], Dagen(o.Opslag.Jaarplan!));
    }

    [Fact]
    public async Task Een_einde_in_het_weekend_wordt_de_vrijdag_ervoor()
    {
        var o = Maak();

        await o.Service.PlaatsThemaAsync(o.Klas.Id, o.Water.Id, D(2026, 9, 7), D(2026, 9, 20));

        Assert.Equal([(D(2026, 9, 7), D(2026, 9, 18))], Dagen(o.Opslag.Jaarplan!));
    }

    [Fact]
    public async Task Een_einde_voor_het_begin_wordt_geweigerd_en_er_wordt_niets_bewaard()
    {
        var o = Maak();

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.PlaatsThemaAsync(o.Klas.Id, o.Water.Id, D(2026, 9, 14), D(2026, 9, 11)));

        Assert.Null(o.Opslag.Jaarplan);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Theory]
    [InlineData(2026, 9, 6)] // a Sunday
    [InlineData(2026, 8, 31)] // before the year
    [InlineData(2027, 7, 5)] // after the year
    public async Task Een_ongeldig_begin_wordt_geweigerd(int jaar, int maand, int dag)
    {
        var o = Maak();

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(() => o.Service.PlaatsThemaAsync(
            o.Klas.Id, o.Water.Id, D(jaar, maand, dag), D(jaar, maand, dag).AddDays(10)));
        Assert.Null(o.Opslag.Jaarplan);
    }

    [Fact]
    public async Task Een_overlap_wordt_geweigerd_met_de_naam_van_het_andere_thema()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 9, 14), D(2026, 9, 25), KoppelingStatus.Manueel));

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.PlaatsThemaAsync(o.Klas.Id, o.Herfst.Id, D(2026, 9, 7), D(2026, 9, 18)));

        Assert.Contains("'Water'", fout.Message);
        Assert.Single(o.Opslag.Jaarplan!.Plaatsingen);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_overlap_in_het_tweede_deel_weigert_ook_het_eerste()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 11, 16), D(2026, 11, 20), KoppelingStatus.Manueel));

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.PlaatsThemaAsync(o.Klas.Id, o.Herfst.Id, D(2026, 10, 19), D(2026, 11, 27)));

        Assert.Single(o.Opslag.Jaarplan!.Plaatsingen);
    }

    [Fact]
    public async Task Hetzelfde_thema_later_in_het_jaar_mag()
    {
        var o = Maak((plan, _, water) =>
            plan.VoegPlaatsingToe(water.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel));

        var plan = await o.Service.PlaatsThemaAsync(o.Klas.Id, o.Water.Id, D(2027, 3, 1), null);

        Assert.Equal(2, plan.Plaatsingen.Count);
        Assert.Equal(D(2027, 3, 12), plan.Plaatsingen[1].Tot);
    }

    [Fact]
    public async Task Plaatsen_van_een_onbekend_thema_is_niet_gevonden()
    {
        var o = Maak();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => o.Service.PlaatsThemaAsync(o.Klas.Id, Guid.NewGuid(), D(2026, 9, 7), D(2026, 9, 18)));
    }

    // --- WijzigDatums ---

    [Fact]
    public async Task Nieuwe_datums_maken_een_voorstel_manueel_en_wissen_de_motivatie()
    {
        Themaplaatsing? voorstel = null;
        var o = Maak((plan, herfst, _) =>
            voorstel = plan.VoegPlaatsingToe(
                herfst.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Voorgesteld, "herfst past hier"));

        var plan = await o.Service.WijzigDatumsAsync(o.Klas.Id, voorstel!.Id, D(2026, 9, 14), D(2026, 10, 9));

        Assert.Equal((D(2026, 9, 14), D(2026, 10, 9)), (voorstel.Van, voorstel.Tot));
        Assert.Equal(KoppelingStatus.Manueel, voorstel.Status);
        Assert.Null(voorstel.AiMotivatie);
        Assert.Equal(1, o.Opslag.AantalKeerBewaard);
        Assert.True(plan.Plaatsingen.Single().Reeks!.EindeAangepast);
    }

    [Fact]
    public async Task Ongewijzigde_datums_schrijven_niets_en_laten_het_voorstel_staan()
    {
        Themaplaatsing? voorstel = null;
        var o = Maak((plan, herfst, _) =>
            voorstel = plan.VoegPlaatsingToe(
                herfst.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Voorgesteld, "herfst past hier"));

        await o.Service.WijzigDatumsAsync(o.Klas.Id, voorstel!.Id, D(2026, 9, 7), D(2026, 10, 9));

        Assert.Equal(KoppelingStatus.Voorgesteld, voorstel.Status);
        Assert.Equal("herfst past hier", voorstel.AiMotivatie);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_vervallen_plaatsing_ongewijzigd_bewaren_splitst_ze_opnieuw()
    {
        Themaplaatsing? water = null;
        var o = Maak((plan, _, w) =>
            water = plan.VoegPlaatsingToe(w.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Voorgesteld, "water"));
        o.Schooljaar.VoegSluitingToe(new Schoolsluiting("Extra vakantie", D(2026, 9, 14), D(2026, 9, 15)));

        var plan = await o.Service.WijzigDatumsAsync(o.Klas.Id, water!.Id, D(2026, 9, 7), D(2026, 9, 18));

        Assert.Equal(
            [(D(2026, 9, 7), D(2026, 9, 11)), (D(2026, 9, 16), D(2026, 9, 18))],
            Dagen(o.Opslag.Jaarplan!));
        Assert.Equal((D(2026, 9, 7), D(2026, 9, 11)), (water.Van, water.Tot));
        Assert.All(plan.Plaatsingen, p => Assert.False(p.IsVervallen));
        Assert.All(o.Opslag.Jaarplan!.Plaatsingen, p => Assert.Equal(KoppelingStatus.Manueel, p.Status));
    }

    [Fact]
    public async Task Nieuwe_datums_over_een_vakantie_voegen_een_deel_toe()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 10, 5), D(2026, 10, 9), KoppelingStatus.Manueel));

        await o.Service.WijzigDatumsAsync(o.Klas.Id, herfst!.Id, D(2026, 10, 19), D(2026, 11, 13));

        Assert.Equal(
            [(D(2026, 10, 19), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 13))],
            Dagen(o.Opslag.Jaarplan!));
        Assert.Equal(D(2026, 10, 19), herfst.Van);
        Assert.All(o.Opslag.Jaarplan!.Plaatsingen, p => Assert.Equal(o.Herfst.Id, p.ThemaId));
    }

    [Fact]
    public async Task Een_overlap_met_een_eigen_deel_wordt_geweigerd()
    {
        Themaplaatsing? eerste = null;
        var o = Maak((plan, h, _) =>
        {
            eerste = plan.VoegPlaatsingToe(h.Id, D(2026, 10, 19), D(2026, 10, 30), KoppelingStatus.Manueel);
            plan.VoegPlaatsingToe(h.Id, D(2026, 11, 9), D(2026, 11, 20), KoppelingStatus.Manueel);
        });

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.WijzigDatumsAsync(o.Klas.Id, eerste!.Id, D(2026, 10, 19), D(2026, 11, 13)));

        Assert.Contains("'Herfst'", fout.Message);
        Assert.Equal(D(2026, 10, 30), eerste!.Tot);
        Assert.Equal(2, o.Opslag.Jaarplan!.Plaatsingen.Count);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Nieuwe_datums_die_zichzelf_overlappen_mogen()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Manueel));

        await o.Service.WijzigDatumsAsync(o.Klas.Id, herfst!.Id, D(2026, 9, 7), D(2026, 10, 2));

        Assert.Equal(D(2026, 10, 2), herfst.Tot);
    }

    [Fact]
    public async Task Datums_wijzigen_weigert_een_einde_voor_het_begin_en_een_onbekende_plaatsing()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Manueel));

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.WijzigDatumsAsync(o.Klas.Id, herfst!.Id, D(2026, 9, 14), D(2026, 9, 7)));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => o.Service.WijzigDatumsAsync(o.Klas.Id, Guid.NewGuid(), D(2026, 9, 7), D(2026, 9, 14)));

        var zonderPlan = Maak();
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => zonderPlan.Service.WijzigDatumsAsync(zonderPlan.Klas.Id, Guid.NewGuid(), D(2026, 9, 7), D(2026, 9, 14)));
    }

    // --- Verschuif ---

    [Fact]
    public async Task Verschuiven_behoudt_het_aantal_schooldagen()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Voorgesteld, "m"));

        await o.Service.VerschuifAsync(o.Klas.Id, herfst!.Id, D(2026, 9, 21));

        Assert.Equal((D(2026, 9, 21), D(2026, 10, 2)), (herfst.Van, herfst.Tot));
        Assert.Equal(KoppelingStatus.Manueel, herfst.Status);
        Assert.Null(herfst.AiMotivatie);
    }

    [Fact]
    public async Task Verschuiven_naar_een_weekend_begint_de_maandag_erna()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel));

        await o.Service.VerschuifAsync(o.Klas.Id, herfst!.Id, D(2026, 9, 19));

        Assert.Equal((D(2026, 9, 21), D(2026, 10, 2)), (herfst.Van, herfst.Tot));
    }

    [Fact]
    public async Task Verschuiven_over_een_vakantie_splitst_met_dezelfde_schooldagen()
    {
        Themaplaatsing? water = null;
        var o = Maak((plan, _, w) =>
            water = plan.VoegPlaatsingToe(w.Id, D(2026, 10, 19), D(2026, 10, 23), KoppelingStatus.Manueel));

        // Five schooldagen from Wed 28 Oct: 28, 29, 30 Oct, then 9 and 10 Nov.
        await o.Service.VerschuifAsync(o.Klas.Id, water!.Id, D(2026, 10, 28));

        Assert.Equal(
            [(D(2026, 10, 28), D(2026, 10, 30)), (D(2026, 11, 9), D(2026, 11, 10))],
            Dagen(o.Opslag.Jaarplan!));
    }

    [Fact]
    public async Task Verschuiven_naar_hetzelfde_begin_schrijft_niets()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Voorgesteld, "m"));

        await o.Service.VerschuifAsync(o.Klas.Id, herfst!.Id, D(2026, 9, 5));

        Assert.Equal(KoppelingStatus.Voorgesteld, herfst.Status);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Theory]
    [InlineData(2026, 8, 24)]
    [InlineData(2027, 7, 5)]
    public async Task Verschuiven_buiten_het_schooljaar_wordt_geweigerd(int jaar, int maand, int dag)
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel));

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.VerschuifAsync(o.Klas.Id, herfst!.Id, D(jaar, maand, dag)));
        Assert.Equal(D(2026, 9, 7), herfst!.Van);
    }

    [Fact]
    public async Task Verschuiven_tot_na_het_jaar_stopt_op_de_laatste_schooldag()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel));

        await o.Service.VerschuifAsync(o.Klas.Id, herfst!.Id, D(2027, 6, 28));

        Assert.Equal((D(2027, 6, 28), D(2027, 6, 30)), (herfst.Van, herfst.Tot));
    }

    [Fact]
    public async Task Verschuiven_op_een_ander_thema_wordt_geweigerd()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, w) =>
        {
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 9, 18), KoppelingStatus.Manueel);
            plan.VoegPlaatsingToe(w.Id, D(2026, 9, 21), D(2026, 10, 2), KoppelingStatus.Manueel);
        });

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => o.Service.VerschuifAsync(o.Klas.Id, herfst!.Id, D(2026, 9, 14)));

        Assert.Contains("'Water'", fout.Message);
        Assert.Equal(D(2026, 9, 7), herfst!.Van);
    }

    // --- Status, vergrendeling, verwijderen ---

    [Theory]
    [InlineData(KoppelingStatus.Aanvaard)]
    [InlineData(KoppelingStatus.Manueel)]
    public async Task Een_voorstel_aanvaarden_of_overnemen_wordt_bewaard(KoppelingStatus beslissing)
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Voorgesteld, "m"));

        var plan = await o.Service.WijzigPlaatsingStatusAsync(o.Klas.Id, herfst!.Id, beslissing);

        Assert.Equal(beslissing.ToString(), plan.Plaatsingen.Single().Status);
        Assert.Equal(1, o.Opslag.AantalKeerBewaard);
    }

    [Theory]
    [InlineData(KoppelingStatus.Geweigerd)]
    [InlineData(KoppelingStatus.Voorgesteld)]
    public async Task Weigeren_of_terug_voorstellen_via_de_status_wordt_geweigerd(KoppelingStatus status)
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Voorgesteld, "m"));

        var fout = await Assert.ThrowsAsync<OngeldigePlaatsingsstatusFout>(
            () => o.Service.WijzigPlaatsingStatusAsync(o.Klas.Id, herfst!.Id, status));

        Assert.Contains("verwijderen", fout.Message);
        Assert.Equal(KoppelingStatus.Voorgesteld, herfst!.Status);
        Assert.Equal(0, o.Opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Vergrendelen_wordt_bewaard()
    {
        Themaplaatsing? herfst = null;
        var o = Maak((plan, h, _) =>
            herfst = plan.VoegPlaatsingToe(h.Id, D(2026, 9, 7), D(2026, 10, 9), KoppelingStatus.Voorgesteld, "m"));

        var plan = await o.Service.WijzigVergrendelingAsync(o.Klas.Id, herfst!.Id, true);

        Assert.True(plan.Plaatsingen.Single().Vergrendeld);
        Assert.Equal(1, o.Opslag.AantalKeerBewaard);
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => o.Service.WijzigVergrendelingAsync(o.Klas.Id, Guid.NewGuid(), true));
    }

    [Fact]
    public async Task Verwijderen_neemt_enkel_dat_deel_weg()
    {
        Themaplaatsing? eerste = null;
        var o = Maak((plan, h, _) =>
        {
            eerste = plan.VoegPlaatsingToe(h.Id, D(2026, 10, 19), D(2026, 10, 30), KoppelingStatus.Manueel);
            plan.VoegPlaatsingToe(h.Id, D(2026, 11, 9), D(2026, 11, 27), KoppelingStatus.Manueel);
        });

        var plan = await o.Service.VerwijderPlaatsingAsync(o.Klas.Id, eerste!.Id);

        var over = Assert.Single(plan.Plaatsingen);
        Assert.Equal(D(2026, 11, 9), over.Van);
        Assert.Equal(1, over.Reeks!.AantalDelen);
        Assert.Equal(1, o.Opslag.AantalKeerBewaard);
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => o.Service.VerwijderPlaatsingAsync(o.Klas.Id, eerste.Id));
    }
}
