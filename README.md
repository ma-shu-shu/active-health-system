# 主动健康智能服务系统

面向个人运动与健康管理的 Web 原型。系统包括注册登录、首次测评、训练计划、实时摄像头姿态提示、视频训练、训练记录和报告回看。电脑与手机共用同一套后端及本地数据。

> 研究与演示项目。训练建议和报告不构成医疗诊断；公网演示只使用测试账号与无敏感内容的视频。

## 技术与目录

- `frontend/`：Vue 3、Vite、MediaPipe 实时姿态识别和 PWA 页面。
- `backend/`：FastAPI、SQLAlchemy、SQLite、业务接口及测试。
- `ai_services/pose/`：RTMPose / ONNX Runtime 视频姿态分析。
- `data/`：量表和训练处方模板；下载的数据集不纳入仓库。
- `deploy/`：Caddy 配置和正式部署示例。
- `scripts/`：本地启动、停止与验证脚本。
- `docs/`：接口、架构和业务设计说明。

## Windows 环境准备

安装 Python 3.13、Node.js 和 npm。先用 `python --version`、`node --version` 和 `npm.cmd --version` 确认命令可用，再在项目根目录打开 PowerShell 执行：

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
& .\.venv\Scripts\python.exe -m pip install -r ai_services\pose\requirements.txt
Set-Location frontend
npm.cmd ci
Set-Location ..
```

首次使用请注册个人账号。手机 HTTPS 模式关闭固定口令演示账号；电脑端一键启动脚本会启用本地演示账号。

## 电脑端开发

双击项目根目录的 `启动电脑端.bat`，启动本地网页、后端和姿态服务；访问 `http://127.0.0.1:5173`。结束后双击 `关闭电脑端.bat`。如果提示端口被占用，先关闭正在运行的手机 HTTPS 模式或原有服务，再启动电脑端。

API 健康检查地址为 `http://127.0.0.1:8000/health`。实时摄像头的骨架在浏览器中处理；上传视频的 RTMPose 分析需要姿态服务运行。

## 手机端 HTTPS 演示

将 Windows 64 位的 `caddy.exe` 和 `cloudflared.exe` 放在项目上一级的 `mobile-tools/` 目录。本机示例路径为 `E:\bishe\mobile-tools\`。可分别用 `& "E:\bishe\mobile-tools\caddy.exe" version` 和 `& "E:\bishe\mobile-tools\cloudflared.exe" --version` 检查；如果项目不在 `E:\bishe`，请将路径替换为实际路径。

双击项目根目录的 `启动手机HTTPS.bat`。它会同时启动电脑和手机所需服务：构建网页、启动 RTMPose、Caddy、Cloudflare 隧道与 FastAPI，并在公网健康检查通过后显示本次 HTTPS 地址。电脑和手机均使用这个地址。测试结束、视频处理完成后，双击 `关闭手机HTTPS.bat`。电脑端本地模式与手机 HTTPS 模式会使用相同的后端端口，请一次只启动一种模式。

临时网址在重新启动时可能变化；测试期间电脑必须开机、联网且不能休眠。网址与日志位于 `runtime_logs/mobile_https/`。手机 Safari 请打开本次启动显示的新网址；旧主屏幕图标可能指向失效的隧道。若端口 8000、8101 或 8080 已占用，请先在原窗口停止旧服务。不要直接双击 `.ps1`。

## 本地数据

- 账号、训练记录与报告：项目根目录的 `active_health.db`。
- 上传视频：`uploads/offline/<用户ID>/<训练ID>/`。
- 数据库、视频、日志、虚拟环境、前端依赖、构建结果和下载数据集均由 `.gitignore` 排除。备份时请同时备份数据库与 `uploads/`。
- Quick Tunnel 适合短期演示。长期在线和多用户使用建议部署固定域名及 HTTPS，并评估 PostgreSQL、对象存储和 RTMPose 算力。

## 开发检查

```powershell
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
& .\.venv\Scripts\python.exe -m pytest backend\tests -q
Set-Location frontend
npm.cmd run build
```

后端测试使用独立的临时数据库；手机摄像头和网络上传仍需在目标设备上验证。

## 文档

- [架构](docs/architecture.md) · [API](docs/api.md) · [账号与数据隔离](docs/authentication.md)
- [姿态数据契约](docs/pose_session.md) · [处方审核](docs/prescription_review.md) · [离线视频验证](docs/offline_demo_quickstart.md)
