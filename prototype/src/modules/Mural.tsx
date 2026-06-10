import { useRef, useState } from "react";
import { store, useStore } from "../lib/store";
import type { MuralPost } from "../lib/types";
import { compressImage, compressToBlob, fileToDataUrl } from "../lib/image";
import { uploadPhoto } from "../lib/storage";
import { SYNC_ENABLED } from "../lib/supabaseConfig";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "recién";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(ts).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function Avatar({ src, name }: { src: string; name: string }) {
  if (src.startsWith("http")) return <img className="avatar-img mural-av" src={src} alt={name} />;
  return <span className="mural-av emoji" aria-hidden="true">{src}</span>;
}

export function Mural() {
  const state = useStore();
  const user = store.currentUser();
  const posts = store.muralFeed();
  const canPost = user?.role !== "family";
  const [composing, setComposing] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; i: number } | null>(null);

  return (
    <div className="grid">
      <section className="card span2">
        <div className="row between">
          <h2>🖼️ Mural de novedades</h2>
          {canPost && (
            <button className="ghost" onClick={() => setComposing((v) => !v)}>
              {composing ? "Cerrar" : "+ Publicar"}
            </button>
          )}
        </div>
        <p className="muted small">Fotos y novedades que comparten los docentes del cole. 💛</p>
        {composing && canPost && <Composer onDone={() => setComposing(false)} />}
      </section>

      {posts.length === 0 && (
        <section className="card span2"><div className="empty">Todavía no hay publicaciones 📷</div></section>
      )}

      {posts.map((p) => (
        <PostCard key={p.id} post={p} liked={!!user && p.likedBy.includes(user.username)}
          onOpen={(i) => setLightbox({ images: p.images, i })} />
      ))}

      {lightbox && (
        <Lightbox images={lightbox.images} i={lightbox.i}
          onIndex={(i) => setLightbox({ images: lightbox.images, i })}
          onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function PostCard({ post, liked, onOpen }: { post: MuralPost; liked: boolean; onOpen: (i: number) => void }) {
  const [comment, setComment] = useState("");
  const likes = post.likedBy.length;

  function send() {
    if (!comment.trim()) return;
    store.addMuralComment(post.id, comment);
    setComment("");
  }

  return (
    <article className="card span2 mural-post">
      <header className="mural-head">
        <Avatar src={post.authorAvatar} name={post.authorName} />
        <div className="grow">
          <b>{post.authorName}</b>
          <small className="muted">{post.salaName ? `${post.salaName} · ` : ""}{timeAgo(post.ts)}</small>
        </div>
      </header>

      {post.text && <p className="mural-text">{post.text}</p>}

      {post.images.length > 0 && <PhotoGrid images={post.images} onOpen={onOpen} />}

      <div className="mural-actions">
        <button className={liked ? "like-btn liked" : "like-btn"} onClick={() => store.toggleMuralLike(post.id)}
          aria-pressed={liked}>
          <span aria-hidden="true">{liked ? "❤️" : "🤍"}</span>
          Me gusta{likes > 0 ? ` · ${likes}` : ""}
        </button>
        <span className="muted small">{post.comments.length} comentario{post.comments.length === 1 ? "" : "s"}</span>
      </div>

      {post.comments.length > 0 && (
        <ul className="mural-comments">
          {post.comments.map((c) => (
            <li key={c.id}><b>{c.fromName}</b> {c.body} <em className="muted">· {timeAgo(c.ts)}</em></li>
          ))}
        </ul>
      )}

      <div className="mural-add-comment">
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribí un comentario…"
          onKeyDown={(e) => { if (e.key === "Enter") send(); }} aria-label="Comentario" />
        <button className="ghost" onClick={send} disabled={!comment.trim()}>Enviar</button>
      </div>
    </article>
  );
}

function PhotoGrid({ images, onOpen }: { images: string[]; onOpen: (i: number) => void }) {
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  const cls = `mural-photos n${Math.min(shown.length, 4)}`;
  return (
    <div className={cls}>
      {shown.map((src, i) => {
        const isLast = i === shown.length - 1 && extra > 0;
        return (
          <button key={i} className="mural-photo" onClick={() => onOpen(i)} aria-label={`Ver foto ${i + 1}`}>
            <img src={src} alt={`Foto ${i + 1}`} loading="lazy" />
            {isLast && <span className="mural-more">+{extra} fotos</span>}
          </button>
        );
      })}
    </div>
  );
}

function Lightbox({ images, i, onIndex, onClose }: { images: string[]; i: number; onIndex: (i: number) => void; onClose: () => void }) {
  const prev = () => onIndex((i - 1 + images.length) % images.length);
  const next = () => onIndex((i + 1) % images.length);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Cerrar">✕</button>
      {images.length > 1 && <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Anterior">‹</button>}
      <img className="lb-img" src={images[i]} alt={`Foto ${i + 1} de ${images.length}`} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Siguiente">›</button>}
      {images.length > 1 && <span className="lb-count">{i + 1} / {images.length}</span>}
    </div>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const dataUrl = await fileToDataUrl(f);
        let url: string | undefined;
        if (SYNC_ENABLED) {
          const blob = await compressToBlob(dataUrl, 1024, 0.82);
          if (blob) url = (await uploadPhoto(blob, `mural-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`)) ?? undefined;
        }
        const src = url ?? (await compressImage(dataUrl, 800, 0.72));
        setImages((prev) => [...prev, src]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function publish() {
    if (!text.trim() && images.length === 0) return;
    store.addMuralPost({ text, images });
    onDone();
  }

  return (
    <div className="event-form">
      <label htmlFor="mp-text">¿Qué querés compartir?</label>
      <textarea id="mp-text" value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="Contales a las familias qué hicimos hoy…" />
      {images.length > 0 && (
        <div className="mural-thumbs">
          {images.map((src, i) => (
            <span key={i} className="mural-thumb">
              <img src={src} alt={`Adjunto ${i + 1}`} />
              <button className="mural-thumb-x" onClick={() => setImages((p) => p.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="row gap" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
          {uploading ? <><span className="spinner" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />Subiendo…</> : "📷 Agregar fotos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        <button className="primary grow" onClick={publish} disabled={uploading || (!text.trim() && images.length === 0)}>Publicar</button>
      </div>
    </div>
  );
}
