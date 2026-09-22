@echo off
rem RealphaBlogWeeklyDigest: every Monday, merge last week's podcast notes into one weekly digest (zh + en).
rem Idempotent: skips a week whose digest file already exists.
set PYTHONUTF8=1
cd /d C:\Users\Charles\projects\realpha-blog
python scripts\weekly_digest.py >> scripts\logs\weekly_digest_cron.log 2>&1
exit /b %ERRORLEVEL%
