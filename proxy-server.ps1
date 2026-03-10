# Proxy for CORS - run: powershell -ExecutionPolicy Bypass -File proxy-server.ps1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Port = 3456
$Prefix = 'http://127.0.0.1:' + $Port + '/'

$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add($Prefix)
$Listener.Start()

Write-Host 'Proxy: ' $Prefix
Write-Host 'Open site via Live Server and submit the form. Exit: Ctrl+C'

while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $Request = $Context.Request
    $Response = $Context.Response

    if ($Request.HttpMethod -eq 'OPTIONS') {
        $Response.StatusCode = 204
        $Response.AddHeader('Access-Control-Allow-Origin', '*')
        $Response.AddHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        $Response.AddHeader('Access-Control-Allow-Headers', 'Content-Type, X-Forward-To')
        $Response.ContentLength64 = 0
        $Response.Close()
        continue
    }

    if ($Request.HttpMethod -ne 'POST') {
        $Response.StatusCode = 405
        $Response.ContentType = 'text/plain; charset=utf-8'
        $Buffer = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        $Response.ContentLength64 = $Buffer.Length
        $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
        $Response.Close()
        continue
    }

    $TargetUrl = $Request.Headers['X-Forward-To']
    if (-not $TargetUrl -or $TargetUrl -notlike 'https://*') {
        $Response.StatusCode = 400
        $Response.ContentType = 'application/json'
        $Body = '{"ok":false,"error":"Missing or invalid X-Forward-To header"}'
        $Buffer = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $Response.ContentLength64 = $Buffer.Length
        $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
        $Response.Close()
        continue
    }

    $ContentType = $Request.ContentType
    if (-not $ContentType) { $ContentType = 'application/x-www-form-urlencoded' }
    $Reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
    $RequestBody = $Reader.ReadToEnd()
    $Reader.Close()

    try {
        $ProxyParams = @{
            Uri             = $TargetUrl
            Method          = 'POST'
            Body            = $RequestBody
            ContentType     = $ContentType
            UseBasicParsing = $true
        }
        $ProxyResponse = Invoke-WebRequest @ProxyParams
        $Response.StatusCode = [int]$ProxyResponse.StatusCode
        $Response.ContentType = $ProxyResponse.Headers['Content-Type']
        if (-not $Response.ContentType) { $Response.ContentType = 'application/json' }
        $Response.AddHeader('Access-Control-Allow-Origin', '*')
        $ResponseBytes = $ProxyResponse.Content
        if ($ProxyResponse.Content -is [string]) {
            $ResponseBytes = [System.Text.Encoding]::UTF8.GetBytes($ProxyResponse.Content)
        }
        $Response.ContentLength64 = $ResponseBytes.Length
        $Response.OutputStream.Write($ResponseBytes, 0, $ResponseBytes.Length)
    }
    catch {
        $Response.StatusCode = 502
        $Response.ContentType = 'application/json'
        $Response.AddHeader('Access-Control-Allow-Origin', '*')
        $ErrMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $Reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                $ErrMsg = $Reader.ReadToEnd()
                $Reader.Close()
            } catch {}
        }
        $Body = (@{ ok = $false; error = $ErrMsg } | ConvertTo-Json -Compress)
        $Buffer = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $Response.ContentLength64 = $Buffer.Length
        $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
    }
    $Response.Close()
}
