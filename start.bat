@echo off
echo starting...

REM 构建并启动所有服务
docker-compose up --build -d

echo 等待服务启动...
timeout /t 30 /nobreak >nul

REM 检查服务状态
docker-compose ps

echo started！
echo address: http://localhost
echo logs: docker-compose logs -f
echo to stop: docker-compose down
pause