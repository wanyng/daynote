$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$directory = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$source = [Drawing.Image]::FromFile((Join-Path $root 'assets\cat.png'))
$sizes = @(16,24,32,48,64,128,256)
$images = New-Object 'System.Collections.Generic.List[byte[]]'
try {
  foreach ($size in $sizes) {
    $bitmap = New-Object Drawing.Bitmap($size,$size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $stream = New-Object IO.MemoryStream
    try {
      $graphics.Clear([Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $inset = [Math]::Max(1,[Math]::Round($size * 0.025))
      $scale = ($size - 2 * $inset) / [Math]::Max($source.Width,$source.Height)
      $width = [int][Math]::Round($source.Width * $scale)
      $height = [int][Math]::Round($source.Height * $scale)
      $graphics.DrawImage($source,[int](($size-$width)/2),[int](($size-$height)/2),$width,$height)
      $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
      $images.Add($stream.ToArray())
      if ($size -eq 256) { [IO.File]::WriteAllBytes((Join-Path $directory 'icon.png'),$stream.ToArray()) }
    } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
  }
  $file = [IO.File]::Create((Join-Path $directory 'icon.ico'))
  $writer = New-Object IO.BinaryWriter($file)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($index = 0; $index -lt $sizes.Count; $index++) {
      $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
      $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
      $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$images[$index].Length); $writer.Write([uint32]$offset)
      $offset += $images[$index].Length
    }
    foreach ($imageBytes in $images) { $writer.Write($imageBytes) }
  } finally { $writer.Dispose(); $file.Dispose() }
} finally { $source.Dispose() }
Write-Host 'Generated cat icon in 7 sizes.'
