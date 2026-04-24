// frontend/src/components/QuestionsDrawer.jsx
//
// Slide-in drawer displaying a candidate's pre-generated interview questions,
// grouped by 5 categories (Hygiene, JD Fit, Resume Verify, CTC, Recruiter Custom).
// Recruiter can add/edit/delete questions per category + regenerate all via LLM.
//
// Used from: JobDetail.jsx candidate row -> "Questions" action button.
//
// Design: matches god-mode dark glass aesthetic. Instrument Serif headings,
// Inter body. Purple->pink gradient accents for primary actions.

import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";

const CATEGORY_META = {
  hygiene: {
    label: "Hygiene",
    emoji: "🏠",
    tagline: "Relocation & shift fit",
    accent: "from-sky-500/20 to-cyan-500/10",
    border: "border-sky-500/30",
  },
  jd_fit: {
    label: "JD Fit",
    emoji: "🎯",
    tagline: "Role-specific screening",
    accent: "from-fuchsia-500/20 to-purple-500/10",
    border: "border-fuchsia-500/30",
  },
  resume_verify: {
    label: "Resume Verify",
    emoji: "📄",
    tagline: "Verifying candidate claims",
    accent: "from-amber-500/20 to-orange-500/10",
    border: "border-amber-500/30",
  },
  ctc: {
    label: "Compensation",
    emoji: "💰",
    tagline: "Current & expected CTC",
    accent: "from-emerald-500/20 to-green-500/10",
    border: "border-emerald-500/30",
  },
  recruiter_custom: {
    label: "Recruiter Questions",
    emoji: "✏️",
    tagline: "Your custom asks",
    accent: "from-rose-500/20 to-pink-500/10",
    border: "border-rose-500/30",
  },
};

const ORDER = ["hygiene", "jd_fit", "resume_verify", "ctc", "recruiter_custom"];


export default function QuestionsDrawer({ candidateId, candidateName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [questions, setQuestions] = useState({});
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  // Per-question local edit state
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // Per-category "add new" state
  const [addingCategory, setAddingCategory] = useState(null);
  const [newText, setNewText] = useState("");

  // --- API ---

  const fetchQuestions = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get(`/questions/candidate/${candidateId}`);
      setQuestions(data.by_category || {});
      setTotal(data.total || 0);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleRegenerate = async () => {
    if (!confirm("Regenerate all questions? This replaces the current set and may take a few seconds.")) {
      return;
    }
    setRegenerating(true);
    setError("");
    try {
      const { data } = await api.post(`/questions/candidate/${candidateId}/generate`);
      setQuestions(data.by_category || {});
      setTotal(data.total || 0);
    } catch (e) {
      setError(e?.response?.data?.detail || "Regeneration failed. Try again in a few seconds.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveEdit = async (qid) => {
    const text = editingText.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    try {
      await api.patch(`/questions/${qid}`, { question_text: text });
      setEditingId(null);
      setEditingText("");
      await fetchQuestions();
    } catch (e) {
      setError(e?.response?.data?.detail || "Edit failed");
    }
  };

  const handleDelete = async (qid) => {
    if (!confirm("Delete this question?")) return;
    try {
      await api.delete(`/questions/${qid}`);
      await fetchQuestions();
    } catch (e) {
      setError(e?.response?.data?.detail || "Delete failed");
    }
  };

  const handleAdd = async (category) => {
    const text = newText.trim();
    if (!text) return;
    try {
      await api.post(`/questions/candidate/${candidateId}`, {
        category,
        question_text: text,
      });
      setNewText("");
      setAddingCategory(null);
      await fetchQuestions();
    } catch (e) {
      setError(e?.response?.data?.detail || "Add failed");
    }
  };

  // --- Render ---

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-[#0b0614]/95 backdrop-blur-xl border-l border-white/10 shadow-[-8px_0_40px_rgba(0,0,0,0.5)] flex flex-col"
        role="dialog"
        aria-label="Interview questions"
      >
        {/* Header */}
        <header className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-brand-300 uppercase tracking-wider mb-1">
                Interview Questions
              </p>
              <h2 className="font-serif text-2xl text-white truncate">
                {candidateName || "Candidate"}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {total} {total === 1 ? "question" : "questions"} ready for interview
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating || loading}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {regenerating ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  Regenerating...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                  Regenerate all
                </>
              )}
            </button>
            <div className="text-xs text-gray-500">
              AI-generated questions tailored to this candidate
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
              {error}
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              Loading questions...
            </div>
          ) : (
            ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const list = questions[cat] || [];
              return (
                <section
                  key={cat}
                  className={`rounded-xl border ${meta.border} bg-gradient-to-br ${meta.accent} p-4`}
                >
                  <header className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      
                      <div>
                        <h3 className="font-serif text-lg text-white">{meta.label}</h3>
                        <p className="text-xs text-gray-400">{meta.tagline}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-300">
                      {list.length}
                    </span>
                  </header>

                  {list.length === 0 && addingCategory !== cat && (
                    <p className="text-sm text-gray-500 italic py-2">
                      No questions in this category yet.
                    </p>
                  )}

                  <ul className="space-y-2">
                    {list.map((q) => {
                      const isEditing = editingId === q.id;
                      return (
                        <li
                          key={q.id}
                          className="group px-3 py-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-white/15 transition"
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-md bg-black/40 border border-brand-500/40 text-sm text-white resize-none focus:outline-none focus:border-brand-400"
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(q.id)}
                                  className="px-3 py-1 rounded-md bg-brand-500 hover:bg-brand-400 text-white text-xs font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditingText("");
                                  }}
                                  className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <span className="shrink-0 text-xs font-mono text-gray-500 mt-0.5">
                                Q{q.position + 1}
                              </span>
                              <p className="flex-1 text-sm text-white leading-relaxed">
                                {q.question_text}
                                {q.is_custom && (
                                  <span
                                    className="ml-2 text-[10px] uppercase tracking-wider text-brand-400 font-medium"
                                    title="Recruiter-customized"
                                  >
                                    custom
                                  </span>
                                )}
                              </p>
                              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  onClick={() => {
                                    setEditingId(q.id);
                                    setEditingText(q.question_text);
                                  }}
                                  className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
                                  title="Edit"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(q.id)}
                                  className="w-7 h-7 rounded-md bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-gray-300 hover:text-rose-300"
                                  title="Delete"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {addingCategory === cat ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder={`New ${meta.label.toLowerCase()} question...`}
                        rows={2}
                        className="w-full px-3 py-2 rounded-md bg-black/40 border border-brand-500/40 text-sm text-white resize-none focus:outline-none focus:border-brand-400"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdd(cat)}
                          className="px-3 py-1 rounded-md bg-brand-500 hover:bg-brand-400 text-white text-xs font-medium"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddingCategory(null);
                            setNewText("");
                          }}
                          className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingCategory(cat)}
                      className="mt-3 w-full py-2 rounded-lg border border-dashed border-white/15 hover:border-brand-400/40 hover:bg-white/5 text-xs text-gray-400 hover:text-brand-300 transition"
                    >
                      + Add {meta.label.toLowerCase()} question
                    </button>
                  )}
                </section>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-white/10 bg-black/40">
          <p className="text-xs text-gray-500 text-center">
            These are the exact questions the AI will ask this candidate during the interview.
          </p>
        </footer>
      </aside>
    </>
  );
}
