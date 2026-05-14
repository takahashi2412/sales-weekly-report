Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxPath = "c:\Users\takahashikei\OneDrive - 株式会社Rush up\デスクトップ\Rushup営業プラットフォーム_簡易仕様書_1.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$docXml = $zip.GetEntry('word/document.xml')
$stream = $docXml.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()
$xml = $xml -replace '<[^>]*>', ''
Write-Output $xml
