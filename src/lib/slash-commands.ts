export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  group: "command" | "skill";
  /** Prompt template injected when selected. Use {input} for user text after the command. */
  template: string;
  /** 对应的后端工具名。有值则直接执行工具，无需 LLM 识别命令。 */
  tool?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ─── Commands ───
  {
    id: "import",
    name: "Import",
    description: "导入网页文章、RSS 源或 GitHub 仓库到知识库",
    icon: "📥",
    group: "command",
    template: "/import {input}",
    tool: "fetch_skill",
  },
  {
    id: "search-kb",
    name: "Search KB",
    description: "在知识库中搜索已有记录",
    icon: "🔍",
    group: "command",
    template: "/search-kb {input}",
    tool: "search_kb",
  },
  {
    id: "summarize",
    name: "Summarize",
    description: "总结指定知识库记录的内容",
    icon: "📝",
    group: "command",
    template: "/summarize {input}",
    tool: "summarize",
  },
  {
    id: "stats",
    name: "Stats",
    description: "查看知识库统计信息（总数、分类分布）",
    icon: "📊",
    group: "command",
    template: "/stats",
    tool: "stats",
  },
  {
    id: "ask",
    name: "Ask KB",
    description: "基于知识库内容进行 RAG 问答",
    icon: "💬",
    group: "command",
    template: "/ask {input}",
    tool: "ask_kb",
  },
  {
    id: "find-skill",
    name: "Find Skill",
    description: "搜索并导入 GitHub 上的技能/教程到知识库",
    icon: "🧩",
    group: "command",
    template: "/find-skill {input}",
    tool: "search_skill",
  },

  // ─── Skills ───
  {
    id: "agent-browser",
    name: "agent-browser",
    description: "浏览器自动化，支持页面导航、表单填写、点击、截图、数据抓取和 Web 应用测试",
    icon: "🌐",
    group: "skill",
    template: "/agent-browser {input}",
    tool: "web_search",
  },
  {
    id: "agent-reach",
    name: "agent-reach",
    description: "联网获取 17 个平台内容（小红书/抖音/微博/推特/B站/V2EX/Reddit 等）",
    icon: "📡",
    group: "skill",
    template: "/agent-reach {input}",
    tool: "web_search",
  },
  {
    id: "brainstorming",
    name: "brainstorming",
    description: "在任何创作、功能开发或行为修改前，先探索用户意图、需求和设计方向",
    icon: "💡",
    group: "skill",
    template: "/brainstorming {input}",
  },
  {
    id: "data-analysis",
    name: "data-analysis",
    description: "分析 Excel 和 CSV 文件，支持多工作表、聚合、过滤、透视表和 SQL 查询",
    icon: "📊",
    group: "skill",
    template: "/data-analysis {input}",
  },
  {
    id: "frontend-design",
    name: "frontend-design",
    description: "创建高品质前端界面，支持 React/Next.js/Vue/Svelte/Tailwind 等",
    icon: "🎨",
    group: "skill",
    template: "/frontend-design {input}",
  },
  {
    id: "kz-article-deep-analysis",
    name: "kz-article-deep-analysis",
    description: "深度解读非学术类文章，抽取核心议题与核心主张，输出结构化分析报告",
    icon: "📖",
    group: "skill",
    template: "/kz-article-deep-analysis {input}",
    tool: "web_fetch",
  },
  {
    id: "kz-product-direction-master",
    name: "kz-product-direction-master",
    description: "产品方向定位与立项规划，适用于业务场景梳理、方向收敛、优先级排序",
    icon: "🎯",
    group: "skill",
    template: "/kz-product-direction-master {input}",
  },
  {
    id: "security-best-practices",
    name: "security-best-practices",
    description: "执行语言和框架特定的安全最佳实践审查，支持 Python/JS/TS/Go",
    icon: "🔒",
    group: "skill",
    template: "/security-best-practices {input}",
  },
  {
    id: "ui-ux-pro-max",
    name: "ui-ux-pro-max",
    description: "UI/UX 设计智能助手，覆盖 50+ 风格、161 色板、57 字体搭配、99 UX 准则",
    icon: "🖌️",
    group: "skill",
    template: "/ui-ux-pro-max {input}",
  },
  {
    id: "web-design-reverse",
    name: "web-design-reverse",
    description: "网页逆向解析工具，提取目标网页的设计、结构、样式、布局信息",
    icon: "🔧",
    group: "skill",
    template: "/web-design-reverse {input}",
    tool: "web_fetch",
  },
  {
    id: "whybuddy",
    name: "whybuddy",
    description: "将模糊想法转化为闭环可审查的 Spec 规格包，包含验收标准和追溯矩阵",
    icon: "📋",
    group: "skill",
    template: "/whybuddy {input}",
  },
  {
    id: "yc-office-hours",
    name: "yc-office-hours",
    description: "模拟 YC 合伙人 Office Hours 的结构化商业辅导",
    icon: "🏢",
    group: "skill",
    template: "/yc-office-hours {input}",
  },
];

/** Filter commands by search text. Returns grouped results. */
export function filterCommands(
  search: string
): { commands: SlashCommand[]; skills: SlashCommand[] } {
  if (!search) {
    return {
      commands: SLASH_COMMANDS.filter((c) => c.group === "command"),
      skills: SLASH_COMMANDS.filter((c) => c.group === "skill"),
    };
  }

  const q = search.toLowerCase();
  const match = (c: SlashCommand) =>
    c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);

  return {
    commands: SLASH_COMMANDS.filter((c) => c.group === "command" && match(c)),
    skills: SLASH_COMMANDS.filter((c) => c.group === "skill" && match(c)),
  };
}