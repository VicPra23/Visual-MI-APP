# Servidor local seguro y ultra-ligero para Xiaomi Visual
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ports = @(8080, 8081, 8082, 8083, 8084, 8085, 3000, 5000, 8000)
$listener = $null
$port = $null

foreach ($p in $ports) {
    $candidate = New-Object System.Net.HttpListener
    try {
        $candidate.Prefixes.Add("http://localhost:$p/")
        $candidate.Start()
        $listener = $candidate
        $port = $p
        break
    } catch {
        if ($candidate) {
            try { $candidate.Close() } catch {}
        }
    }
}

if (-not $listener -or -not $listener.IsListening) {
    Write-Host "❌ Error: No se pudo abrir ningún puerto local entre 8080 y 8085." -ForegroundColor Red
    Write-Host "Por favor, cierra cualquier otro programa o servidor web en ejecución." -ForegroundColor Yellow
    exit 1
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🚀 SERVIDOR XIAOMI VISUAL ACTIVO" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
$targetUrl = "http://localhost:$port/index.html"
Write-Host "✅ ¡SERVICIO ACTIVO EN EL PUERTO $port!" -ForegroundColor Green
Write-Host "🌐 URL: $targetUrl" -ForegroundColor Yellow
Write-Host "⛔ NO CIERRES ESTA VENTANA MIENTRAS USES LA APLICACIÓN." -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Cyan

# Lanzar el navegador predeterminado
Start-Process $targetUrl

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) { $path = "/index.html" }
        
        $cleanPath = $path.TrimStart('/')
        $filePath = Join-Path -Path (Get-Location) -ChildPath $cleanPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                ".ttf"  { $response.ContentType = "font/ttf" }
                ".woff" { $response.ContentType = "font/woff" }
                ".woff2"{ $response.ContentType = "font/woff2" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 200 OK - $path" -ForegroundColor Gray
        } else {
            $response.StatusCode = 404
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 404 Not Found - $path" -ForegroundColor Red
        }
        $response.Close()
    } catch {
        Write-Host "Aviso en petición: $_" -ForegroundColor DarkGray
    }
}
