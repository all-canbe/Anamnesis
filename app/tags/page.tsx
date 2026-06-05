"use client";

import { useRouter } from "next/navigation";
import { createTag, removeTag, loadTags } from "./actions";
import { useLanguage } from "@/lib/language-context";
import { useEffect, useState } from "react";

type TagEntry = [string, { label: string; emoji: string }];

export default function TagsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [emojiInput, setEmojiInput] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/tags").then((r) => r.json()),
      fetch("/api/record-counts").then((r) => r.json()),
    ]).then(([tagsData, countsData]) => {
      setTags(Object.entries(tagsData));
      setCounts(countsData);
    });
  }, []);

  async function handleAdd(formData: FormData) {
    await createTag(formData);
    const tagsData = await loadTags();
    setTags(Object.entries(tagsData));
    setKeyInput("");
    setLabelInput("");
    setEmojiInput("");
    setShowModal(false);
  }

  async function handleDelete(key: string) {
    await removeTag(key);
    const tagsData = await loadTags();
    setTags(Object.entries(tagsData));
  }

  return (
    <div className="tags-section">
      <div className="tags-header">
        <h2>{t("tagHeaderTitle")}</h2>
        <p>{t("tagHeaderDesc")}</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          + {t("addTag")}
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("addTag")}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form action={handleAdd} className="modal-form">
              <input
                name="key"
                placeholder={t("tagAddKey")}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="form-input"
                required
              />
              <input
                name="label"
                placeholder={t("tagAddLabel")}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="form-input"
                required
              />
              <input
                name="emoji"
                placeholder={t("tagAddEmoji")}
                value={emojiInput}
                onChange={(e) => setEmojiInput(e.target.value)}
                className="form-input emoji-input"
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t("cancel")}
                </button>
                <button type="submit" className="btn btn-primary">{t("addTag")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tag-grid">
        {tags.map(([key, cat]) => {
          const c = cat as { label: string; emoji: string };
          if (key === "all") return null;
          const count = counts[key] || 0;
          return (
            <div key={key} className="tag-card" onClick={() => router.push(`/?category=${key}`)}>
              <span className="tag-card-name">
                <span className="tag-emoji">{c.emoji}</span>
                {c.label}
              </span>
              <div className="tag-card-right">
                <span className="tag-card-count">{count}</span>
                <button
                  className="tag-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${c.label}"`)) handleDelete(key);
                  }}
                  title={t("delete")}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}