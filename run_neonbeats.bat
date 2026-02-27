@echo off
echo ==========================================
echo       Starting NeonBeats Environment
echo ==========================================

:: 1. Start PHP Server in a new window
echo Starting PHP Server...
start "NeonBeats Backend (PHP)" php -d upload_max_filesize=1024M -d post_max_size=1024M -S 127.0.0.1:8000 -t public

:: 2. Start NPM Watch in a new window
echo Starting Frontend Assets Builder...
start "NeonBeats Frontend (Webpack)" npm run watch

:: 3. Open the App in the default browser
echo Opening Browser...
timeout /t 4 >nul
start http://127.0.0.1:8000

echo.
echo ==========================================
echo   DONE!
echo   - Keep the two new windows open.
echo   - You can close this window now.
echo ==========================================
pause
