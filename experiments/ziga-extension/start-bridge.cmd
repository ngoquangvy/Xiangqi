@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" native-server.mjs
  ) else (
    echo Khong tim thay Node.js. Hay cai Node.js de chay bridge.
  )
) else (
  node native-server.mjs
)
pause
