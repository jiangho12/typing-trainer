'use strict';

/* ============ 引导：全局错误兜底 + 启动 ============ */

window.addEventListener('error', function (event) {
  console.error('[global-error]', event.message, event.filename, event.lineno);
  try { App.toast('页面错误：' + event.message, 'error', 5000); } catch (e) { /* ignore */ }
});
window.addEventListener('unhandledrejection', function (event) {
  var reason = event.reason;
  var msg = reason && reason.message ? reason.message : String(reason || '未知异步错误');
  console.error('[unhandled-rejection]', reason);
  try { App.toast('异步错误：' + msg, 'error', 5000); } catch (e) { /* ignore */ }
});

document.addEventListener('DOMContentLoaded', function () {
  App.init().catch(function (e) {
    console.error('初始化失败:', e);
    try { App.toast('初始化失败：' + e.message, 'error'); } catch (inner) { /* ignore */ }
  });
});
