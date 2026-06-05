---
id: "k10"
slug: "software-design-philosophy"
title: "《软件设计的哲学》核心思想摘要"
date: "2026-04-28"
category: "reading"
summary: "John Ousterhout 的经典著作。核心理念：复杂性是软件的天敌，好的设计通过减少认知负担来控制复杂性。"
format: "html"
---

<p>《A Philosophy of Software Design》提出了深刻而实用的设计原则。</p>
<h2>战术编程 vs 战略编程</h2>
<p><strong>战术编程</strong>：只关注让当前功能工作。<strong>战略编程</strong>：投资于良好设计，长期更快。</p>
<h2>深层模块 vs 浅层模块</h2>
<p>最好的模块是接口简单、实现复杂的模块。深层模块提供强大抽象并隐藏复杂度。</p>
<h2>关键原则</h2>
<ul><li>复杂性是渐进累积的</li><li>接口应使常见情况简单</li><li>定义"存在的错误"消除特殊情况</li></ul>