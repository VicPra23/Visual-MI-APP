@echo off
chcp 65001 >nul
title SERVIDOR XIAOMI VISUAL
cd /d "%~dp0"
echo Lanzando Servidor Seguro Xiaomi Visual...
powershell -NoProfile -ExecutionPolicy Bypass -File "servidor_xiaomi.ps1"
if %errorlevel% neq 0 pause
