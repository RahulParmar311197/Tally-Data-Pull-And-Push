using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

var apiWs = Environment.GetEnvironmentVariable("TALLY_API_WS") ?? "ws://127.0.0.1:4000/ws/connector";
var tallyUrl = Environment.GetEnvironmentVariable("TALLY_URL") ?? "http://127.0.0.1:9000/";
var token = Environment.GetEnvironmentVariable("CONNECTOR_TOKEN") ?? "dev-only-change-me";
var deviceName = Environment.GetEnvironmentVariable("CONNECTOR_NAME") ?? Environment.MachineName;
var deviceId = LoadDeviceId();
Console.WriteLine($"Tally connector {deviceId} -> {apiWs}");

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
var reader = new TallyReader(http, tallyUrl);

while (true)
{
    using var ws = new ClientWebSocket();
    try
    {
        await ws.ConnectAsync(new Uri(apiWs), CancellationToken.None);
        await Send(ws, new { type = "AUTH", deviceId, deviceName, token });
        var authOk = await ReceiveOne(ws, new byte[16 * 1024]);
        Console.WriteLine($"API: {authOk}");
        if (!authOk.Contains("AUTH_OK", StringComparison.Ordinal)) throw new WebSocketException("Connector authentication failed");

        var tally = await reader.CurrentCompany();
        Console.WriteLine($"Tally company: {tally ?? "not detected"}");
        await Send(ws, new { type = "TALLY_COMPANY", company = tally });

        var buffer = new byte[32 * 1024];
        var heartbeat = DateTime.UtcNow;
        while (ws.State == WebSocketState.Open)
        {
            if (DateTime.UtcNow - heartbeat >= TimeSpan.FromSeconds(10))
            {
                await Send(ws, new { type = "HEARTBEAT" });
                heartbeat = DateTime.UtcNow;
            }
            if (ws.State != WebSocketState.Open) break;
            var receiveTask = ws.ReceiveAsync(buffer, CancellationToken.None);
            var completed = await Task.WhenAny(receiveTask, Task.Delay(1000));
            if (completed != receiveTask) continue;
            var result = await receiveTask;
            if (result.MessageType == WebSocketMessageType.Close) break;
            var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            await HandleApiMessage(ws, message, reader);
        }
    }
    catch (Exception ex) { Console.WriteLine($"Connector error: {ex.Message}"); }
    await Task.Delay(TimeSpan.FromSeconds(5));
}

static async Task HandleApiMessage(ClientWebSocket ws, string message, TallyReader reader)
{
    try
    {
        using var doc = JsonDocument.Parse(message);
        if (!doc.RootElement.TryGetProperty("type", out var type) || type.GetString() != "TALLY_READ") return;
        var requestId = doc.RootElement.GetProperty("requestId").GetString() ?? "";
        var operation = doc.RootElement.GetProperty("operation").GetString() ?? "";
        string? data = operation switch
        {
            "current_company" => await reader.CurrentCompany(),
            "trial_balance" => await reader.TrialBalance(),
            _ => null,
        };
        var ok = operation is "current_company" or "trial_balance" && data is not null;
        await Send(ws, new { type = "TALLY_READ_RESULT", requestId, operation, ok, data, error = ok ? null : "TALLY_READ_FAILED" });
    }
    catch { }
}

static string LoadDeviceId()
{
    var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "TallyRemoteConnector");
    Directory.CreateDirectory(dir);
    var path = Path.Combine(dir, "device-id.txt");
    if (File.Exists(path)) return File.ReadAllText(path).Trim();
    var id = Guid.NewGuid().ToString("N"); File.WriteAllText(path, id); return id;
}

static async Task Send(ClientWebSocket ws, object value)
{
    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value));
    await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
}

static async Task<string> ReceiveOne(ClientWebSocket ws, byte[] buffer)
{
    using var stream = new MemoryStream(); WebSocketReceiveResult result;
    do { result = await ws.ReceiveAsync(buffer, CancellationToken.None); if (result.MessageType == WebSocketMessageType.Close) throw new WebSocketException("API closed connection"); stream.Write(buffer, 0, result.Count); } while (!result.EndOfMessage);
    return Encoding.UTF8.GetString(stream.ToArray());
}

public sealed class TallyReader
{
    private readonly HttpClient http; private readonly string url;
    public TallyReader(HttpClient http, string url) { this.http = http; this.url = url; }
    public Task<string?> CurrentCompany() => Execute("TallyRemoteCurrentCompany", "##SVCurrentCompany", "TALLYREMOTECURRENTCOMPANY");
    public Task<string?> TrialBalance() => Execute("TallyRemoteTrialBalance", "$$SysName:Name", "DSPACCNAME");
    private async Task<string?> Execute(string report, string expression, string tag)
    {
        var xml = $"""
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>{report}</ID></HEADER><BODY><DESC><TDL><TDLMESSAGE>
<REPORT NAME="{report}" ISMODIFY="No" ISFIXED="No"><FORMS>{report}</FORMS></REPORT><FORM NAME="{report}" ISMODIFY="No" ISFIXED="No"><PARTS>{report}</PARTS></FORM><PART NAME="{report}" ISMODIFY="No" ISFIXED="No"><LINES>{report}</LINES></PART><LINE NAME="{report}" ISMODIFY="No" ISFIXED="No"><FIELDS>{report}</FIELDS></LINE><FIELD NAME="{report}" ISMODIFY="No" ISFIXED="No"><SET>{expression}</SET></FIELD>
</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>
""";
        using var response = await http.PostAsync(url, new StringContent(xml, Encoding.UTF8, "text/xml")); response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        var match = Regex.Match(body, $"<{Regex.Escape(tag)}[^>]*>(.*?)</{Regex.Escape(tag)}>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? WebUtility.HtmlDecode(match.Groups[1].Value.Trim()) : null;
    }
}
