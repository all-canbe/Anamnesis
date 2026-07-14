import fs from "fs";
import path from "path";
import type { SlashCommand } from "./slash-commands";

const SKILLS_DIR = path.join(process.cwd(), "skills");

// ─── YAML Frontmatter 解析（轻量级，不引入 gray-matter） ───

interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  [key: string]: any;
}

/** 从 SKILL.md 内容中解析 YAML frontmatter */
export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, any> = {};

  let currentKey = "";
  for (const line of yaml.split(/\r?\n/)) {
    // 跳过空行和注释
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // 嵌套字段（如 metadata:\n  author: xxx）
    const nestedMatch = line.match(/^\s+(\S+):\s*(.*)$/);
    if (nestedMatch && currentKey) {
      result[currentKey] = result[currentKey] || {};
      result[currentKey][nestedMatch[1]] = nestedMatch[2].trim().replace(/^["']|["']$/g, "");
      continue;
    }

    // 顶层字段
    const kvMatch = line.match(/^(\S+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim().replace(/^["']|["']$/g, "");
      result[key] = value;
      currentKey = key;
    }
  }

  if (!result.name || !result.description) return null;
  return result as SkillFrontmatter;
}

// ─── Skill 资源加载 ───

export interface SkillResource {
  path: string;
  content: string;
}

export interface SkillResources {
  skillMd: string;
  frontmatter: SkillFrontmatter | null;
  references: SkillResource[];
}

/** skillId 仅允许安全标识符，防止路径穿越 */
function isSafeSkillId(skillId: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(skillId);
}

/** 解析后的路径必须仍位于 skills 根目录内 */
function resolveSkillDir(skillId: string): string | null {
  if (!isSafeSkillId(skillId)) return null;
  const skillsRoot = path.resolve(SKILLS_DIR);
  const skillDir = path.resolve(skillsRoot, skillId);
  const prefix = skillsRoot.endsWith(path.sep) ? skillsRoot : skillsRoot + path.sep;
  if (!skillDir.startsWith(prefix)) return null;
  return skillDir;
}

/** 加载 SKILL.md + 目录内所有引用文件（Level 2+3） */
export function loadSkillResources(skillId: string): SkillResources | null {
  const skillDir = resolveSkillDir(skillId);
  if (!skillDir) return null;
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) return null;

  try {
    const skillMd = fs.readFileSync(skillMdPath, "utf-8");
    const frontmatter = parseFrontmatter(skillMd);

    // 递归收集目录下所有 .md 文件（排除 SKILL.md）
    const references: SkillResource[] = [];
    const collectMd = (dir: string, prefix: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          collectMd(fullPath, relPath);
        } else if (entry.name.endsWith(".md") && entry.name !== "SKILL.md") {
          references.push({
            path: relPath,
            content: fs.readFileSync(fullPath, "utf-8"),
          });
        }
      }
    };
    collectMd(skillDir, "");

    return { skillMd, frontmatter, references };
  } catch {
    return null;
  }
}

// ─── Skill 目录（Level 1 元数据） ───

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  hasContent: boolean;
}

/** 返回所有技能的 Level 1 元数据（始终注入 system prompt） */
export function loadSkillCatalog(): SkillCatalogEntry[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".json"));
  const catalog: SkillCatalogEntry[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, file), "utf-8");
      const parsed = JSON.parse(raw) as SlashCommand;
      if (!parsed.id || !parsed.template) continue;

      // 尝试从 SKILL.md frontmatter 获取 name/description
      const resources = loadSkillResources(parsed.id);
      if (resources?.frontmatter) {
        catalog.push({
          id: parsed.id,
          name: resources.frontmatter.name,
          description: resources.frontmatter.description,
          hasContent: true,
        });
      } else {
        // 无 SKILL.md 的内置 command，从 JSON 取
        catalog.push({
          id: parsed.id,
          name: parsed.name,
          description: parsed.description,
          hasContent: false,
        });
      }
    } catch {
      // 跳过解析失败的文件
    }
  }

  return catalog;
}

// ─── Slash Commands 加载（合并 JSON + SKILL.md） ───

export function loadSlashCommands(): SlashCommand[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".json"));
  const commands: SlashCommand[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, file), "utf-8");
      const parsed = JSON.parse(raw) as SlashCommand;
      if (!parsed.id || !parsed.template) continue;

      // SKILL.md frontmatter 覆盖 JSON 的 name/description
      const resources = loadSkillResources(parsed.id);
      if (resources?.frontmatter) {
        parsed.name = resources.frontmatter.name;
        parsed.description = resources.frontmatter.description;
      }

      // name 回退
      if (!parsed.name) parsed.name = parsed.id;

      commands.push(parsed);
    } catch {
      // 跳过解析失败的文件
    }
  }

  return commands;
}

/** 读取 skill 目录下的 SKILL.md 内容（向后兼容） */
export function loadSkillContent(skillId: string): string | null {
  const resources = loadSkillResources(skillId);
  if (!resources) return null;

  // 拼接 SKILL.md + 引用文件
  let content = resources.skillMd;
  if (resources.references.length > 0) {
    content += "\n\n---\n\n## Referenced Files\n\n";
    for (const ref of resources.references) {
      content += `### ${ref.path}\n\n${ref.content}\n\n`;
    }
  }
  return content;
}
