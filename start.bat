@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r requirements.txt

echo.
echo ============================================
echo   منصة الباحث للدكتوراه - Scholar Hub
echo   افتح المتصفح على: http://127.0.0.1:8088
echo ============================================
echo.

uvicorn app.main:app --host 127.0.0.1 --port 8088 --reload
pause
