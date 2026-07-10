"use client";

import { useEffect, useRef, useMemo } from "react";
import { type SlashCommand, filterCommands } from "@/lib/slash-commands";
import { useLanguage } from "@/lib/language-context";

interface Props {
  filterText: string;
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function SlashCommandPanel({ filterText, selectedIndex, onSelect, anchorRef }: Props) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const { commands, skills } = useMemo(
    () => filterCommands(filterText),
    [filterText]
  );

  const isEmpty = commands.length === 0 && skills.length === 0;
  const showCommands = filterText ? commands.length > 0 : true;
  const showSkills = filterText ? skills.length > 0 : true;

  // Position panel relative to anchor
  useEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const rect = anchor.getBoundingClientRect();
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.bottom = `${window.innerHeight - rect.top}px`;
  }, [anchorRef]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Prevent scroll on body when panel is open
  useEffect(() => {
    return () => {}; // no-op, panel is positioned absolute
  }, []);

  function getItemIndex(cmd: SlashCommand): number {
    if (cmd.group === "command") return commands.indexOf(cmd);
    return commands.length + skills.indexOf(cmd);
  }

  if (isEmpty) {
    return (
      <div ref={panelRef} className="slash-panel">
        <div className="slash-panel-empty">{t("slashNoCommands")}</div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="slash-panel">
      {showCommands && commands.length > 0 && (
        <>
          <div className="slash-panel-group">{t("slashCommands")}</div>
          {commands.map((cmd) => {
            const idx = getItemIndex(cmd);
            return (
              <div
                key={cmd.id}
                ref={idx === selectedIndex ? selectedRef : undefined}
                className={`slash-panel-item${idx === selectedIndex ? " active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur
                  onSelect(cmd);
                }}
              >
                <span className="slash-panel-name">{cmd.name}</span>
                <span className="slash-panel-desc">{cmd.description}</span>
              </div>
            );
          })}
        </>
      )}

      {showSkills && skills.length > 0 && (
        <>
          <div className="slash-panel-group">{t("slashSkills")}</div>
          {skills.map((cmd) => {
            const idx = getItemIndex(cmd);
            return (
              <div
                key={cmd.id}
                ref={idx === selectedIndex ? selectedRef : undefined}
                className={`slash-panel-item${idx === selectedIndex ? " active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(cmd);
                }}
              >
                <span className="slash-panel-name">{cmd.name}</span>
                <span className="slash-panel-desc">{cmd.description}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}