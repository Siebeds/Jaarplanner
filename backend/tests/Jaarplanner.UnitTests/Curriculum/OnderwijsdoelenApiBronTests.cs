using System.Net;
using System.Text;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.Extensions.Options;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Reading KOV's minimumdoelen endpoint without a network (ADR-0032): paging, the all-or-nothing rule, and every way the
/// read can fail becoming one <see cref="OpstapBronFout"/>. The page bodies use rows copied from the live API on
/// 2026-09-11, the third one shortened to two of its nine list items.
/// </summary>
public sealed class OnderwijsdoelenApiBronTests
{
    private const string Pagina1 = """
        {"$$meta": {"count": 3, "next": "/agodi/onderwijsdoelen/opstap?limit=2&keyOffset=2026-05-22T07%253A19%253A35Z%2C92410"},
         "results": [
          {"href": "/agodi/onderwijsdoelen/opstap/92958", "$$expanded": {"key": 92958, "code": "1.3.9", "uniqueCode": "K-1.3.9",
            "title": "<p>De kleuters kunnen actief deelnemen aan mondelinge interactievormen zoals kringgesprekken, samen spelen, gesprekken met gekende volwassenen en hierbij de volgende interactiestrategieën toepassen:</p>",
            "description": "<ul><li>op een gepaste manier het woord nemen en vragen;</li><li>elkaar laten uitspreken;</li></ul>",
            "type": "Na te streven minimumdoelen op populatieniveau", "validity": {"startDate": "2025-09-01T00:00:00Z"}}},
          {"href": "/agodi/onderwijsdoelen/opstap/92410", "$$expanded": {"key": 92410, "code": "5.2.1", "uniqueCode": "4-5.2.1",
            "title": "<p>De leerlingen kennen het verschil tussen bron en bewijs.</p>", "description": null,
            "type": "Te bereiken minimumdoelen op populatieniveau", "validity": {"startDate": "2025-09-01T00:00:00Z"}}}
         ]}
        """;

    private const string Pagina2 = """
        {"$$meta": {"count": 3},
         "results": [
          {"href": "/agodi/onderwijsdoelen/opstap/92581", "$$expanded": {"key": 92581, "code": "4.1.1", "uniqueCode": "6-4.1.1",
            "title": "<p>De leerlingen kennen de naam en de ligging van:&nbsp;</p>",
            "description": "<ul><li><p>Egypte, Marokko, Congo, Zuid-Afrika;&nbsp;</p></li></ul><ul><li><p>Australië, Nieuw-Zeeland;&nbsp;</p></li></ul>",
            "type": "Te bereiken minimumdoelen op populatieniveau", "validity": {"startDate": "2025-09-01T00:00:00Z"}}}
         ]}
        """;

    private static OnderwijsdoelenApiBron Bron(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> antwoord,
        TimeSpan? tijdslimiet = null)
    {
        var http = new HttpClient(new NepHandler(antwoord)) { Timeout = tijdslimiet ?? TimeSpan.FromSeconds(10) };
        var opties = Options.Create(new OpstapApiOptions
        {
            // Deliberately without a trailing slash: the source must not drop the "api" segment.
            BasisUrl = new Uri("https://voorbeeld.test/api"),
            PaginaGrootte = 2,
        });

        return new OnderwijsdoelenApiBron(http, opties, new VasteTijd(new DateTimeOffset(2026, 9, 11, 0, 0, 0, TimeSpan.Zero)));
    }

