# -*- coding: utf-8 -*-
"""打字训练场 · 云端 API 配置模板

用法：
    cp config.example.py config.py
然后按下面的说明填入你自己的凭据。config.py 已被 .gitignore 排除，不会被提交。

部署建议：本服务使用**独立的 MySQL 实例**，与服务器上其它数据库隔离，
不要复用已有的数据库端口，避免相互影响。
"""

# ---------- 数据库 ----------
# 建议为本项目单独起一个 MySQL 实例，监听独立端口（示例用 3307）
DB_HOST = '127.0.0.1'
DB_PORT = 3307
DB_USER = 'typing_app'
DB_PASSWORD = 'CHANGE_ME_数据库密码'
DB_NAME = 'typing_trainer'
DB_CHARSET = 'utf8mb4'

# ---------- 服务监听 ----------
# 建议只监听 127.0.0.1，由 nginx 反向代理对外暴露
LISTEN_HOST = '127.0.0.1'
LISTEN_PORT = 5001

# 验证码 / 会话令牌的哈希盐值。
# 生成方式（任选一种）：
#   python3 -c "import secrets; print(secrets.token_hex(24))"
#   openssl rand -hex 24
APP_SECRET = 'CHANGE_ME_随机字符串'

# ---------- 邮箱验证码策略 ----------
CODE_TTL_SECONDS = 600      # 验证码有效期：10 分钟
CODE_MAX_ATTEMPTS = 5       # 单个验证码最多校验次数
CODE_SEND_INTERVAL = 60     # 同一邮箱两次发送的最小间隔（秒）
CODE_DAILY_LIMIT = 20       # 同一邮箱每日发送上限

# ---------- 会话令牌 ----------
TOKEN_TTL_DAYS = 30

# ---------- 邮件（以 QQ 邮箱为例）----------
# 1. 登录 QQ 邮箱网页版 → 设置 → 账户 → 开启「POP3/SMTP服务」
# 2. 按提示生成「授权码」（16 位字母），它不是 QQ 登录密码
# 3. 用其它邮箱服务同理，改 SMTP_HOST / SMTP_PORT 即可
SMTP_ENABLED = True
SMTP_HOST = 'smtp.qq.com'
SMTP_PORT = 465
SMTP_USE_SSL = True
SMTP_USER = 'your_account@qq.com'      # 发信邮箱
SMTP_PASSWORD = 'CHANGE_ME_SMTP授权码'  # 邮箱「SMTP 授权码」
SMTP_FROM_NAME = '打字训练场'

# 开发期开关：邮件未接入时可用于本地联调。
# DEV_LOG_CODE    —— 把验证码写进服务端日志
# DEV_RETURN_CODE —— 把验证码直接回传给客户端（仅限本地调试，切勿在线上开启）
# 正式环境请保持两项均为 False
DEV_LOG_CODE = False
DEV_RETURN_CODE = False
