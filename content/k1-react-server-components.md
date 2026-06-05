---
id: "k1"
slug: "react-server-components"
title: "React Server Components 深入理解与实践"
date: "2026-05-22"
category: "frontend"
summary: "RSC 让组件在服务端渲染，减少客户端 JS 体积。本文梳理其原理、流式渲染和与 Next.js App Router 的结合方式。"
format: "html"
---

<p>React Server Components (RSC) 是 React 18 引入的一项核心功能，它允许组件在服务端运行，直接访问后端数据源，而不需要经过 API 层。</p>
<h2>核心概念</h2>
<p>在传统的 React 应用中，所有组件都在客户端渲染。RSC 将组件分为两类：</p>
<ul><li><strong>Server Components</strong>：在服务端渲染，可以直接访问数据库、文件系统等</li><li><strong>Client Components</strong>：在客户端渲染，处理交互、状态、事件等</li></ul>
<h2>流式渲染</h2>
<p>RSC 支持流式传输，服务端可以边渲染边发送 HTML。结合 <code>Suspense</code> 边界可以将页面分块加载。</p>
<h2>关键要点</h2>
<ul><li>Server Components 不能使用 useState、useEffect</li><li>Server Components 不能绑定事件处理器</li><li>Client Components 可以导入到 Server Components 中使用</li></ul>