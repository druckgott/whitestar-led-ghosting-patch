# Small local web server for the patcher page. Windows PowerShell 5.1, no installation needed.
# Reachable only from this computer (localhost). Close the window to stop it.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path $PSScriptRoot).Path
$types = @{ ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8";
            ".md" = "text/plain; charset=utf-8"; ".svg" = "image/svg+xml"; ".png" = "image/png"; ".ico" = "image/x-icon" }

$listener = $null
foreach ($port in 8792..8799) {
    try {
        $l = New-Object System.Net.HttpListener
        $l.Prefixes.Add("http://localhost:$port/")
        $l.Start(); $listener = $l; break
    } catch { }
}
if (-not $listener) { Write-Host "No free port between 8792 and 8799."; Read-Host "Press Enter"; exit 1 }

$url = $listener.Prefixes | Select-Object -First 1
Write-Host ""
Write-Host "  Patcher running at $url"
Write-Host "  (only on this computer - close this window to stop)"
Write-Host ""
Start-Process $url

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
        $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
        if ($rel -eq "") { $rel = "index.html" }
        $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
        # serve only files inside this folder, only GET
        if ($ctx.Request.HttpMethod -ne "GET" -or -not $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar) -or -not (Test-Path $file -PathType Leaf)) {
            $res.StatusCode = 404
        } else {
            $ext = [IO.Path]::GetExtension($file).ToLower()
            $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
            $bytes = [IO.File]::ReadAllBytes($file)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch { $res.StatusCode = 500 }
    $res.Close()
}
