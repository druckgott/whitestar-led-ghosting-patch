@echo off
rem Whitestar LED ghosting patch: double-click to start.
rem Starts a small web server on this computer only (localhost) and opens the patcher
rem with its description in your browser. Nothing is installed, nothing is uploaded.
rem Close the black window to stop.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 pause
