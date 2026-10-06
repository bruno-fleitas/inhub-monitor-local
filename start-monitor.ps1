$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = $null
$selectedPort = $null

foreach ($port in 8080..8090) {
    try {
        $candidate = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        $candidate.Start()
        $listener = $candidate
        $selectedPort = $port
        break
    } catch {
        if ($candidate) { try { $candidate.Stop() } catch {} }
    }
}

if (-not $listener) { throw "No encontre un puerto libre entre 8080 y 8090." }

$url = "http://127.0.0.1:$selectedPort/"
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "        INHUB MONITOR LOCAL" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitor iniciado en:" -ForegroundColor Green
Write-Host $url -ForegroundColor Yellow
Write-Host ""
Write-Host "No cierres esta ventana mientras uses el monitor." -ForegroundColor DarkGray
Write-Host "Para detenerlo, cerra esta ventana o presiona Ctrl+C." -ForegroundColor DarkGray
Write-Host ""

Start-Process $url

function Get-ContentType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        ".html" { "text/html; charset=utf-8" }
        ".htm"  { "text/html; charset=utf-8" }
        ".js"   { "text/javascript; charset=utf-8" }
        ".mjs"  { "text/javascript; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".svg"  { "image/svg+xml" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".gif"  { "image/gif" }
        ".ico"  { "image/x-icon" }
        ".woff" { "font/woff" }
        ".woff2"{ "font/woff2" }
        default { "application/octet-stream" }
    }
}

function Send-Response(
    [System.Net.Sockets.NetworkStream]$stream,
    [int]$statusCode,
    [string]$statusText,
    [byte[]]$body,
    [string]$contentType,
    [long]$reportedLength = -1
) {
    if ($reportedLength -lt 0) { $reportedLength = $body.Length }
    $headers = "HTTP/1.1 $statusCode $statusText" + [char]13 + [char]10 +
               "Content-Type: $contentType" + [char]13 + [char]10 +
               "Content-Length: $reportedLength" + [char]13 + [char]10 +
               "Cache-Control: no-store" + [char]13 + [char]10 +
               "Connection: close" + [char]13 + [char]10 + [char]13 + [char]10
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                $client.Close()
                continue
            }

            while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") {}

            $parts = $requestLine.Split(" ")
            if ($parts.Length -lt 2) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
                Send-Response $stream 400 "Bad Request" $body "text/plain; charset=utf-8"
                $client.Close()
                continue
            }

            $method = $parts[0]
            $rawPath = $parts[1].Split("?")[0]

            if ($method -ne "GET" -and $method -ne "HEAD") {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                Send-Response $stream 405 "Method Not Allowed" $body "text/plain; charset=utf-8"
                $client.Close()
                continue
            }

            $decodedPath = [System.Uri]::UnescapeDataString($rawPath)
            if ($decodedPath -eq "/") { $decodedPath = "/index.html" }

            $relativePath = $decodedPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
            $rootFull = [System.IO.Path]::GetFullPath($root + [System.IO.Path]::DirectorySeparatorChar)

            if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
                Send-Response $stream 403 "Forbidden" $body "text/plain; charset=utf-8"
                $client.Close()
                continue
            }

            if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                Send-Response $stream 404 "Not Found" $body "text/plain; charset=utf-8"
                $client.Close()
                continue
            }

            $fileInfo = Get-Item -LiteralPath $fullPath
            if ($method -eq "HEAD") {
                $bytes = [byte[]]::new(0)
                Send-Response $stream 200 "OK" $bytes (Get-ContentType $fullPath) $fileInfo.Length
            } else {
                $bytes = [System.IO.File]::ReadAllBytes($fullPath)
                Send-Response $stream 200 "OK" $bytes (Get-ContentType $fullPath)
            }
        } catch {
            try {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Server Error")
                Send-Response $stream 500 "Internal Server Error" $body "text/plain; charset=utf-8"
            } catch {}
        } finally {
            try { $client.Close() } catch {}
        }
    }
} finally {
    if ($listener) { $listener.Stop() }
}
