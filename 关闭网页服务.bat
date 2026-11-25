@echo off
chcp 65001 >nul
title 关闭主动健康系统
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop_web.ps1"
if errorlevel 1 pause

