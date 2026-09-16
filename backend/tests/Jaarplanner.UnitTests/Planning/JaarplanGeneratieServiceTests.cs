using System.ComponentModel.DataAnnotations;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// What is left of the jaarplan generation while it is switched off (ADR-0053 decision 9): the service refuses a run
/// after checking the class, it still reads the kept pre-generation parameters, and the parked pieces the rework will
/// build on — the prompt builder and the parameters' own rules — keep their behaviour.
/// </summary>
public sealed class JaarplanGeneratieServiceTests
{
    private static readonly IPlanningsblokIndeling Indeling =
        new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

    private static IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar) =>
        Indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

    private static Thema Herfst()
    {
        var thema = new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur");
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Aanvaard, "anchor"));
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "nog niet beslist"));
        thema.KoppelMinimumdoel("K-1.1.1");

        return thema;
    }

    private static Thema Water() => new("Water", duurWeken: 5);

    private static (JaarplanGeneratieService Service, FakeJaarplanOpslag Opslag, Klas Klas, Schooljaar Schooljaar) Opzet()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", "L3");
        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [Herfst(), Water()]);

        return (new JaarplanGeneratieService(opslag), opslag, klas, schooljaar);
    }

    [Fact]
    public async Task Een_generatie_wordt_geweigerd_en_verandert_niets()
    {
        var (service, opslag, klas, _) = Opzet();

        var fout = await Assert.ThrowsAsync<GeneratieUitgeschakeldFout>(() => service.GenereerAsync(klas.Id));

        Assert.Contains("tijdelijk uit", fout.Message);
        Assert.Equal(0, opslag.AantalKeerBewaard);
        Assert.Null(opslag.Jaarplan);
    }

    [Fact]
    public async Task Een_onbekende_klas_geeft_nietgevonden_en_geen_weigering()
    {
        var (service, _, _, _) = Opzet();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => service.GenereerAsync(Guid.NewGuid()));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => service.HaalParametersAsync(Guid.NewGuid()));
    }

    [Fact]
    public void Service_verwerpt_een_null_opslag() =>
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(null!));

    /// <summary>The kept settings are still readable, and "none kept" is the empty set rather than a not-found.</summary>
    [Fact]
    public async Task De_bewaarde_parameters_zijn_uitleesbaar_en_leeg_is_geen_fout()
    {
        var (service, opslag, klas, schooljaar) = Opzet();

        Assert.Same(JaarplanGeneratieParameters.Geen, await service.HaalParametersAsync(klas.Id));

        var bewaard = new Generatieparameters(klas.Id, schooljaar.Id);
        bewaard.Vervang(
            [new BewaardStartthema(new DateOnly(2026, 10, 5), "Water")],
            [new BewaardVastMoment("Schoolfeest", new DateOnly(2026, 9, 4), true)]);
        await opslag.ProbeerGeneratieparametersToeTeVoegenAsync(bewaard);

        var gelezen = await service.HaalParametersAsync(klas.Id);
        Assert.Equal([new Startthemakeuze(new DateOnly(2026, 10, 5), "Water")], gelezen.GewensteStartthemas);
        Assert.Equal([new VastMoment("Schoolfeest", new DateOnly(2026, 9, 4), true)], gelezen.VasteMomenten);
    }

    /// <summary>Settings kept for another school year are never read: their dates mean nothing in this one.</summary>
    [Fact]
    public async Task Bewaarde_parameters_van_een_ander_schooljaar_worden_niet_gelezen()
    {
        var (service, opslag, klas, _) = Opzet();

        var vorigJaar = new Generatieparameters(klas.Id, Guid.NewGuid());
        vorigJaar.Vervang([new BewaardStartthema(new DateOnly(2025, 9, 1), "Water")], []);
        await opslag.ProbeerGeneratieparametersToeTeVoegenAsync(vorigJaar);

        Assert.Same(JaarplanGeneratieParameters.Geen, await service.HaalParametersAsync(klas.Id));
    }

    /// <summary>Blank start thema names are normalised away and names are trimmed.</summary>
    [Fact]
    public void Startthemas_worden_genormaliseerd()
    {
        var eerste = new DateOnly(2026, 9, 1);
        var tweede = new DateOnly(2026, 11, 9);

        var parameters = new JaarplanGeneratieParameters
        {
            GewensteStartthemas =
            [
                new Startthemakeuze(tweede, "  Herfst  "),
                new Startthemakeuze(eerste, "Water"),
                new Startthemakeuze(eerste, "  "),
            ],
        };

        Assert.Equal(
            [new Startthemakeuze(eerste, "Water"), new Startthemakeuze(tweede, "Herfst")],
            parameters.GenormaliseerdeStartthemas());

        Assert.False(parameters.IsLeeg);
        Assert.True(new JaarplanGeneratieParameters().IsLeeg);
        Assert.True(JaarplanGeneratieParameters.Geen.IsLeeg);
        Assert.True(
            new JaarplanGeneratieParameters { VasteMomenten = [new VastMoment("  ", eerste, true)] }.IsLeeg);
    }

    [Fact]
    public void Twee_startthemas_voor_dezelfde_periode_worden_geweigerd_door_het_aggregaat()
    {
        var parameters = new Generatieparameters(Guid.NewGuid(), Guid.NewGuid());
        var blok = new DateOnly(2026, 9, 1);

        Assert.Throws<ArgumentException>(() => parameters.Vervang(
            [new BewaardStartthema(blok, "Water"), new BewaardStartthema(blok, "Herfst")],
            []));
    }

    [Fact]
    public void Twee_startthemas_voor_dezelfde_periode_zijn_een_ongeldig_verzoek()
    {
        var blok = new DateOnly(2026, 9, 1);
        var parameters = new JaarplanGeneratieParameters
        {
            GewensteStartthemas = [new Startthemakeuze(blok, "Water"), new Startthemakeuze(blok, "Herfst")],
        };

        var fout = Assert.Single(parameters.Validate(new ValidationContext(parameters)));
        Assert.Contains("2026-09-01", fout.ErrorMessage);
        Assert.Equal(2, parameters.GenormaliseerdeStartthemas().Count);

        var tweePeriodes = new JaarplanGeneratieParameters
        {
            GewensteStartthemas =
            [
                new Startthemakeuze(blok, "Water"),
                new Startthemakeuze(blok.AddDays(40), "Water"),
            ],
        };
        Assert.Empty(tweePeriodes.Validate(new ValidationContext(tweePeriodes)));
    }

    // --- The parked prompt builder (ADR-0053 decision 9): its behaviour is kept for the generation's rework. ---

    private static (Klas Klas, Schooljaar Schooljaar, IReadOnlyList<Planningsblok> Blokken, IReadOnlyList<Thema> Themas)
        PromptOpzet()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", "L3");

        return (klas, schooljaar, Blokken(schooljaar), [Herfst(), Water()]);
    }

    /// <summary>
    /// The prompt offers the derived blocks with their start dates and a whole-week capacity
    /// (<c>ceil(open days / 7)</c>), the school's own thema's, and no month name.
    /// </summary>
    [Fact]
    public void De_prompt_biedt_de_afgeleide_blokken_aan_en_geen_kalendereenheid()
    {
        var (klas, schooljaar, blokken, themas) = PromptOpzet();

        var request = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, blokken, themas);
        var prompt = request.UserPrompt;

        foreach (var blok in blokken)
        {
            Assert.Contains($"startdatum {blok.Start:yyyy-MM-dd}", prompt);
            var capaciteit = (int)Math.Ceiling(schooljaar.TelOpenDagen(blok.Start, blok.Eind) / 7.0);
            Assert.Contains($"({capaciteit} weken)", prompt);
        }

        Assert.DoesNotMatch(@"\d[.,]\d weken", prompt);
        Assert.Contains("Thema: Herfst", prompt);
        Assert.Contains("Thema: Water", prompt);

        foreach (var maand in (string[])
                 ["januari", "februari", "maart", "april", "juni", "juli", "augustus", "oktober", "november", "december"])
        {
            Assert.DoesNotContain(maand, prompt, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(maand, request.SystemPrompt, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains("STARTDATUM", request.SystemPrompt);
        Assert.Contains("nooit met zijn nummer", request.SystemPrompt);

        // Only teacher-backed goals are shown (aanvaard/manueel).
        Assert.Contains("NAT-K3-01", prompt);
        Assert.DoesNotContain("NAT-K3-02", prompt);

        // The thema's minimumdoelen, its themadoelen, reach the model too (FB-053).
        Assert.Contains("Themadoelen, minimumdoelen (1): K-1.1.1", prompt);
    }

    [Fact]
    public void De_prompt_vraagt_spreiding_en_volledige_dekking_zonder_streefcijfer()
    {
        var (klas, schooljaar, blokken, themas) = PromptOpzet();

        var request = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, blokken, themas);
        var systeem = request.SystemPrompt;
        var prompt = request.UserPrompt;

        Assert.Contains("zoveel mogelijk verschillende planningsblokken", systeem);
        Assert.Contains("Gebruik geen externe kennis", systeem);
        Assert.Contains("Gekoppelde leerplandoelen (1): NAT-K3-01", prompt);
        Assert.Contains($"Aantal beschikbare blokken: {blokken.Count}", prompt);
        Assert.Contains("Dekking (streef naar volledige dekking over het hele schooljaar):", systeem);
        Assert.Contains("Je hoeft niet elk thema te gebruiken", systeem);
        Assert.Contains($"Aantal thema's: {themas.Count}", prompt);
        Assert.DoesNotContain("%", systeem);
        Assert.DoesNotContain("minimumdoel", systeem, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Startthemas_staan_elk_bij_hun_eigen_blok_en_zonder_parameters_verandert_de_prompt_niet()
    {
        var (klas, schooljaar, blokken, themas) = PromptOpzet();

        var met = JaarplanGeneratiePromptBuilder.Bouw(
            klas,
            schooljaar,
            blokken,
            themas,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas =
                [
                    new Startthemakeuze(blokken[0].Start, "Water"),
                    new Startthemakeuze(blokken[1].Start, "Herfst"),
                ],
            }).UserPrompt;

        Assert.Contains("Wat de leerkracht vooraf vraagt", met);
        Assert.Contains($"\"Water\" in het blok met startdatum {blokken[0].Start:yyyy-MM-dd}", met);
        Assert.Contains($"\"Herfst\" in het blok met startdatum {blokken[1].Start:yyyy-MM-dd}", met);
        Assert.DoesNotContain("vakantie", met, StringComparison.OrdinalIgnoreCase);

        var zonder = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, blokken, themas).UserPrompt;
        var leeg = JaarplanGeneratiePromptBuilder.Bouw(
            klas, schooljaar, blokken, themas, new JaarplanGeneratieParameters()).UserPrompt;

        Assert.DoesNotContain("Wat de leerkracht vooraf vraagt", zonder);
        Assert.Equal(zonder, leeg);
    }

    [Fact]
    public void De_periodeprompt_vraagt_enkel_die_periode_en_noemt_wat_blijft_staan()
    {
        var (klas, schooljaar, blokken, themas) = PromptOpzet();

        var prompt = JaarplanGeneratiePromptBuilder.BouwVoorPeriode(
            klas, schooljaar, blokken, themas, blokken[2], [new BestaandePlaatsing("Water", blokken[4].Start)])
            .UserPrompt;

        var datum = blokken[2].Start.ToString("yyyy-MM-dd");
        Assert.Contains($"Vul ENKEL de periode met startdatum {datum}", prompt, StringComparison.Ordinal);
        var alGeplaatst = prompt[prompt.IndexOf("# Wat al in het jaarplan staat", StringComparison.Ordinal)..];
        Assert.Contains("Water", alGeplaatst, StringComparison.Ordinal);

        var leeg = JaarplanGeneratiePromptBuilder.BouwVoorPeriode(klas, schooljaar, blokken, themas, blokken[2], [])
            .UserPrompt;
        Assert.Contains("nog geen thema dat blijft staan", leeg, StringComparison.Ordinal);

        var geheel = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, blokken, themas).UserPrompt;
        Assert.DoesNotContain("# Opdracht", geheel, StringComparison.Ordinal);
    }
}
