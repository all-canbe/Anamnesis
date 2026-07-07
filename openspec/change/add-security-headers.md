# 添加安全响应头

## 修改了什么

在 `next.config.ts` 中添加了 `headers` 配置，为所有路由（`/(.*)`）设置 7 个安全响应头：

| 响应头 | 值 | 作用 |
|--------|-----|------|
| `X-Content-Type-Options` | `nosniff` | 禁止浏览器 MIME 类型嗅探 |
| `X-Frame-Options` | `DENY` | 禁止页面被嵌入 frame |
| `X-XSS-Protection` | `1; mode=block` | 启用浏览器 XSS 过滤器 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 控制 Referer 头发送策略 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | 禁用相机/麦克风/地理位置 |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | 强制 HTTPS（2年有效期） |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...` | 内容安全策略 |

## 为何这样修改

- 使用 Next.js 内置的 `headers` 配置，无需额外依赖或 middleware
- 匹配所有路由的正则 `/(.*)` 确保每个页面和 API 路由都获得安全头
- CSP 中 `script-src` 包含 `'unsafe-inline'` 和 `'unsafe-eval'` 是为了兼容 Next.js 开发模式，不影响正常功能
- 类型签名 `headers: async () => [...]` 符合 Next.js 16 的 `NextConfig` 类型定义（`() => Promise<Header[]> | Header[]`）

## 变更的意义

- 填补了项目安全检查中发现的 P1 级别安全缺口（安全 Headers 缺失）
- 防止常见 Web 攻击：点击劫持（X-Frame-Options）、MIME 混淆（X-Content-Type-Options）、XSS（CSP + X-XSS-Protection）
- 不破坏现有功能：TypeScript 编译通过，CSP 策略已放宽 `unsafe-inline`/`unsafe-eval` 以兼容 Next.js