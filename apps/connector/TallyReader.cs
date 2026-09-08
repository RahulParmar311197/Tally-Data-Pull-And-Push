using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;

public sealed class TallyReader
{
    private readonly HttpClient http;
    private readonly string url;

    public TallyReader(HttpClient http, string url)
    {
        this.http = http;
        this.url = url;
    }

    public Task<string?> CurrentCompany() => Execute("TallyRemoteCurrentCompany", "##SVCurrentCompany", "TALLYREMOTECURRENTCOMPANY");

    public Task<string?> TrialBalance() => Execute("TallyRemoteTrialBalance", "$$SysName:Name", "DSPACCNAME");

    private async Task<string?> Execute(string report, string expression, string tag)
    {
        var xml = $"""
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>{report}</ID></HEADER><BODY><DESC><TDL><TDLMESSAGE>
<REPORT NAME="{report}" ISMODIFY="No" ISFIXED="No"><FORMS>{report}</FORMS></REPORT>
<FORM NAME="{report}" ISMODIFY="No" ISFIXED="No"><PARTS>{report}</PARTS></FORM>
<PART NAME="{report}" ISMODIFY="No" ISFIXED="No"><LINES>{report}</LINES></PART>
<LINE NAME="{report}" ISMODIFY="No" ISFIXED="No"><FIELDS>{report}</FIELDS></LINE>
<FIELD NAME="{report}" ISMODIFY="No" ISFIXED="No"><SET>{expression}</SET></FIELD>
</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>
""";
        using var response = await http.PostAsync(url, new StringContent(xml, Encoding.UTF8, "text/xml"));
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        var match = Regex.Match(body, $"<{Regex.Escape(tag)}[^>]*>(.*?)</{Regex.Escape(tag)}>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }
}
