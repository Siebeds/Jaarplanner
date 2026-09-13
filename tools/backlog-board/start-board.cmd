@echo off
rem Start the local backlog board and open it in the browser. Double-click, or run from a terminal.
rem Stop it with Ctrl+C in the window that opens.
cd /d "%~dp0"
node server.mjs --open %*
