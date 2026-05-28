@echo off
echo.
echo  Control Finanzas - Ok Web SAS
echo  ==============================
echo.

if not exist .env (
    echo  ERROR: No existe el archivo .env
    echo  Copia .env.example a .env y configura tus datos.
    pause
    exit /b 1
)

if not exist .venv (
    echo  Creando entorno virtual...
    python -m venv .venv
)

call .venv\Scripts\activate

echo  Instalando dependencias...
pip install -r requirements.txt -q

echo  Iniciando servidor en http://localhost:8080
echo  Presiona Ctrl+C para detener.
echo.

uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
