# Rebuild the packaged PNG icons from the same vector geometry as icons/logo.svg.
Add-Type -AssemblyName System.Drawing
$iconDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\icons'))
foreach ($size in @(16, 32, 48, 128)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($size / 64.0, $size / 64.0)
    $green = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1db954'))
    $dark = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#101713'))
    $rounded = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rounded.AddArc(0, 0, 36, 36, 180, 90)
    $rounded.AddArc(28, 0, 36, 36, 270, 90)
    $rounded.AddArc(28, 28, 36, 36, 0, 90)
    $rounded.AddArc(0, 28, 36, 36, 90, 90)
    $rounded.CloseFigure()
    $graphics.FillPath($green, $rounded)
    $graphics.FillEllipse($dark, 10, 10, 44, 44)
    $groove = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 29, 185, 84), 1.5)
    $graphics.DrawEllipse($groove, 16, 16, 32, 32)
    $points = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(27, 22), [System.Drawing.PointF]::new(43, 32), [System.Drawing.PointF]::new(27, 42))
    $graphics.FillPolygon($green, $points)
    $line = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#1db954'), 2)
    $line.StartCap = $line.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($line, 17, 47, 28, 47)
    $bitmap.Save((Join-Path $iconDirectory "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $line.Dispose(); $groove.Dispose(); $rounded.Dispose(); $green.Dispose(); $dark.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
