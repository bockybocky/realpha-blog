@echo off
rem Scheduled task RealphaBlogStats: refresh dist/stats.json every 10 minutes (see scripts/site_stats.mjs)
cd /d C:\Users\Charles\Projects\realpha-blog
"C:\Program Files\nodejs\node.exe" scripts\site_stats.mjs >> logs\site_stats.log 2>&1
