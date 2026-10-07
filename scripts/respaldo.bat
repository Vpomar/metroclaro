@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ---------------------------------------------------------------
rem  Respaldo completo: estructura + datos.
rem
rem  La estructura sola no sirve para recuperar nada: hay que tener
rem  las dos cosas. Deja todo en una carpeta con la fecha.
rem
rem  Requiere la CLI de Supabase instalada y el proyecto vinculado.
rem ---------------------------------------------------------------

rem Se ejecuta desde la raíz del proyecto, aunque viva en scripts\
cd /d "%~dp0.."

for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set FECHA=%%c-%%b-%%a
set CARPETA=respaldos\%FECHA%

if exist "%CARPETA%" (
  echo Ya existe la carpeta %CARPETA%. Se van a sobrescribir los archivos.
  echo.
)
mkdir "%CARPETA%" 2>nul

echo.
echo ==========================================================
echo   RESPALDO DE LA BASE  -  %FECHA%
echo ==========================================================
echo.
echo Te va a pedir la contrasena de la base en cada paso.
echo Es la que pusiste al crear el proyecto en Supabase.
echo.

echo [1 de 3] Estructura: tablas, politicas, funciones y vistas...
supabase db dump -f "%CARPETA%\1-estructura.sql"
if errorlevel 1 goto fallo

echo.
echo [2 de 3] Datos: todo lo cargado...
supabase db dump -f "%CARPETA%\2-datos.sql" --data-only
if errorlevel 1 goto fallo

echo.
echo [3 de 3] Roles y permisos...
supabase db dump -f "%CARPETA%\3-roles.sql" --role-only
if errorlevel 1 goto fallo

echo.
echo ==========================================================
echo   LISTO
echo ==========================================================
echo.
echo Quedo en la carpeta: %CARPETA%
echo.
dir /b "%CARPETA%"
echo.
echo IMPORTANTE
echo   - Copiala a Drive o a un disco externo. En la computadora
echo     no es un respaldo: es la misma copia.
echo   - Las fotos y los documentos NO estan aca. Esos se bajan
echo     desde la pestana Usuarios, con "Descargar fotos".
echo   - Para restaurar: primero 1-estructura, despues 2-datos.
echo.
pause
exit /b 0

:fallo
echo.
echo ==========================================================
echo   FALLO EL RESPALDO
echo ==========================================================
echo.
echo Revisa que:
echo   - La CLI este instalada:  supabase --version
echo   - El proyecto este vinculado:  supabase link
echo   - La contrasena sea la correcta
echo.
pause
exit /b 1
