using System.Net.Http;
using System.Text;
using System.Xml.Linq;

public sealed class TallyReader
{
    private readonly HttpClient http;
    private readonly string url;

    public TallyReader(HttpClient http, string url)
    {
        this.http = http;
        this.url = url;
    }

    public Task<string?> CurrentCompany() => ExecuteCurrentCompany();

    public async Task<object?> TrialBalance()
    {
        const string xml = """
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Trial Balance</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
""";

        var body = await Post(xml);
        var document = XDocument.Parse(body);
        var status = document.Root?.Descendants("STATUS").FirstOrDefault()?.Value.Trim();
        if (status == "0") throw new InvalidOperationException("TALLY_EXPORT_FAILED");

        var names = document.Descendants("DSPACCNAME")
            .Select(x => x.Element("DSPDISPNAME")?.Value.Trim() ?? string.Empty)
            .ToList();
        var balances = document.Descendants("DSPACCINFO").ToList();
        var rows = new List<object>(Math.Min(names.Count, balances.Count));

        for (var i = 0; i < Math.Min(names.Count, balances.Count); i++)
        {
            var balance = balances[i];
            rows.Add(new
            {
                name = names[i],
                debit = balance.Element("DSPCLDRAMT")?.Element("DSPCLDRAMTA")?.Value.Trim() ?? string.Empty,
                credit = balance.Element("DSPCLCRAMT")?.Element("DSPCLCRAMTA")?.Value.Trim() ?? string.Empty,
            });
        }

        return rows;
    }

    private async Task<string?> ExecuteCurrentCompany()
    {
        const string report = "TallyRemoteCurrentCompany";
        const string xml = """
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>TallyRemoteCurrentCompany</ID>
  </HEADER>
  <BODY>
    <DESC>
      <TDL>
        <TDLMESSAGE>
          <REPORT NAME="TallyRemoteCurrentCompany">
            <FORMS>TallyRemoteCurrentCompany</FORMS>
          </REPORT>
          <FORM NAME="TallyRemoteCurrentCompany">
            <PARTS>TallyRemoteCurrentCompany</PARTS>
          </FORM>
          <PART NAME="TallyRemoteCurrentCompany">
            <LINES>TallyRemoteCurrentCompany</LINES>
          </PART>
          <LINE NAME="TallyRemoteCurrentCompany">
            <FIELDS>TallyRemoteCurrentCompany</FIELDS>
          </LINE>
          <FIELD NAME="TallyRemoteCurrentCompany">
            <SET>##SVCurrentCompany</SET>
            <XMLTAG>TALLYREMOTECURRENTCOMPANY</XMLTAG>
          </FIELD>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
""";

        var body = await Post(xml);
        var document = XDocument.Parse(body);
        return document.Descendants("TALLYREMOTECURRENTCOMPANY").FirstOrDefault()?.Value.Trim();
    }

    private async Task<string> Post(string xml)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(xml, Encoding.UTF8, "text/xml")
        };
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseContentRead);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }
}
