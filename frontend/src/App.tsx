import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { ChatMessage } from './types';

const API_BASE = 'http://127.0.0.1:8000';

// Simple everyday questions anyone can ask
const SIMPLE_HELP_QUESTIONS = [
  '☀️ What should I wear for hot sunny weather?',
  '🌧️ What can I wear so my clothes and feet stay dry in the rain?',
  '❄️ My office AC is freezing cold, what should I wear?',
  '⚠️ What clothes made me uncomfortable before so I can avoid them?',
  '⭐ Show me my most comfortable, easy-to-wear outfits'
];

/**
 * Replaces high-level or confusing buzzwords with everyday plain English
 */
function simplifyJargon(text: string): string {
  return text
    // Replace complex technical titles
    .replace(/Predictive Regret & Risk Shield/gi, 'Mistakes to Avoid & Daily Tips')
    .replace(/Predictive Regret Shield/gi, 'Mistakes to Avoid & Daily Tips')
    .replace(/Tactical Outfit Recommendation/gi, 'What to Wear Today (Best Match)')
    .replace(/Strategic Capsule Expansion(\s*\/\s*Shopping ROI)?/gi, 'Smart Clothes to Buy Next')
    .replace(/The ROI Move/gi, 'Best Value Choice to Buy')
    .replace(/The Microclimate Shift|The Microclimate Trap/gi, 'Handling Cold AC vs Outdoor Heat')
    .replace(/The Puddle & Hem Trap/gi, 'Avoiding Water & Mud Splashes on Pants')
    .replace(/The Linen Crease Factor/gi, 'Wrinkle & Crease Warning');
}

/**
 * Formats bold and italic markers into clean readable text
 */
