@echo off
rem Launch two networked ContrAlto instances (Alto addresses 42 and 43 octal).
rem Each auto-boots the Alto and types "trek" for you (boot-trek.script).
rem The instances share a virtual Ethernet via UDP broadcasts on port 42424.
cd /d "%~dp0"
start "Alto 42 (Trek A)" Contralto.exe -config trekA.cfg -script boot-trek.script
start "Alto 43 (Trek B)" Contralto.exe -config trekB.cfg -script boot-trek.script
