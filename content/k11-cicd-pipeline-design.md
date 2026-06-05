---
id: "k11"
slug: "cicd-pipeline-design"
title: "CI/CD 流水线设计模式与最佳实践"
date: "2026-04-25"
category: "devops"
summary: "从简单到复杂的 CI/CD 流水线演进路径。介绍并行化、缓存优化、条件触发和环境管理策略。"
format: "md"
---

CI/CD 流水线是现代软件开发的基础设施。

## 演进路径

1. Lint + Test
2. + Build + Artifacts
3. + Deploy Staging
4. + E2E Tests
5. + Deploy Production

## 优化技巧

- **依赖缓存**：缓存 node_modules、pip packages 等
- **Docker 层缓存**：合理利用构建缓存
- **增量构建**：只构建变更的部分
- **条件执行**：按分支或文件变更决定是否执行

> 流水线的黄金法则：让反馈尽可能快地到达开发者。