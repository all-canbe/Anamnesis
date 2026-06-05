---
id: "k7"
slug: "css-container-queries"
title: "CSS Container Queries 实战指南"
date: "2026-05-08"
category: "frontend"
summary: "Container Queries 让组件根据自身容器尺寸而非视口来调整样式。探索其与 Media Queries 的互补关系和实际应用场景。"
format: "html"
---

<p>Container Queries 让组件根据自身容器大小调整布局，解决了 Media Queries 只能响应视口的问题。</p>
<h2>基本用法</h2>
<pre><code>.card-container { container-type: inline-size; container-name: card; }
@container card (min-width: 400px) {
  .card { display: grid; grid-template-columns: 200px 1fr; }
}</code></pre>
<h2>Container Query 单位</h2>
<ul><li>cqw / cqh：容器宽度/高度的 1%</li><li>cqi / cqb：容器内联/块级尺寸的 1%</li></ul>
<p>浏览器支持：Chrome 105+、Safari 16+、Firefox 110+。</p>