@echo off
title Serveur Local - Le Book Ultime
chcp 65001 > nul
clear
echo.
echo =======================================================================
echo   DEMARRAGE DU SERVEUR LOCAL POUR LE BOOK ULTIME
echo =======================================================================
echo.
echo Les navigateurs modernes bloquent certaines fonctionnalites (comme les 
echo Web Workers dans EluConnect) quand on double-clique directement sur index.html.
echo.
echo Ce script lance un mini-serveur web securise localement pour contourner 
echo cette restriction.
echo.

:: Vérifier si Python est disponible
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Python detecte. Lancement du serveur sur http://localhost:8000...
    start "" "http://localhost:8000"
    python -m http.server 8000
    goto end
)

:: Vérifier si Node/npx est disponible (alternative)
npx --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Node.js detecte. Lancement du serveur sur http://localhost:8080...
    start "" "http://localhost:8080"
    npx -y http-server -p 8080
    goto end
)

echo [ERREUR] Ni Python ni Node.js n'ont ete trouves dans le PATH de votre machine.
echo Pour faire fonctionner l'ensemble des modules en local, veuillez lancer un
echo serveur local ou heberger ce dossier sur GitHub Pages.
echo.
pause

:end
