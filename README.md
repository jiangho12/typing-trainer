# 打字训练场 · Typing Trainer

一款**无广告、无捆绑、成绩云端同步**的打字练习桌面软件，由 **CIOT 工作室** 开发（ai工程师)。

从基准键到盲打，内置 6 大训练模块 + 1 个游戏化强化模块，支持邮箱验证码登录，
训练成绩自动同步到云端，换电脑登录同一邮箱即可继续。

> 当前版本：**v1.2.0**

---

## 功能

### 基础训练（6 个模块）

| 模块 | 说明 |
|------|------|
| 键位入门 | 10 节小课，从基准键开始逐排掌握，零基础首选 |
| 英文单词 | 高频常用词，练连贯输入 |
| 英文文章 | 完整短文段落，练习语流输入 |
| 中文拼音 | 配合系统中文输入法，汉字上方有拼音提示 |
| 数字专项 | 手机号、金额与随机数字串 |
| 代码片段 | 符号、大小写与缩进混合训练（含换行） |

### 强化与数据

- **单词雨游戏**：单词不断下落，敲对即消除，漏掉 3 个结束，速度随等级提升
- **成绩统计**：完整训练记录、各模式最佳成绩、薄弱键位 TOP 5
- **我的主页**：账号信息、云端成绩、手动同步、退出登录

### 训练辅助

- 虚拟键盘实时高亮「下一个该按的键」，并按十指分工着色
- 严格模式：输入错误不会跳过，按对才能继续
- 实时统计速度（WPM / 字每分钟）、准确率、用时、错误次数
- 结算页绘制准确率环形图，并列出本次最容易按错的键位

### 云端

- 邮箱验证码登录 / 注册（无密码，统一验证码登录）
- 成绩自动上报 + 多端同步，首次登录自动迁移本机历史成绩
- 防刷：验证码 10 分钟有效、同邮箱 60 秒发送间隔、每日上限 20 次、单码最多试错 5 次

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面客户端 | Electron 31 · 原生 JavaScript（无前端框架） |
| 云端 API | Python 3 · Flask 3 · gunicorn |
| 数据库 | MySQL 5.7（独立实例，独立端口） |
| 反向代理 | nginx |
| 邮件 | SMTP（示例用 QQ 邮箱） |

---

## 目录结构

```
打字练习程序/
├── app/                        # Electron 客户端
│   ├── main/                   #   主进程：窗口、IPC、本地存储
│   │   ├── index.js
│   │   ├── ipc.js
│   │   └── store.js
│   ├── renderer/               #   渲染层（界面与全部业务逻辑）
│   │   ├── index.html
│   │   ├── css/theme.css
│   │   └── js/
│   │       ├── data.js         #     题库：课程/词库/文章/中文/代码
│   │       ├── keyboard.js     #     虚拟键盘与指法配色
│   │       ├── practice.js     #     练习引擎（英文逐字符 / 中文输入法）
│   │       ├── game.js         #     单词雨游戏
│   │       ├── stats.js        #     成绩统计页
│   │       ├── cloud.js        #     云端 API 客户端与同步
│   │       ├── auth.js         #     登录 / 注册
│   │       ├── profile.js      #     我的主页
│   │       ├── app.js          #     导航与启动流程
│   │       └── browser-api.js  #     浏览器预览兼容层
│   ├── preload.js              #   contextBridge 白名单
│   └── package.json
│
├── server/api/                 # 云端 API
│   ├── app.py                  #   Flask 应用（认证 + 成绩同步）
│   ├── config.example.py       #   配置模板（复制为 config.py 后填写）
│   └── requirements.txt
│
└── installer/                  # 安装包制作脚本
    └── typing-trainer.iss      #   Inno Setup 脚本
```

---

## 本地运行（客户端）

需要 Node.js 18+。

```bash
cd app
npm install
npm start
```

> 直接用浏览器打开 `app/renderer/index.html` 也能运行：
> `browser-api.js` 会自动用 localStorage 兜底，无需 Electron。
> 注意浏览器需要能访问云端 API 才能登录。

### 修改云端地址

客户端默认连接 `http://103.231.56.158:8788`，
如需指向你自己的服务端，修改 `app/renderer/js/cloud.js` 顶部的：

```js
API_BASE: 'http://你的服务器地址:端口',
```

---

## 部署云端 API

### 1. 准备独立数据库

建议为本项目**单独运行一个 MySQL 实例**，使用独立端口，避免影响服务器上已有的数据库：

```bash
# 以独立 datadir / 端口 3307 初始化（示例）
mysqld --defaults-file=/etc/my3307.cnf --initialize-insecure
```

建库建表：

```sql
CREATE DATABASE typing_trainer DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'typing_app'@'127.0.0.1' IDENTIFIED BY '你的数据库密码';
GRANT SELECT, INSERT, UPDATE, DELETE ON typing_trainer.* TO 'typing_app'@'127.0.0.1';
```

四张表：`users`（用户）、`email_codes`（邮箱验证码）、`auth_tokens`（会话令牌）、`records`（训练成绩），
字段定义见 `app.py` 中的建表语句说明。

> ⚠️ 时间统一使用 UTC。MySQL 连接需设置 `SET time_zone = '+00:00'`，
> 否则 `CURRENT_TIMESTAMP` 会写入服务器本地时间，与 Python 侧比对时产生时区偏差。

### 2. 部署 API

```bash
cd server/api
python3 -m venv venv
venv/bin/pip install --only-binary=:all: -r requirements.txt

cp config.example.py config.py
# 编辑 config.py：填数据库密码、APP_SECRET、SMTP 账号与授权码
```

用 systemd 常驻：

```ini
[Unit]
Description=Typing Trainer Cloud API
After=network.target

[Service]
Type=simple
User=www
WorkingDirectory=/opt/typing-trainer/api
ExecStart=/opt/typing-trainer/api/venv/bin/gunicorn -w 2 -b 127.0.0.1:5001 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

### 3. nginx 反向代理

```nginx
server {
    listen 8788;
    server_name _;
    client_max_body_size 8m;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4. 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/send-code` | 发送验证码 `{email, purpose: login\|register}` |
| POST | `/api/auth/register` | 注册 `{email, code, nickname}` |
| POST | `/api/auth/login` | 登录 `{email, code}` |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/me` | 账号信息与云端统计 |
| GET | `/api/records` | 拉取成绩 |
| POST | `/api/records` | 上传成绩（按 `clientId` 幂等） |
| DELETE | `/api/records` | 清空云端成绩 |

除健康检查与认证接口外，均需请求头 `Authorization: Bearer <token>`。

---

## 制作安装包

使用 [Inno Setup](https://jrsoftware.org/isinfo.php)：

```bash
# 1. 先用 electron-packager 生成便携版
cd app
npx electron-packager . 打字练习 --platform=win32 --arch=x64

# 2. 用 Inno Setup 编译安装包
ISCC.exe installer/typing-trainer.iss
```

---

## 免责与许可

本软件由 **CIOT 工作室（工作室ai辅助)** 开发，完全免费，仅供个人学习与打字练习使用，
**禁止用于商业用途或任何非法用途**。

软件按「现状」提供，作者不对因使用或误用本软件产生的任何直接或间接损失承担责任。

以 **MIT License** 开源，详见 [LICENSE](LICENSE)。

---

© CIOT STUDIO 2026
