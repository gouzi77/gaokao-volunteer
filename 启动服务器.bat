@echo off
chcp 65001 >nul
echo ========================================
echo   高考志愿填报助手 - 本地启动器
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查Python环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到Python，请先安装Python 3.x
    echo    下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✅ Python环境正常

echo.
echo [2/3] 启动HTTP服务器...
echo.
echo 📱 请在浏览器中打开以下地址：
echo.
echo    🌐 http://localhost:8080
echo.
echo 💡 提示：
echo    - 手机和电脑需要在同一WiFi下才能用手机访问
echo    - 如需手机访问，请使用电脑的局域网IP地址
echo    - 按 Ctrl+C 可停止服务器
echo.
echo ----------------------------------------

python -m http.server 8080

pause
