@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" build.mjs
  ) else (
    echo Khong tim thay Node.js. Hay cai Node.js 22.12 tro len.
    pause
    exit /b 1
  )
) else (
  node build.mjs
)
if errorlevel 1 (
  echo Khong ap dung duoc cau hinh. Hay kiem tra loi settings.json o tren.
  pause
  exit /b 1
)
echo Da build. Reload extension va tai lai tab Ziga.
echo Neu sua engine hoac CPU: dung bridge cu va chay lai start-bridge.cmd.
pause
