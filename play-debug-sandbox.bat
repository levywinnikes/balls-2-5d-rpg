@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Balls 2.5D - Debug Sandbox

echo.
echo  ========================================
echo   Balls 2.5D - Debug Sandbox
echo  ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Instale Node.js: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Primeira vez: instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo [ERRO] npm install falhou.
    pause
    exit /b 1
  )
)

echo [1/3] Atualizando mapa debug_sandbox...
call npm run generate:debug-sandbox
if errorlevel 1 (
  echo [ERRO] Falha ao gerar mapa.
  pause
  exit /b 1
)

set "PLAY_URL=http://localhost:4000/?map=debug_sandbox&autostart=1"

echo [2/3] Verificando servidor dev (porta 4000)...
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:4000/' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo [OK] Servidor ja esta rodando.
  goto :open_browser
)

echo [INFO] Iniciando servidor dev em nova janela...
start "Balls 2.5D Dev Server" cmd /k "cd /d ""%~dp0"" && npm run web"

echo [INFO] Aguardando servidor ficar pronto...
set /a WAIT_TRIES=0
:wait_server
set /a WAIT_TRIES+=1
if %WAIT_TRIES% GTR 90 (
  echo [ERRO] Timeout esperando http://localhost:4000
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:4000/' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto :wait_server
)

:open_browser
echo [3/3] Abrindo jogo no navegador...
start "" "%PLAY_URL%"

echo.
echo  Pronto! Mapa: debug_sandbox ^(todos itens + inimigos^)
echo  URL: %PLAY_URL%
echo.
echo  Mantenha a janela "Dev Server" aberta enquanto joga.
echo  Para fechar: feche o navegador e a janela do servidor.
echo.
pause
exit /b 0
