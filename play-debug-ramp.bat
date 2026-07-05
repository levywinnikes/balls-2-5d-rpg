@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Balls 2.5D - Debug Ramp

echo.
echo  ========================================
echo   Balls 2.5D - Teste de Rampa
echo  ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo [ERRO] npm install falhou.
    pause
    exit /b 1
  )
)

echo [1/2] Gerando mapa debug_ramp...
call npm run generate:debug-ramp
if errorlevel 1 (
  echo [ERRO] Falha ao gerar mapa.
  pause
  exit /b 1
)

set "PLAY_URL=http://localhost:4000/?slice3d=1&map=debug_ramp&autostart=1&log=1&overlay=1"

echo [2/2] Verificando servidor dev (porta 4000)...
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:4000/' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo [OK] Servidor ja esta rodando.
  goto :open_browser
)

echo [INFO] Iniciando servidor dev em nova janela...
start "Balls 2.5D Dev Server" cmd /k "cd /d ""%~dp0"" && npm run web"

echo [INFO] Aguardando servidor...
set /a WAIT_TRIES=0
:wait_server
set /a WAIT_TRIES+=1
if %WAIT_TRIES% GTR 90 (
  echo [ERRO] Timeout.
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
echo  Mapa: debug_ramp (12x12, niveis 0 e +1)
echo  Spawn: sul da rampa (6,7). Ande norte para subir.
echo  Cobertura: L1(4..7, 3..4)
echo.
echo  Log ativo: overlay no canto superior direito
echo  Para baixar log: F12 Console, digite __physicsLogger.download()
echo.
pause
exit /b 0