    private static Task<HttpResponseMessage> Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        });

    /// <summary>Answers page 1 for the first request and page 2 for the <c>next</c> href, recording what was asked.</summary>
    private static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> TweePaginas(List<string> gevraagd) =>
        (verzoek, _) =>
        {
            gevraagd.Add(verzoek.RequestUri!.AbsoluteUri);
            return Json(verzoek.RequestUri.Query.Contains("keyOffset", StringComparison.Ordinal) ? Pagina2 : Pagina1);
        };

    [Fact]
    public async Task Leest_alle_paginas_en_mapt_elke_rij()
    {
        var gevraagd = new List<string>();

        var resultaat = await Bron(TweePaginas(gevraagd)).HaalOpAsync();

        Assert.Empty(resultaat.Problemen);
        Assert.Equal(["K-1.3.9", "4-5.2.1", "6-4.1.1"], resultaat.Minimumdoelen.Select(m => m.Ref).ToArray());
        Assert.Equal(
            "De leerlingen kennen de naam en de ligging van:\n- Egypte, Marokko, Congo, Zuid-Afrika;\n- Australië, Nieuw-Zeeland;",
            resultaat.Minimumdoelen[2].Omschrijving);

        Assert.Equal(2, gevraagd.Count);
        Assert.Equal("https://voorbeeld.test/api/agodi/onderwijsdoelen/opstap?limit=2", gevraagd[0]);
        // The next href is followed as KOV wrote it, escapes included, under the configured base.
        Assert.StartsWith("https://voorbeeld.test/api/agodi/onderwijsdoelen/opstap?limit=2&keyOffset=", gevraagd[1], StringComparison.Ordinal);
        Assert.Contains("%253A", gevraagd[1], StringComparison.Ordinal);
    }

    [Fact]
    public async Task Minder_rijen_dan_aangekondigd_wordt_als_geheel_geweigerd()
    {
        // Page 1 announces three rows and names no next page, so only two arrive.
        var bron = Bron((_, _) => Json(Pagina1.Replace("\"next\": \"/agodi/onderwijsdoelen/opstap?limit=2&keyOffset=2026-05-22T07%253A19%253A35Z%2C92410\"", "\"next\": null", StringComparison.Ordinal)));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("announced 3 rows and 2 were read", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_foutstatus_wordt_een_bronfout_met_de_nederlandse_melding()
    {
        var bron = Bron((_, _) => Json("{}", HttpStatusCode.InternalServerError));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Equal(OpstapBronFout.Melding, fout.Message);
        Assert.Contains("500", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_antwoord_dat_geen_json_is_wordt_een_bronfout()
    {
        var bron = Bron((_, _) => Json("<html>onderhoud</html>"));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("expected JSON", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_pagina_zonder_results_wordt_een_bronfout()
    {
        var bron = Bron((_, _) => Json("""{"$$meta": {"count": 0}}"""));

        await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());
    }

    [Fact]
    public async Task Een_netwerkfout_wordt_een_bronfout()
    {
        var bron = Bron((_, _) => throw new HttpRequestException("Name or service not known"));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.IsType<HttpRequestException>(fout.InnerException);
    }

    [Fact]
    public async Task Een_verlopen_tijdslimiet_wordt_een_bronfout()
    {
        var bron = Bron(
            async (_, token) =>
            {
                await Task.Delay(Timeout.Infinite, token);
                throw new InvalidOperationException("unreachable");
            },
            tijdslimiet: TimeSpan.FromMilliseconds(50));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("timed out", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    /// <summary>A caller that gives up is not a source failure, and must not be reported as one.</summary>
    [Fact]
    public async Task Annuleren_door_de_aanroeper_blijft_een_annulering()
    {
        using var annuleer = new CancellationTokenSource();
        await annuleer.CancelAsync();
        var bron = Bron((_, token) =>
        {
            token.ThrowIfCancellationRequested();
            return Json(Pagina1);
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => bron.HaalOpAsync(annuleer.Token));
    }

    [Fact]
    public async Task Paginering_die_naar_zichzelf_verwijst_stopt_met_een_bronfout()
    {
        var zelf = Pagina1.Replace("limit=2&keyOffset=2026-05-22T07%253A19%253A35Z%2C92410", "limit=2", StringComparison.Ordinal);
        var bron = Bron((_, _) => Json(zelf));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("did not end", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_dubbele_uniqueCode_houdt_de_eerste_en_meldt_de_tweede()
    {
        var dubbel = Pagina2.Replace("6-4.1.1", "K-1.3.9", StringComparison.Ordinal).Replace("\"4.1.1\"", "\"1.3.9\"", StringComparison.Ordinal);
        var bron = Bron((verzoek, _) =>
            Json(verzoek.RequestUri!.Query.Contains("keyOffset", StringComparison.Ordinal) ? dubbel : Pagina1));

        var resultaat = await bron.HaalOpAsync();

        Assert.Equal(["K-1.3.9", "4-5.2.1"], resultaat.Minimumdoelen.Select(m => m.Ref).ToArray());
        var probleem = Assert.Single(resultaat.Problemen);
        Assert.Equal("K-1.3.9", probleem.Sleutel);
        Assert.StartsWith("De kleuters", resultaat.Minimumdoelen[0].Omschrijving, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_herkende_maar_onbruikbare_rij_wordt_gemeld_en_de_rest_ingelezen()
    {
        var kapot = Pagina2.Replace("Australië, Nieuw-Zeeland;", "H<sub>2</sub>O;", StringComparison.Ordinal);
        var bron = Bron((verzoek, _) =>
            Json(verzoek.RequestUri!.Query.Contains("keyOffset", StringComparison.Ordinal) ? kapot : Pagina1));

        var resultaat = await bron.HaalOpAsync();

        Assert.Equal(2, resultaat.Minimumdoelen.Count);
        Assert.Equal("6-4.1.1", Assert.Single(resultaat.Problemen).Sleutel);
    }

    /// <summary>
    /// A row nobody can identify could be a stored minimumdoel, and the report would then call it vanished while the
    /// source still lists it. So it refuses the read as a whole (antagonist, E1-12 round 2).
    /// </summary>
    [Theory]
    [InlineData("\"uniqueCode\": \"6-4.1.1\"", "\"uniqueCode\": \"6/4.1.1\"")]
    [InlineData("\"uniqueCode\": \"6-4.1.1\",", "")]
    public async Task Een_rij_zonder_bruikbare_uniqueCode_weigert_de_hele_lezing(string oud, string nieuw)
    {
        var kapot = Pagina2.Replace(oud, nieuw, StringComparison.Ordinal);
        var bron = Bron((verzoek, _) =>
            Json(verzoek.RequestUri!.Query.Contains("keyOffset", StringComparison.Ordinal) ? kapot : Pagina1));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("cannot all be identified", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_rij_zonder_expanded_weigert_de_hele_lezing()
    {
        var zonder = Pagina2.Replace("\"$$expanded\":", "\"nietexpanded\":", StringComparison.Ordinal);
        var bron = Bron((verzoek, _) =>
            Json(verzoek.RequestUri!.Query.Contains("keyOffset", StringComparison.Ordinal) ? zonder : Pagina1));

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("not expanded", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    /// <summary>The caller cannot choose the host, and neither can a response: an absolute next link elsewhere is refused.</summary>
    [Fact]
    public async Task Een_volgende_pagina_op_een_andere_host_wordt_geweigerd()
    {
        var elders = Pagina1.Replace(
            "\"/agodi/onderwijsdoelen/opstap?limit=2&keyOffset=2026-05-22T07%253A19%253A35Z%2C92410\"",
            "\"https://elders.test/agodi/onderwijsdoelen/opstap?limit=2\"",
            StringComparison.Ordinal);
        var gevraagd = new List<string>();
        var bron = Bron((verzoek, _) =>
        {
            gevraagd.Add(verzoek.RequestUri!.AbsoluteUri);
            return Json(elders);
        });

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => bron.HaalOpAsync());

        Assert.Contains("leaves https://voorbeeld.test", fout.TechnischeOorzaak, StringComparison.Ordinal);
        Assert.Single(gevraagd);
    }

    private sealed class NepHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> antwoord)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            antwoord(request, cancellationToken);
    }

    private sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => nu;
    }
}
