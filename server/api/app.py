# -*- coding: utf-8 -*-
"""打字训练场 · 云端 API

职责：
  1. 邮箱验证码登录 / 注册
  2. 训练成绩的云端存储与多端同步

数据落在独立 MySQL 实例（127.0.0.1:3307）的 typing_trainer 库中，
与服务器上原有的 3306 实例、ClassManager 的 SQLite 互不影响。
"""

import hashlib
import hmac
import json
import logging
import re
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.header import Header
from email.mime.text import MIMEText
from email.utils import formataddr

import pymysql
import pymysql.cursors
from flask import Flask, g, jsonify, request

import config

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger('typing-api')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024

EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
MAX_RECORDS_PER_PUSH = 2000


# ---------------------------------------------------------------- 数据库

def db():
    """每个请求复用一个连接（低并发场景足够，且避免长连接失效问题）。"""
    if 'db' not in g:
        g.db = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset=config.DB_CHARSET,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            # 统一用 UTC：否则 CURRENT_TIMESTAMP 会按服务器本地时间(+8)写入，
            # 与 Python 侧的 utcnow() 比对时会产生 8 小时偏差（曾导致限流提示“请 28859 秒后再试”）
            init_command="SET time_zone = '+00:00'",
        )
    return g.db


@app.teardown_appcontext
def _close_db(_exc):
    conn = g.pop('db', None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


def query(sql, args=(), one=False):
    with db().cursor() as cur:
        cur.execute(sql, args)
        rows = cur.fetchall()
    if one:
        return rows[0] if rows else None
    return rows


def execute(sql, args=()):
    with db().cursor() as cur:
        cur.execute(sql, args)
        return cur.rowcount


# ---------------------------------------------------------------- 工具

def utcnow():
    return datetime.utcnow()


def sha256_hex(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def code_digest(email, purpose, code):
    msg = '%s|%s|%s' % (email, purpose, code)
    return hmac.new(config.APP_SECRET.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).hexdigest()


def normalize_email(value):
    return (value or '').strip().lower()


def parse_dt(value):
    """把客户端传来的 ISO8601 时间解析成朴素 UTC datetime。"""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def fail(message, status=400):
    return jsonify(ok=False, error=message), status


def ok(**payload):
    return jsonify(ok=True, **payload)


def user_payload(row):
    return {'id': row['user_id'], 'email': row['email'], 'nickname': row['nickname'] or ''}


# ---------------------------------------------------------------- CORS

@app.before_request
def _preflight():
    if request.method == 'OPTIONS':
        return ('', 204)


@app.after_request
def _cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    resp.headers['Access-Control-Max-Age'] = '86400'
    return resp


# ---------------------------------------------------------------- 鉴权

def current_user():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    token = header[7:].strip()
    if not token:
        return None
    row = query(
        'SELECT t.id AS token_id, t.user_id, t.expires_at, u.email, u.nickname, u.status '
        'FROM auth_tokens t JOIN users u ON u.id = t.user_id '
        'WHERE t.token_hash = %s AND t.revoked_at IS NULL',
        (sha256_hex(token),), one=True)
    if not row or row['expires_at'] < utcnow() or not row['status']:
        return None
    return row


def issue_token(user_id, device=''):
    token = secrets.token_urlsafe(32)
    execute(
        'INSERT INTO auth_tokens (user_id, token_hash, device, created_at, last_seen_at, expires_at) '
        'VALUES (%s, %s, %s, %s, %s, %s)',
        (user_id, sha256_hex(token), device[:64], utcnow(), utcnow(),
         utcnow() + timedelta(days=config.TOKEN_TTL_DAYS)))
    return token


# ---------------------------------------------------------------- 邮件

def send_code_email(email, code, purpose):
    if not config.SMTP_ENABLED:
        if config.DEV_LOG_CODE:
            log.warning('[DEV] 邮件未启用，验证码 %s -> %s (purpose=%s)', code, email, purpose)
        return True

    action = '注册新账号' if purpose == 'register' else '登录'
    body = (
        '您好：\n\n'
        '您正在使用「打字训练场」%s，验证码为：\n\n'
        '        %s\n\n'
        '验证码 %d 分钟内有效，请勿转发给他人。\n'
        '如果这不是您本人的操作，请忽略本邮件。\n\n'
        '—— 打字训练场 · CIOT 工作室\n'
    ) % (action, code, config.CODE_TTL_SECONDS // 60)

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = Header('打字训练场 · 邮箱验证码', 'utf-8')
    msg['From'] = formataddr((str(Header(config.SMTP_FROM_NAME, 'utf-8')), config.SMTP_USER))
    msg['To'] = email

    try:
        if config.SMTP_USE_SSL:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, context=ctx, timeout=15) as smtp:
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.sendmail(config.SMTP_USER, [email], msg.as_string())
        else:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.sendmail(config.SMTP_USER, [email], msg.as_string())
    except Exception as exc:
        log.exception('发送验证码邮件失败: %s', exc)
        return False
    return True


# ---------------------------------------------------------------- 验证码校验

def consume_code(email, purpose, code):
    """校验并消费验证码。返回 (是否通过, 错误信息)。"""
    row = query(
        'SELECT id, code_hash, attempts, used_at, expires_at FROM email_codes '
        'WHERE email = %s AND purpose = %s ORDER BY id DESC LIMIT 1',
        (email, purpose), one=True)

    if not row:
        return False, '请先获取验证码'
    if row['used_at'] is not None:
        return False, '验证码已使用，请重新获取'
    if row['expires_at'] < utcnow():
        return False, '验证码已过期，请重新获取'
    if row['attempts'] >= config.CODE_MAX_ATTEMPTS:
        return False, '尝试次数过多，请重新获取验证码'

    if not hmac.compare_digest(row['code_hash'], code_digest(email, purpose, code)):
        execute('UPDATE email_codes SET attempts = attempts + 1 WHERE id = %s', (row['id'],))
        return False, '验证码不正确'

    execute('UPDATE email_codes SET used_at = %s WHERE id = %s', (utcnow(), row['id']))
    return True, ''


# ---------------------------------------------------------------- 路由：健康检查

@app.route('/api/health', methods=['GET'])
def health():
    try:
        row = query('SELECT 1 AS v', one=True)
        return ok(status='up', db=bool(row and row['v'] == 1))
    except Exception as exc:
        log.exception('健康检查失败')
        return fail('数据库不可用: %s' % exc, 503)


# ---------------------------------------------------------------- 路由：发送验证码

@app.route('/api/auth/send-code', methods=['POST'])
def send_code():
    body = request.get_json(silent=True) or {}
    email = normalize_email(body.get('email'))
    purpose = (body.get('purpose') or 'login').strip().lower()

    if purpose not in ('login', 'register'):
        return fail('purpose 只能为 login 或 register')
    if not EMAIL_RE.match(email) or len(email) > 190:
        return fail('邮箱格式不正确')

    exists = query('SELECT id FROM users WHERE email = %s', (email,), one=True)
    if purpose == 'login' and not exists:
        return fail('该邮箱尚未注册，请先注册账号', 404)
    if purpose == 'register' and exists:
        return fail('该邮箱已注册，请直接登录', 409)

    last = query(
        'SELECT created_at FROM email_codes WHERE email = %s ORDER BY id DESC LIMIT 1',
        (email,), one=True)
    if last:
        elapsed = (utcnow() - last['created_at']).total_seconds()
        if elapsed < config.CODE_SEND_INTERVAL:
            wait = int(config.CODE_SEND_INTERVAL - elapsed) + 1
            return fail('发送过于频繁，请 %d 秒后再试' % wait, 429)

    today = query(
        'SELECT COUNT(*) AS c FROM email_codes WHERE email = %s AND created_at >= %s',
        (email, utcnow() - timedelta(days=1)), one=True)
    if today and today['c'] >= config.CODE_DAILY_LIMIT:
        return fail('今日发送次数已达上限，请明天再试', 429)

    code = ''.join(secrets.choice('0123456789') for _ in range(6))
    execute(
        'INSERT INTO email_codes (email, purpose, code_hash, expires_at, req_ip) '
        'VALUES (%s, %s, %s, %s, %s)',
        (email, purpose, code_digest(email, purpose, code),
         utcnow() + timedelta(seconds=config.CODE_TTL_SECONDS),
         (request.remote_addr or '')[:45]))

    if not send_code_email(email, code, purpose):
        return fail('验证码邮件发送失败，请稍后重试', 502)

    payload = {'ttl': config.CODE_TTL_SECONDS}
    # 邮件通道尚未接入时，把验证码回传给客户端便于联调；配置好 SMTP 后自动失效
    if not config.SMTP_ENABLED and config.DEV_RETURN_CODE:
        payload['devCode'] = code
    return ok(**payload)


# ---------------------------------------------------------------- 路由：注册 / 登录

@app.route('/api/auth/register', methods=['POST'])
def register():
    body = request.get_json(silent=True) or {}
    email = normalize_email(body.get('email'))
    code = str(body.get('code') or '').strip()
    nickname = (body.get('nickname') or '').strip()[:64]

    if not EMAIL_RE.match(email) or len(email) > 190:
        return fail('邮箱格式不正确')
    if not re.match(r'^\d{6}$', code):
        return fail('验证码应为 6 位数字')

    exists = query('SELECT id FROM users WHERE email = %s', (email,), one=True)
    if exists:
        return fail('该邮箱已注册，请直接登录', 409)

    passed, message = consume_code(email, 'register', code)
    if not passed:
        return fail(message)

    execute(
        'INSERT INTO users (email, nickname, created_at, last_login_at) VALUES (%s, %s, %s, %s)',
        (email, nickname, utcnow(), utcnow()))
    user = query('SELECT id, email, nickname FROM users WHERE email = %s', (email,), one=True)
    token = issue_token(user['id'], request.headers.get('User-Agent', ''))
    log.info('新用户注册: %s', email)
    return ok(token=token, user={'id': user['id'], 'email': user['email'], 'nickname': user['nickname'] or ''})


@app.route('/api/auth/login', methods=['POST'])
def login():
    body = request.get_json(silent=True) or {}
    email = normalize_email(body.get('email'))
    code = str(body.get('code') or '').strip()

    if not EMAIL_RE.match(email) or len(email) > 190:
        return fail('邮箱格式不正确')
    if not re.match(r'^\d{6}$', code):
        return fail('验证码应为 6 位数字')

    user = query('SELECT id, email, nickname, status FROM users WHERE email = %s', (email,), one=True)
    if not user:
        return fail('该邮箱尚未注册，请先注册账号', 404)
    if not user['status']:
        return fail('账号已被禁用', 403)

    passed, message = consume_code(email, 'login', code)
    if not passed:
        return fail(message)

    execute('UPDATE users SET last_login_at = %s WHERE id = %s', (utcnow(), user['id']))
    token = issue_token(user['id'], request.headers.get('User-Agent', ''))
    return ok(token=token, user={'id': user['id'], 'email': user['email'], 'nickname': user['nickname'] or ''})


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    user = current_user()
    if not user:
        return ok()
    execute('UPDATE auth_tokens SET revoked_at = %s WHERE id = %s', (utcnow(), user['token_id']))
    return ok()


# ---------------------------------------------------------------- 路由：账号信息

@app.route('/api/me', methods=['GET'])
def me():
    user = current_user()
    if not user:
        return fail('未登录或登录已过期', 401)

    stats = query(
        'SELECT COUNT(*) AS total, '
        '       COALESCE(MAX(wpm), 0) AS best, '
        '       COALESCE(SUM(duration), 0) AS seconds, '
        '       COALESCE(ROUND(AVG(acc)), 0) AS avg_acc '
        'FROM records WHERE user_id = %s AND mode <> %s',
        (user['user_id'], 'game'), one=True)
    games = query(
        'SELECT COUNT(*) AS c, COALESCE(MAX(wpm), 0) AS best FROM records '
        'WHERE user_id = %s AND mode = %s',
        (user['user_id'], 'game'), one=True)

    return ok(user=user_payload(user), stats={
        'total': to_int(stats['total']),
        'best': to_int(stats['best']),
        'seconds': to_int(stats['seconds']),
        'avgAcc': to_int(stats['avg_acc']),
        'gamesPlayed': to_int(games['c']),
        'bestGame': to_int(games['best']),
    })


# ---------------------------------------------------------------- 路由：成绩同步

def record_to_json(row):
    try:
        weak = json.loads(row['weak_json']) if row['weak_json'] else {}
    except Exception:
        weak = {}
    return {
        'clientId': row['client_id'],
        'mode': row['mode'],
        'modeLabel': row['mode_label'],
        'lessonLabel': row['lesson_label'],
        'wpm': to_int(row['wpm']),
        'acc': to_int(row['acc']),
        'duration': to_int(row['duration']),
        'errors': to_int(row['errors']),
        'chars': to_int(row['chars']),
        'weak': weak,
        'cn': bool(row['cn']),
        'finishedAt': (row['finished_at'] or row['created_at']).isoformat() + 'Z',
    }


@app.route('/api/records', methods=['GET'])
def get_records():
    user = current_user()
    if not user:
        return fail('未登录或登录已过期', 401)

    limit = min(max(to_int(request.args.get('limit'), 500), 1), 2000)
    rows = query(
        'SELECT client_id, mode, mode_label, lesson_label, wpm, acc, duration, errors, '
        '       chars, weak_json, cn, finished_at, created_at '
        'FROM records WHERE user_id = %s ORDER BY finished_at DESC, id DESC LIMIT %s',
        (user['user_id'], limit))
    return ok(records=[record_to_json(r) for r in rows])


@app.route('/api/records', methods=['POST'])
def push_records():
    user = current_user()
    if not user:
        return fail('未登录或登录已过期', 401)

    body = request.get_json(silent=True) or {}
    items = body.get('records')
    if not isinstance(items, list):
        return fail('records 应为数组')
    if len(items) > MAX_RECORDS_PER_PUSH:
        return fail('单次最多上传 %d 条记录' % MAX_RECORDS_PER_PUSH)

    accepted = 0
    skipped = 0
    conn = db()
    with conn.cursor() as cur:
        for item in items:
            if not isinstance(item, dict):
                skipped += 1
                continue
            client_id = str(item.get('clientId') or '').strip()[:36]
            if not client_id:
                skipped += 1
                continue
            try:
                weak_json = json.dumps(item.get('weak') or {}, ensure_ascii=False)[:60000]
            except Exception:
                weak_json = '{}'
            # INSERT IGNORE + (user_id, client_id) 唯一键 => 重复上传天然幂等
            cur.execute(
                'INSERT IGNORE INTO records '
                '(user_id, client_id, mode, mode_label, lesson_label, wpm, acc, duration, '
                ' errors, chars, weak_json, cn, finished_at) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                (user['user_id'], client_id,
                 str(item.get('mode') or '')[:16],
                 str(item.get('modeLabel') or '')[:64],
                 str(item.get('lessonLabel') or '')[:64],
                 to_int(item.get('wpm')),
                 to_int(item.get('acc')),
                 to_int(item.get('duration')),
                 to_int(item.get('errors')),
                 to_int(item.get('chars')),
                 weak_json,
                 1 if item.get('cn') else 0,
                 parse_dt(item.get('finishedAt')) or utcnow()))
            accepted += cur.rowcount
    return ok(accepted=accepted, skipped=skipped)


@app.route('/api/records', methods=['DELETE'])
def clear_records():
    user = current_user()
    if not user:
        return fail('未登录或登录已过期', 401)
    removed = execute('DELETE FROM records WHERE user_id = %s', (user['user_id'],))
    return ok(removed=removed)


# ---------------------------------------------------------------- 错误处理

@app.errorhandler(404)
def _not_found(_e):
    return fail('接口不存在', 404)


@app.errorhandler(500)
def _server_error(_e):
    return fail('服务器内部错误', 500)


if __name__ == '__main__':
    app.run(host=config.LISTEN_HOST, port=config.LISTEN_PORT, debug=False)