function renderCleanInline(text: string): React.ReactNode[] {
  const cleaned = simplifyJargon(text);
  const parts = cleaned.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} style={{ color: '#f8fafc', fontWeight: '700' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span key={index} style={{ color: '#38bdf8', fontWeight: '600' }}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

/**
 * Turns plain AI text into clear, easy-to-read cards
 */
function SimpleVisualFormatter({ rawText }: { rawText: string }): React.JSX.Element {
  const lines = rawText.split('\n');
  const renderedElements: React.JSX.Element[] = [];

  let currentSection: 'outfit' | 'mistakes' | 'shopping' | 'general' | null = null;
  let sectionContent: React.JSX.Element[] = [];

  const finishSection = (key: number) => {
    if (sectionContent.length === 0) return;

    if (currentSection === 'outfit') {
      renderedElements.push(
        <div key={`outfit-${key}`} style={styles.outfitBox}>
          <div style={styles.outfitBoxHeader}>
            <span style={{ fontSize: '20px' }}>👕</span>
            <div>
              <strong style={{ fontSize: '15px', color: '#60a5fa' }}>What to Wear Today</strong>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Best matched clothes from your closet</div>
            </div>
          </div>
          <div style={styles.boxBody}>{sectionContent}</div>
        </div>
      );
    } else if (currentSection === 'mistakes') {
      renderedElements.push(
        <div key={`mistakes-${key}`} style={styles.warningBox}>
          <div style={styles.warningBoxHeader}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '15px', color: '#facc15' }}>Mistakes to Avoid & Helpful Tips</strong>
              <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Watch out for these weather and comfort traps</div>
            </div>
          </div>
          <div style={styles.boxBody}>{sectionContent}</div>
        </div>
      );
    } else if (currentSection === 'shopping') {
      renderedElements.push(
        <div key={`shopping-${key}`} style={styles.shoppingBox}>
          <div style={styles.shoppingBoxHeader}>
            <span style={{ fontSize: '20px' }}>🛍️</span>
            <div>
              <strong style={{ fontSize: '15px', color: '#4ade80' }}>Smart Clothes to Buy Next</strong>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Good additions that match many items you already own</div>
            </div>
          </div>
          <div style={styles.boxBody}>{sectionContent}</div>
        </div>
      );
    } else {
      renderedElements.push(
        <div key={`gen-${key}`} style={{ marginBottom: '10px' }}>
          {sectionContent}
        </div>
      );
    }

    sectionContent = [];
    currentSection = null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Section Headings (### 1. Tactical Outfit... or ### 2. Regret Shield...)
    if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
      finishSection(idx);
      const lower = trimmed.toLowerCase();

      if (lower.includes('outfit') || lower.includes('tactical')) {
        currentSection = 'outfit';
      } else if (lower.includes('regret') || lower.includes('shield') || lower.includes('risk')) {
        currentSection = 'mistakes';
      } else if (lower.includes('capsule') || lower.includes('shopping') || lower.includes('roi')) {
        currentSection = 'shopping';
      } else {
        const cleanTitle = simplifyJargon(trimmed.replace(/^#+\s*/, ''));
        renderedElements.push(
          <div key={`header-${idx}`} style={styles.genericSectionHeader}>
            <span>👉</span> {cleanTitle}
          </div>
        );
      }
      return;
    }

    // Detect Clothing Piece lines (e.g. * **Top:** Cotton tee)
    const isGarmentLine = /^\*?\s*\*\*(Top|Bottom|Layer|Shoes):\*\*/i.test(trimmed);
    if (isGarmentLine) {
      const match = trimmed.match(/^\*?\s*\*\*(Top|Bottom|Layer|Shoes):\*\*\s*(.*)/i);
      if (match) {
        const pieceKey = match[1];
        const pieceDetails = match[2];

        const labelMap: Record<string, { icon: string; name: string; color: string }> = {
          Top: { icon: '👕', name: 'Shirt / Top', color: '#38bdf8' },
          Bottom: { icon: '👖', name: 'Pants / Bottom', color: '#c084fc' },
          Layer: { icon: '🧥', name: 'Jacket / Layer', color: '#fbbf24' },
          Shoes: { icon: '👟', name: 'Shoes / Footwear', color: '#34d399' },
        };

        const itemConfig = labelMap[pieceKey] || { icon: '👔', name: pieceKey, color: '#38bdf8' };

        sectionContent.push(
          <div key={`garment-${idx}`} style={styles.pieceCardRow}>
            <div style={{ ...styles.pieceBadge, color: itemConfig.color }}>
              <span>{itemConfig.icon}</span>
              <span>{itemConfig.name}</span>
            </div>
            <div style={styles.pieceText}>
              {renderCleanInline(pieceDetails)}
            </div>
          </div>
        );
        return;
      }
    }

    // Detect Bullet Points
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const content = trimmed.slice(2);
      sectionContent.push(
        <div key={`bullet-${idx}`} style={styles.bulletRow}>
          <span style={styles.bulletSymbol}>•</span>
          <div style={styles.bulletContent}>{renderCleanInline(content)}</div>
        </div>
      );
      return;
    }

    // Regular Sentences
    if (currentSection !== null) {
      sectionContent.push(
        <p key={`p-${idx}`} style={styles.paragraphInBox}>
          {renderCleanInline(trimmed)}
        </p>
      );
    } else {
      renderedElements.push(
        <p key={`lead-${idx}`} style={styles.leadText}>
          {renderCleanInline(trimmed)}
        </p>
      );
    }
  });

  // Finish any leftover section
  finishSection(lines.length + 999);

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{renderedElements}</div>;
}

