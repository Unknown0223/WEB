@echo off

REM Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python is not installed or not in PATH. Please install Python 3.7 or higher.
    echo Download Python from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Creating virtual environment...
python -m venv venv
if %ERRORLEVEL% NEQ 0 (
    echo Failed to create virtual environment.
    pause
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat
if %ERRORLEVEL% NEQ 0 (
    echo Failed to activate virtual environment.
    pause
    exit /b 1
)

echo Upgrading pip...
python -m pip install --upgrade pip
if %ERRORLEVEL% NEQ 0 (
    echo Failed to upgrade pip.
    pause
    exit /b 1
)

echo Installing required packages...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo Failed to install required packages.
    pause
    exit /b 1
)

echo.
echo Setup completed successfully!
echo To activate the virtual environment in the future, run: venv\Scripts\activate
pause
