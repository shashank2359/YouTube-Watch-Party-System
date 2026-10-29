import { useEffect, useRef, useState } from 'react';
import { Send, Smile } from 'lucide-react';

const EMOJIS = ['😂', '❤️', '🔥', '👏', '😍', '🍿', '😮', '🙌'];

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RoomChat({ messages, me, onSend }) {
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const result = await onSend(text);
    if (result?.ok) setDraft('');
    setSending(false);
  };

  const addEmoji = (emoji) => {
    setDraft((value) => `${value}${emoji}`.slice(0, 500));
    setEmojiOpen(false);
  };

  return (
    <section className="wt-chat" aria-label="Room chat">
      <div className="wt-chat__header">
        <div>
          <p className="wt-chat__eyebrow">THE GROUP CHAT</p>
          <h2>Say something <span aria-hidden="true">✦</span></h2>
        </div>
        <span className="wt-chat__count">{messages.length} messages</span>
      </div>

      <div className="wt-chat__messages" ref={listRef} role="log" aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="wt-chat__empty">
            <span className="wt-chat__empty-emoji" aria-hidden="true">🍿</span>
            <strong>It's a little quiet in here.</strong>
            <p>Drop a message or send the first reaction.</p>
          </div>
        ) : messages.map((message) => {
          const own = message.userId === me?.userId;
          return (
            <article className={`wt-chat__message${own ? ' is-own' : ''}`} key={message.id}>
              <div className="wt-chat__avatar" aria-hidden="true">{Array.from(message.username || '?')[0].toUpperCase()}</div>
              <div className="wt-chat__bubble-wrap">
                <div className="wt-chat__meta">
                  <strong>{own ? 'You' : message.username}</strong>
                  <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time>
                </div>
                <p className="wt-chat__bubble">{message.text}</p>
              </div>
            </article>
          );
        })}
      </div>

      {emojiOpen && (
        <div className="wt-chat__emoji-picker" aria-label="Choose an emoji">
          {EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => addEmoji(emoji)} aria-label={`Insert ${emoji}`}>{emoji}</button>)}
        </div>
      )}

      <form className="wt-chat__composer" onSubmit={submit}>
        <button className="wt-chat__emoji-toggle" type="button" onClick={() => setEmojiOpen((open) => !open)} aria-label="Toggle emoji picker" aria-expanded={emojiOpen}>
          <Smile size={19} />
        </button>
        <input value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} maxLength={500} placeholder="Send a message…" aria-label="Chat message" />
        <button className="wt-chat__send" type="submit" disabled={!draft.trim() || sending} aria-label="Send message"><Send size={17} /></button>
      </form>
      <p className="wt-chat__hint">Be kind. Messages are shared with everyone in this room.</p>
    </section>
  );
}
