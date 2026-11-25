@echo off
chcp 65001 >nul
title 主动健康系统快捷启动
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_web.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败，请把上面的错误信息发给开发人员。
  pause
)

