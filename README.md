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

安装 Python、Node.js 和 npm。在项目根目录执行：

```powershell
py -3.13 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
& .\.venv\Scripts\python.exe -m pip install -r ai_services\pose\requirements.txt
Set-Location frontend
npm ci
Set-Location ..
```

如果 `py -3.13` 不可用，可用本机已安装的兼容 Python 创建虚拟环境。首次使用请注册个人账号；固定口令的演示账号默认关闭。

## 电脑端开发

在项目根目录打开三个 PowerShell 窗口，依次运行：

```powershell
# 窗口 1：RTMPose
Set-Location ai_services\pose
$env:RTMPOSE_BACKEND = "onnxruntime"
$env:RTMPOSE_MODE = "balanced"
$env:RTMPOSE_DEVICE = "cpu"
& ..\..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8101
```

```powershell
# 窗口 2：从项目根目录进入
Set-Location backend
& ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
# 窗口 3：从项目根目录进入
Set-Location frontend
npm run dev
```

网页：`http://127.0.0.1:5173`；API 健康检查：`http://127.0.0.1:8000/health`。实时摄像头的骨架在浏览器中处理；上传视频的 RTMPose 分析需要姿态服务运行。

## 手机端 HTTPS 演示

将 Windows 64 位的 `caddy.exe` 和 `cloudflared.exe` 放在项目上一级的 `mobile-tools/` 目录。例如本机路径是 `E:\bishe\mobile-tools\`。

双击项目根目录的 `启动手机HTTPS.bat`。脚本会构建网页、启动 RTMPose、Caddy、Cloudflare 隧道与 FastAPI，最后显示本次手机 HTTPS 地址。电脑和手机均使用这个地址。测试结束、视频处理完成后，双击 `关闭手机HTTPS.bat`。

临时网址在重新启动时可能变化；测试期间电脑必须开机、联网且不能休眠。网址与日志位于 `runtime_logs/mobile_https/`。若端口 8000、8101 或 8080 已占用，请先在原窗口停止旧服务。不要直接双击 `.ps1`。

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
npm run build
```

后端测试使用独立的临时数据库；手机摄像头和网络上传仍需在目标设备上验证。

## 文档

- [架构](docs/architecture.md) · [API](docs/api.md) · [账号与数据隔离](docs/authentication.md)
- [姿态数据契约](docs/pose_session.md) · [处方审核](docs/prescription_review.md) · [离线视频验证](docs/offline_demo_quickstart.md)

## 上传到自己的 GitHub

登录 GitHub，点击右上角 `+` → **New repository**，取名如 `active-health-system`，建议先选择 **Private**。不要勾选新建 README、`.gitignore` 或 License。本项目已初始化本地 Git 并暂存了代码。创建空仓库后，在本项目根目录运行：

```powershell
git status --short
git commit -m "Initial project release"
git remote add origin https://github.com/<你的用户名>/active-health-system.git
git push -u origin main
```

执行 `git status --short` 后先核对清单中没有数据库、视频、日志、虚拟环境或 `node_modules`，再提交。将 `<你的用户名>` 替换成自己的 GitHub 用户名。首次推送时按提示完成浏览器登录；不要在命令中填写密码。后续更新使用 `git add .`、`git commit -m "修改说明"`、`git push`。
