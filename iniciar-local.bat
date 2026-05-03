@echo off
REM ============================================
REM OrçaObras - Script para iniciar localmente
REM ============================================

echo.
echo ================================
echo   OrçaObras - Sistema de Orçamentos
echo ================================
echo.

REM Verificar se o Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python não encontrado!
    echo Por favor, instale o Python 3.x
    pause
    exit /b 1
)

echo Iniciando servidor local...
echo.
echo Acesse: http://localhost:8080
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

REM Iniciar servidor na porta 8080
python -m http.server 8080

pause