export default function App(): React.JSX.Element {
  // 'offline' = Simple saved records (no internet)
  // 'rag' = Smart AI helper (uses internet)
  const [mode, setMode] = useState<'offline' | 'rag'>('offline');
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      engine: 'Daily Clothes Helper',
      text: 'Hello! I am here to help you pick the most comfortable clothes for work, hot weather, rainy days, or cold office AC. Tap any question below or type what you need.',
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      engine: mode === 'offline' ? 'Saved Diary' : 'Smart AI',
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const endpoint = mode === 'offline' 
        ? `${API_BASE}/api/chat/offline` 
        : `${API_BASE}/api/chat/rag`;

      // API key is handled directly by the backend environment
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        engine: mode === 'offline' ? 'Saved History Guide' : 'Smart AI Stylist',
        text: data.reply,
        cards: data.cards,
        bullets: data.bullets
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          engine: 'Notice',
          text: `⚠️ Could not complete request: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={{ fontSize: '32px' }}>👕</span>
          <div>
            <h1 style={styles.title}>Daily Clothes Helper</h1>
            <p style={styles.subTitle}>Easy outfit advice for any weather or workday</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={styles.togglePill}>
          <button
            onClick={() => setMode('offline')}
            style={{ ...styles.pillBtn, ...(mode === 'offline' ? styles.pillBtnActive : {}) }}
          >
            🔒 Saved Diary
          </button>
          <button
            onClick={() => setMode('rag')}
            style={{ ...styles.pillBtn, ...(mode === 'rag' ? styles.pillBtnActive : {}) }}
          >
            ✨ Smart AI
          </button>
        </div>
      </header>

      {/* Mode Explanation Banner */}
      <div style={styles.statusBanner}>
        {mode === 'offline' ? (
          <span>🟢 <strong>Saved Mode:</strong> Reading your saved closet history right from your computer. Fast, free, and completely private.</span>
        ) : (
          <span>🔵 <strong>Smart AI Mode:</strong> Connects to online AI to give personalized tips and outfit matching advice.</span>
        )}
      </div>

      {/* Suggested Easy Questions */}
      <div style={styles.chipBar}>
        <span style={styles.chipLabel}>Tap any question:</span>
        {SIMPLE_HELP_QUESTIONS.map((q, idx) => (
          <button key={idx} onClick={() => handleSend(q)} disabled={loading} style={styles.chip}>
            {q}
          </button>
        ))}
      </div>

      {/* Chat Timeline */}
      <div style={styles.chatTimeline}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.messageRow,
              justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{ ...styles.bubble, ...(m.sender === 'user' ? styles.userBubble : styles.botBubble) }}>
              {m.sender === 'assistant' && (
                <div style={styles.engineBadge}>💡 {m.engine}</div>
              )}
              
              {/* Formatted Content with zero confusing jargon */}
              {m.sender === 'assistant' ? (
                <SimpleVisualFormatter rawText={m.text} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{m.text}</div>
              )}

              {/* Offline Mode Bullet points */}
              {m.bullets && m.bullets.length > 0 && (
                <div style={styles.tipsBox}>
                  <div style={styles.tipsBoxTitle}>📌 Useful Things to Know:</div>
                  <ul style={styles.bulletList}>
                    {m.bullets.map((b, i) => (
                      <li key={i} style={styles.bulletItem}>{simplifyJargon(b)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Offline Mode Card Grid */}
              {m.cards && m.cards.length > 0 && (
                <div style={styles.cardGrid}>
                  {m.cards.map((c, i) => (
                    <div key={i} style={styles.outfitCard}>
                      <div style={styles.cardHeader}>
                        <span style={styles.cardId}>Option #{i + 1}</span>
                        {c.overall_score && (
                          <span style={styles.scoreBadge}>Good Score: {c.overall_score}/100</span>
                        )}
                      </div>

                      <div style={styles.cardBody}>
                        <div style={styles.pieceRow}>
                          <span style={styles.pieceLabel}>👕 Shirt / Top:</span>
                          <strong style={styles.pieceVal}>{c.top || 'None'}</strong>
                        </div>
                        <div style={styles.pieceRow}>
                          <span style={styles.pieceLabel}>👖 Pants / Bottom:</span>
                          <strong style={styles.pieceVal}>{c.bottom || 'None'}</strong>
                        </div>
                        <div style={styles.pieceRow}>
                          <span style={styles.pieceLabel}>👟 Shoes:</span>
                          <span style={styles.pieceVal}>{c.shoes || 'None'}</span>
                        </div>

                        {c.layer && (
                          <div style={styles.pieceRow}>
                            <span style={styles.pieceLabel}>🧥 Jacket / Sweater:</span>
                            <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{c.layer}</span>
                          </div>
                        )}

                        <div style={styles.cardFooter}>
                          <span>Season: {c.season || 'Any'}</span>
                          {c.comfort_rating && (
                            <span style={{ color: '#facc15' }}> • Comfort: {'★'.repeat(Number(c.comfort_rating))}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={{ ...styles.bubble, ...styles.botBubble, color: '#94a3b8' }}>
              ⏳ Checking your clothes records... Please wait a moment.
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} style={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question (e.g. 'What should I wear for heavy rain?')..."
          style={styles.chatInput}
        />
        <button type="submit" disabled={loading || !input.trim()} style={styles.sendButton}>
          Ask
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #1e293b',
    paddingBottom: '12px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  brand: { display: 'flex', alignItems: 'center', gap: '10px' },
  title: { margin: 0, fontSize: '20px', fontWeight: 'bold' },
  subTitle: { margin: '2px 0 0', fontSize: '13px', color: '#94a3b8' },
  togglePill: { display: 'flex', backgroundColor: '#1e293b', padding: '4px', borderRadius: '24px', border: '1px solid #334155' },
  pillBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  pillBtnActive: { backgroundColor: '#0284c7', color: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  statusBanner: {
    backgroundColor: '#1e293b',
    padding: '10px 14px',
    borderRadius: '8px',
    marginTop: '10px',
    fontSize: '13px',
    color: '#cbd5e1',
    borderLeft: '4px solid #38bdf8'
  },
  chipBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    padding: '10px 0',
    marginTop: '4px'
  },
  chipLabel: { fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 'bold' },
  chip: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  chatTimeline: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '12px 0'
  },
  messageRow: { display: 'flex', width: '100%' },
  bubble: { maxWidth: '90%', padding: '16px 18px', borderRadius: '14px', fontSize: '14px' },
  userBubble: { backgroundColor: '#0284c7', color: '#ffffff', borderBottomRightRadius: '2px' },
  botBubble: { backgroundColor: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderBottomLeftRadius: '2px' },
  engineBadge: { fontSize: '12px', color: '#38bdf8', marginBottom: '8px', fontWeight: 'bold' },

  // Clean Typography
  leadText: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#e2e8f0'
  },
  paragraphInBox: {
    margin: '6px 0 2px 0',
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#d4d4d8'
  },
  genericSectionHeader: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#38bdf8',
    margin: '10px 0 6px 0'
  },

  // Recommended Outfit Card (Blue Box)
  outfitBox: {
    backgroundColor: '#0f172a',
    border: '1px solid #2563eb',
    borderRadius: '10px',
    padding: '14px',
    margin: '10px 0'
  },
  outfitBoxHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '8px',
    marginBottom: '10px'
  },

  // Mistakes to Avoid (Yellow/Amber Warning Box)
  warningBox: {
    backgroundColor: '#18181b',
    border: '1px solid #eab308',
    borderRadius: '10px',
    padding: '14px',
    margin: '10px 0'
  },
  warningBoxHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #27272a',
    paddingBottom: '8px',
    marginBottom: '10px'
  },

  // Smart Clothes to Buy Next (Green Box)
  shoppingBox: {
    backgroundColor: '#0f172a',
    border: '1px solid #16a34a',
    borderRadius: '10px',
    padding: '14px',
    margin: '10px 0'
  },
  shoppingBoxHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '8px',
    marginBottom: '10px'
  },

  boxBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  // Garment Piece Badges
  pieceCardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#1e293b',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #334155'
  },
  pieceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    minWidth: '120px'
  },
  pieceText: {
    fontSize: '13px',
    color: '#f8fafc',
    flex: 1
  },

  // Bullet Point Rows
  bulletRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#e2e8f0',
    marginBottom: '4px'
  },
  bulletSymbol: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: '16px',
    lineHeight: '1'
  },
  bulletContent: {
    flex: 1
  },

  // Offline Mode Boxes & Cards
  tipsBox: {
    backgroundColor: '#0f172a',
    padding: '10px 14px',
    borderRadius: '8px',
    marginTop: '10px',
    border: '1px solid #1e293b'
  },
  tipsBoxTitle: { fontSize: '13px', fontWeight: 'bold', color: '#facc15', marginBottom: '6px' },
  bulletList: { margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#cbd5e1' },
  bulletItem: { marginBottom: '4px', lineHeight: '1.4' },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '10px',
    marginTop: '12px'
  },
  outfitCard: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '6px',
    marginBottom: '8px'
  },
  cardId: { fontWeight: 'bold', color: '#38bdf8', fontSize: '13px' },
  scoreBadge: { backgroundColor: '#14532d', color: '#86efac', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '6px' },
  pieceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pieceLabel: { color: '#94a3b8', fontSize: '12px' },
  pieceVal: { color: '#f8fafc', fontWeight: 'bold' },
  cardFooter: {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px dashed #1e293b',
    fontSize: '11px',
    color: '#94a3b8',
    display: 'flex',
    justifyContent: 'space-between'
  },

  // Bottom Input Bar
  inputArea: {
    display: 'flex',
    gap: '10px',
    paddingTop: '12px',
    borderTop: '2px solid #1e293b'
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none'
  },
  sendButton: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 24px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};