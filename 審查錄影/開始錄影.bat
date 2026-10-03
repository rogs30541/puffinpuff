@echo off
chcp 65001 >nul
setlocal

REM ============================================
REM  PuffinPuff App Review 螢幕錄影工具
REM  用專案內建 ffmpeg 錄整個螢幕（15fps，檔案小）
REM  停止方式：回到這個黑色視窗，按一下 q
REM ============================================

set "FFMPEG=D:\claude\軟體開發\PuffinPuff 海鸚泡芙\node_modules\ffmpeg-static\ffmpeg.exe"
set "OUTDIR=D:\claude\軟體開發\PuffinPuff 海鸚泡芙\審查錄影"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
set "OUT=%OUTDIR%\demo_raw_%TS%.mp4"

echo.
echo  ============================================
echo   3 秒後開始錄影整個螢幕...
echo   錄完請回到這個視窗，按一下  q  停止
echo  ============================================
echo.
timeout /t 3 /nobreak >nul

"%FFMPEG%" -f gdigrab -framerate 15 -i desktop -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p "%OUT%"

echo.
echo  錄影已儲存：
echo  %OUT%
echo.
pause
