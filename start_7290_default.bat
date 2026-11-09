@echo off
title Hypershot Arena Master Discord Bot
mode con: cols=100 lines=35 >nul 2>&1
color 0b

:: Go to the folder where this .bat file is located
cd /d "%~dp0"

:: Ensure Node is available in PATH
where node >nul 2>&1
if %errorlevel% neq 0 (
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"
)

:menu
cls
echo.
echo  ====================================================================================
echo   _   _                                                                              
echo  ^| ^| ^| ^|_   _ _ __   ___ _ __ ___^| ^|__   ___ ^| ^|_      /\                     
echo  ^| ^|_^| ^| ^| ^| ^| '_ \ / _ \ '__/ __^| '_ \ / _ \^| __^|    /  \   _ __ ___ _ __   __ _ 
echo  ^|  _  ^| ^|_^| ^| ^|_) ^|  __/ ^|  \__ \ ^| ^| ^| (_) ^| ^|_    / /\ \ ^| '__/ _ \ '_ \ / _` ^|
echo  ^|_^| ^|_^|\__, ^| .__/ \___^|_^|  ^|___/_^| ^|_^|\___/ \__^|  /_/  \_^|^|_^|  \___^|_^| ^|_^|\__,_^|
echo         ^|___/^|_^|                                                                      
echo.
echo  ====================================================================================
echo.
echo               [ STATUS: ]  Master Bot Initializing...
echo               [ SERVER: ]  Hypershot Arena FiveM ^& Discord
echo               [  DATE  : ]  %date%
echo.
echo  ------------------------------------------------------------------------------------
echo              ALL-IN-ONE BOT ^| TICKETS ^| WHITELIST ^| FIVEM ^| MODERATION
echo  ------------------------------------------------------------------------------------
echo.

REM Run the consolidated bot
node index.js

echo.
echo  ====================================================================================
echo          Bot has stopped or crashed. Restarting in 5 seconds...
echo  ====================================================================================
timeout /t 5 >nul
goto menu
