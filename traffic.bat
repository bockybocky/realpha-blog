@echo off
REM Blog traffic report - double click to run.
REM Data source: logs\visits-*.jsonl written by serve_dist.mjs
chcp 65001 >nul
cd /d "%~dp0"
python scripts\visits_report.py --days 7
echo.
echo ----------------------------------------------------
echo   30 days : python scripts\visits_report.py --days 30
echo   with bots : python scripts\visits_report.py --bots
echo ----------------------------------------------------
pause
