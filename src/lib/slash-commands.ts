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

/** Default slash command registry. */
export const SLASH_COMMANDS: SlashCommand[] = [];

/** Filter commands by search text. Returns grouped results. */
export function filterCommands(
  commands: SlashCommand[],
  search: string
): { commands: SlashCommand[]; skills: SlashCommand[] } {
  if (!search) {
    return {
      commands: commands.filter((c) => c.group === "command"),
      skills: commands.filter((c) => c.group === "skill"),
    };
  }

  const q = search.toLowerCase();
  const match = (c: SlashCommand) =>
    c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);

  return {
    commands: commands.filter((c) => c.group === "command" && match(c)),
    skills: commands.filter((c) => c.group === "skill" && match(c)),
  };
}
