---
id: "k4"
slug: "system-design-notes"
title: "《系统设计面试》读书笔记"
date: "2026-05-15"
category: "reading"
summary: "Alex Xu 的经典系统设计入门书籍。记录关键知识点：伸缩性模式、数据分片、缓存策略和常见系统设计题解。"
format: "html"
---

<p>《System Design Interview - An Insider's Guide》是系统设计面试领域的经典参考书。</p>
<h2>系统演进路径</h2>
<ol><li>单服务器架构</li><li>应用与数据库分离</li><li>引入负载均衡器</li><li>数据库主从复制</li><li>缓存层（CDN + Redis）</li><li>消息队列解耦</li><li>数据库分片</li></ol>
<h2>缓存策略</h2>
<ul><li>Cache-Aside：先查缓存，未命中则查库</li><li>Write-Through：同时更新缓存和数据库</li><li>Write-Behind：先写缓存，异步写数据库</li></ul>