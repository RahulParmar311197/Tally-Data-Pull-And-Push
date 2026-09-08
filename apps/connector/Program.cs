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

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
using var ws = new ClientWebSocket();
await ws.ConnectAsync(new Uri(apiWs), CancellationToken.None);
await Send(ws, new { type = "AUTH", deviceId, deviceName, token });

var buffer = new byte[16 * 1024];
var authOk = await ReceiveOne(ws, buffer);
Console.WriteLine($"API: {authOk}");

var tally = await ProbeTally(http, tallyUrl);
Console.WriteLine($"Tally reachable: {tally.Reachable}; company: {tally.Company ?? "not detected"}");
await Send(ws, new { type = "TALLY_COMPANY", company = tally.Company });

while (ws.State == WebSocketState.Open)
{
    await Task.Delay(TimeSpan.FromSeconds(10));
    await Send(ws, new { type = "HEARTBEAT" });
}

static string LoadDeviceId()
{
    var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "TallyRemoteConnector");
    Directory.CreateDirectory(dir);
    var path = Path.Combine(dir, "device-id.txt");
    if (File.Exists(path)) return File.ReadAllText(path).Trim();
    var id = Guid.NewGuid().ToString("N");
    File.WriteAllText(path, id);
    return id;
}

static async Task Send(ClientWebSocket ws, object value)
{
    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value));
    await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
}

static async Task<string> ReceiveOne(ClientWebSocket ws, byte[] buffer)
{
    var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
    return Encoding.UTF8.GetString(buffer, 0, result.Count);
}

static async Task<(bool Reachable, string? Company)> ProbeTally(HttpClient http, string url)
{
    const string xml = """
<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>TallyRemoteCurrentCompany</ID></HEADER>
<BODY><DESC><TDL><TDLMESSAGE>
<REPORT NAME="TallyRemoteCurrentCompany" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No"><FORMS>TallyRemoteCurrentCompany</FORMS></REPORT>
<FORM NAME="TallyRemoteCurrentCompany" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No"><PARTS>TallyRemoteCurrentCompany</PARTS></FORM>
<PART NAME="TallyRemoteCurrentCompany" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No"><LINES>TallyRemoteCurrentCompany</LINES></PART>
<LINE NAME="TallyRemoteCurrentCompany" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No"><FIELDS>TallyRemoteCurrentCompany</FIELDS></LINE>
<FIELD NAME="TallyRemoteCurrentCompany" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No"><SET>##SVCurrentCompany</SET></FIELD>
</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>
""";
    try
    {
        using var content = new StringContent(xml, Encoding.UTF8, "text/xml");
        using var response = await http.PostAsync(url, content);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) return (false, null);
        var company = Regex.Match(body, "<TALLYREMOTECURRENTCOMPANY[^>]*>(.*?)</TALLYREMOTECURRENTCOMPANY>", RegexOptions.IgnoreCase | RegexOptions.Singleline).Groups[1].Value.Trim();
        if (string.IsNullOrWhiteSpace(company)) company = Regex.Match(body, "<SERVERCOMPANYNAME>(.*?)</SERVERCOMPANYNAME>", RegexOptions.IgnoreCase | RegexOptions.Singleline).Groups[1].Value.Trim();
        return (true, string.IsNullOrWhiteSpace(company) ? null : WebUtility.HtmlDecode(company));
    }
    catch { return (false, null); }
}
