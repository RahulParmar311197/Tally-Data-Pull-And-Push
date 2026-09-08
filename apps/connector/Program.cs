using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

var apiWs = Environment.GetEnvironmentVariable("TALLY_API_WS") ?? "ws://127.0.0.1:4000/ws/connector";
var tallyUrl = Environment.GetEnvironmentVariable("TALLY_URL") ?? "http://127.0.0.1:9000/";
var credential = Environment.GetEnvironmentVariable("CONNECTOR_CREDENTIAL") ?? "";
var deviceName = Environment.GetEnvironmentVariable("CONNECTOR_NAME") ?? Environment.MachineName;
var deviceId = LoadDeviceId();
Console.WriteLine($"Tally connector {deviceId} -> {apiWs}");

if (string.IsNullOrWhiteSpace(credential))
{
    Console.Error.WriteLine("CONNECTOR_CREDENTIAL is required. Register this device with the API and set the returned credential as a user environment variable.");
    return;
}

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
var reader = new TallyReader(http, tallyUrl);

while (true)
{
    using var ws = new ClientWebSocket();
    try
    {
        await ws.ConnectAsync(new Uri(apiWs), CancellationToken.None);
        await Send(ws, new { type = "AUTH", deviceId, deviceName, token = credential });
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
            var receiveTask = ReceiveOne(ws, buffer);
            var completed = await Task.WhenAny(receiveTask, Task.Delay(1000));
            if (completed != receiveTask) continue;
            var message = await receiveTask;
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
        if (operation is not ("current_company" or "trial_balance"))
        {
            await Send(ws, new { type = "TALLY_READ_RESULT", requestId, operation = "current_company", ok = false, error = "UNSUPPORTED_OPERATION" });
            return;
        }

        object? data = operation switch
        {
            "current_company" => await reader.CurrentCompany(),
            "trial_balance" => await reader.TrialBalance(),
            _ => null,
        };
        var ok = data is not null;
        await Send(ws, new { type = "TALLY_READ_RESULT", requestId, operation, ok, data, error = ok ? null : "TALLY_READ_FAILED" });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Tally read error: {ex.Message}");
        try
        {
            using var doc = JsonDocument.Parse(message);
            var requestId = doc.RootElement.TryGetProperty("requestId", out var id) ? id.GetString() ?? "" : "";
            var operation = doc.RootElement.TryGetProperty("operation", out var op) ? op.GetString() ?? "" : "";
            if (!string.IsNullOrWhiteSpace(requestId))
                await Send(ws, new { type = "TALLY_READ_RESULT", requestId, operation, ok = false, error = ex.Message });
        }
        catch { }
    }
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
    using var stream = new MemoryStream();
    WebSocketReceiveResult result;
    do
    {
        result = await ws.ReceiveAsync(buffer, CancellationToken.None);
        if (result.MessageType == WebSocketMessageType.Close) throw new WebSocketException("API closed connection");
        stream.Write(buffer, 0, result.Count);
    } while (!result.EndOfMessage);
    return Encoding.UTF8.GetString(stream.ToArray());
}
