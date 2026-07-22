@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo DWG Sketch PWA - may chu thu nghiem localhost:8080
echo ============================================================
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080/index.html
  py -m http.server 8080
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080/index.html
  python -m http.server 8080
  goto :eof
)
echo Khong tim thay Python. Hay cai Python hoac dua thu muc nay len may chu HTTPS.
pause
