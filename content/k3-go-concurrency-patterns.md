---
id: "k3"
slug: "go-concurrency-patterns"
title: "Go 语言并发模式：从 Goroutine 到 Channel 编排"
date: "2026-05-18"
category: "backend"
summary: "Go 的并发模型是其核心竞争力。本文介绍 goroutine 调度原理、channel 通信模式以及实际项目中的并发编排实践。"
format: "html"
---

<p>Go 语言以轻量级并发著称，goroutine 和 channel 构成了其核心并发原语。</p>
<h2>Goroutine 调度</h2>
<p>GMP 调度模型：G (Goroutine) 用户态线程、M (Machine) 操作系统线程、P (Processor) 逻辑处理器。</p>
<h2>Channel 通信模式</h2>
<h3>Fan-Out / Fan-In</h3>
<p>将一个任务分发给多个 goroutine 并行处理，再将结果汇聚。</p>
<h3>Pipeline 模式</h3>
<p>将处理流程串联，每个阶段通过 channel 传递数据。</p>
<h2>常见陷阱</h2>
<ul><li>Goroutine 泄漏：忘记关闭 channel 导致永久阻塞</li><li>竞态条件：多 goroutine 同时读写共享变量</li><li>死锁：channel 发送和接收不匹配</li></ul>