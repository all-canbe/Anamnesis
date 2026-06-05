---
id: "k5"
slug: "docker-multistage-build"
title: "Docker 多阶段构建优化实践"
date: "2026-05-12"
category: "devops"
summary: "通过多阶段构建将 Node.js 应用镜像从 900MB 压缩到 80MB，分享镜像优化的系统方法和安全最佳实践。"
format: "html"
---

<p>Docker 镜像体积直接影响部署速度。多阶段构建是优化的核心手段。</p>
<h2>优化技巧</h2>
<ul><li>选择轻量基础镜像（alpine &gt; slim &gt; full）</li><li>利用层缓存：变化少的层放前面</li><li>.dockerignore 排除无关文件</li><li>合并 RUN 指令减少层数</li></ul>
<h2>安全实践</h2>
<ul><li>非 root 用户运行</li><li>固定基础镜像版本</li><li>扫描漏洞（docker scan / Trivy）</li><li>最小化攻击面</li></ul>