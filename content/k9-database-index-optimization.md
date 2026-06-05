---
id: "k9"
slug: "database-index-optimization"
title: "数据库索引优化实战：从 B+Tree 到查询计划"
date: "2026-05-02"
category: "backend"
summary: "MySQL/PostgreSQL 索引原理和优化实践。覆盖索引、联合索引最左前缀、EXPLAIN 分析和慢查询排查流程。"
format: "html"
---

<p>索引是数据库性能优化的核心手段，正确使用可将查询从秒级降到毫秒级。</p>
<h2>B+Tree 索引原理</h2>
<ul><li>非叶子节点只存键值</li><li>叶子节点存完整数据，链表连接</li><li>树高度通常 2-4 层</li></ul>
<h2>联合索引与最左前缀</h2>
<p>联合索引 (a, b, c) 相当于创建了 (a)、(a,b)、(a,b,c) 三个索引，单独查 b 或 c 无法使用。</p>
<h2>覆盖索引</h2>
<p>查询的所有列都在索引中时无需回表，性能最优。</p>