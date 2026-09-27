@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ============================================================
echo   Publicando o Canal de Denuncias na Vercel
echo  ============================================================
echo.
echo  Na primeira vez:
echo   - o navegador abre para voce entrar na sua conta da Vercel;
echo   - responda as perguntas conforme o LEIA-ME-PUBLICAR.txt.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  ERRO: o Node.js nao esta instalado neste computador.
  echo  Instale em https://nodejs.org ^(versao LTS^) e rode de novo.
  echo.
  pause
  exit /b 1
)
call npx --yes vercel@latest --prod
echo.
echo  Se apareceu "Production: https://...", o site esta no ar.
echo  Anote esse endereco: ele vai no painel ^(Membros ^> Endereco do site^).
echo.
pause
