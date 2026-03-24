@echo off
setlocal enabledelayedexpansion

echo.
echo  ============================================
echo   PCSX2-MCP Setup
echo   Configure AI debugger for PCSX2
echo  ============================================
echo.

:: ── Check Node.js ──────────────────────────────────

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org/
    echo  Then run this script again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% found

:: ── Get paths ──────────────────────────────────────

set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "MCP_SERVER=%SCRIPT_DIR%\pcsx2-mcp-server\dist\index.js"
set "MCP_SERVER_ESC=%MCP_SERVER:\=\\%"

if not exist "%MCP_SERVER%" (
    echo  [ERROR] MCP server not found at:
    echo    %MCP_SERVER%
    echo.
    echo  Make sure you extracted the full zip.
    pause
    exit /b 1
)

echo  [OK] MCP server found

:: ── Write MCP config ───────────────────────────────

set "CONFIG_DIR=%USERPROFILE%\.gemini\antigravity"
set "CONFIG_FILE=%CONFIG_DIR%\mcp_config.json"

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: Check if config already exists
if exist "%CONFIG_FILE%" (
    echo.
    echo  [WARNING] MCP config already exists at:
    echo    %CONFIG_FILE%
    echo.
    echo  Add this to your existing mcpServers:
    echo.
    echo    "pcsx2": {
    echo      "command": "node",
    echo      "args": ["%MCP_SERVER_ESC%"],
    echo      "disabled": false
    echo    }
    echo.
    echo  Or press any key to OVERWRITE with pcsx2-only config...
    pause >nul
)

:: Write config
(
echo {
echo   "mcpServers": {
echo     "pcsx2": {
echo       "command": "node",
echo       "args": ["%MCP_SERVER_ESC%"],
echo       "disabled": false
echo     }
echo   }
echo }
) > "%CONFIG_FILE%"

echo  [OK] Config written to %CONFIG_FILE%

:: ── Done ───────────────────────────────────────────

echo.
echo  ============================================
echo   Setup complete!
echo  ============================================
echo.
echo  Next steps:
echo    1. Launch pcsx2-qt.exe from this folder
echo    2. Load a PS2 game (ISO)
echo    3. Restart your AI assistant (Antigravity/Claude)
echo    4. Ask: "Connect to PCSX2 and show threads"
echo.
echo  The emulator will show:
echo    [DebugServer] Listening on 127.0.0.1:21512
echo.
pause
