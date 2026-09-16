using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-060: a thema's emoji survives a round trip through the API and the real <c>themas.Icoon</c> column, can be
/// changed and cleared, and plain text is refused with the teacher's sentence.
/// <para>
/// <b>Against real PostgreSQL</b> because the column is a bounded <c>varchar</c> and an emoji is several UTF-16 units:
/// the claim is that a family or a flag fits and comes back byte for byte.
/// </para>
/// </summary>
public sealed class ThemaIcoonEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("themaicoon");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Een_emoji_wordt_bewaard_gewijzigd_en_weer_leeg_gemaakt()
    {
        var client = _factory.CreateClient();

        using var gemaakt = await client.PostAsJsonAsync("/api/themas", new { naam = "Gezin", duurWeken = 4, icoon = "👨‍👩‍👧" });
        Assert.Equal(HttpStatusCode.Created, gemaakt.StatusCode);
        var thema = await gemaakt.Content.ReadFromJsonAsync<JsonElement>();
        var themaId = thema.GetProperty("id").GetGuid();
        Assert.Equal("👨‍👩‍👧", thema.GetProperty("icoon").GetString());

        var bibliotheek = await client.GetFromJsonAsync<JsonElement>("/api/themas/bibliotheek");
        var item = bibliotheek.EnumerateArray().Single(t => t.GetProperty("id").GetGuid() == themaId);
        Assert.Equal("👨‍👩‍👧", item.GetProperty("icoon").GetString());

        using var gewijzigd = await client.PutAsJsonAsync($"/api/themas/{themaId}", new { naam = "Gezin", duurWeken = 4, icoon = "🇧🇪" });
        Assert.Equal(HttpStatusCode.OK, gewijzigd.StatusCode);
        await using (var context = _db.MaakContext())
        {
            Assert.Equal("🇧🇪", (await context.Themas.SingleAsync(t => t.Id == themaId)).Icoon);
        }

        using var geleegd = await client.PutAsJsonAsync($"/api/themas/{themaId}", new { naam = "Gezin", duurWeken = 4, icoon = (string?)null });
        Assert.Equal(HttpStatusCode.OK, geleegd.StatusCode);
        var zonder = await client.GetFromJsonAsync<JsonElement>($"/api/themas/{themaId}");
        Assert.Equal(JsonValueKind.Null, zonder.GetProperty("icoon").ValueKind);
    }

    [PostgresFact]
    public async Task Tekst_als_icoon_wordt_geweigerd_met_een_zin_voor_de_leerkracht()
    {
        var client = _factory.CreateClient();

        using var geweigerd = await client.PostAsJsonAsync("/api/themas", new { naam = "Herfst", duurWeken = 4, icoon = "herfst" });

        Assert.Equal(HttpStatusCode.BadRequest, geweigerd.StatusCode);
        var probleem = await geweigerd.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Kies één emoji als icoon van het thema, of laat het vakje leeg.", probleem.GetProperty("detail").GetString());
        await using var context = _db.MaakContext();
        Assert.False(await context.Themas.AnyAsync(t => t.Naam == "Herfst"));
    }
}
