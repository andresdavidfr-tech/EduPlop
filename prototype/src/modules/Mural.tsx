import { useRef, useState } from "react";
import { store, useStore } from "../lib/store";
import type { MuralPost, MuralMedia } from "../lib/types";
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

/** Media de un post, con compatibilidad hacia atrás (posts viejos sólo con `images`). */
function mediaOf(post: MuralPost): MuralMedia[] {
  if (post.media && post.media.length) return post.media;
  return post.images.map((url) => ({ kind: "image", url }));
}

/** Avatar del autor del post: foto de perfil si la tiene, si no su emoji/imagen. */
function AuthorAvatar({ post }: { post: MuralPost }) {
  const photo = post.authorUser ? store.profilePhotoOf(post.authorUser) : undefined;
  if (photo) return <img className="avatar-img mural-av" src={photo} alt={post.authorName} />;
  if (post.authorAvatar.startsWith("http")) return <img className="avatar-img mural-av" src={post.authorAvatar} alt={post.authorName} />;
  return <span className="mural-av emoji" aria-hidden="true">{post.authorAvatar}</span>;
}

export function Mural() {
  useStore();
  const user = store.currentUser();
  const posts = store.muralFeed();
  const canPost = user?.role !== "family";
  const [composing, setComposing] = useState(false);
  const [lightbox, setLightbox] = useState<{ media: MuralMedia[]; i: number } | null>(null);

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
        <p className="muted small">
          {canPost ? "Compartí fotos y videos de la jornada con las familias. 💛" : "Fotos y videos que comparten los docentes del cole. 💛"}
        </p>
        {composing && canPost && <Composer onDone={() => setComposing(false)} />}
      </section>

      {posts.length === 0 && (
        <section className="card span2"><div className="empty">Todavía no hay publicaciones 📷</div></section>
      )}

      {posts.map((p) => (
        <PostCard key={p.id} post={p} liked={!!user && p.likedBy.includes(user.username)}
          onOpen={(media, i) => setLightbox({ media, i })} />
      ))}

      {lightbox && (
        <Lightbox media={lightbox.media} i={lightbox.i}
          onIndex={(i) => setLightbox({ media: lightbox.media, i })}
          onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function PostCard({ post, liked, onOpen }: { post: MuralPost; liked: boolean; onOpen: (media: MuralMedia[], i: number) => void }) {
  const user = store.currentUser();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const media = mediaOf(post);
  const likes = post.likedBy.length;
  const canManage = store.canManageMuralPost(post);

  function send() {
    if (!comment.trim()) return;
    store.addMuralComment(post.id, comment);
    setComment("");
  }

  return (
    <article className="card span2 mural-post">
      <header className="mural-head">
        <AuthorAvatar post={post} />
        <div className="grow">
          <b>{post.authorName}</b>
          <small className="muted">{post.salaName ? `${post.salaName} · ` : ""}{timeAgo(post.ts)}</small>
        </div>
        {canManage && !editing && (
          <div className="mural-manage">
            <button className="ghost small-btn" onClick={() => setEditing(true)}>✏️ Editar</button>
            <button className="ghost small-btn danger" onClick={() => { if (confirm("¿Eliminar esta publicación?")) store.deleteMuralPost(post.id); }}>🗑️ Borrar</button>
          </div>
        )}
      </header>

      {editing ? (
        <Composer post={post} onDone={() => setEditing(false)} />
      ) : (
        <>
          {post.text && <p className="mural-text">{post.text}</p>}
          {media.length > 0 && <MediaGrid media={media} onOpen={(i) => onOpen(media, i)} />}
        </>
      )}

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
          {post.comments.map((c) => {
            const canDelete = !!user && (c.fromUser === user.username || canManage);
            return (
              <li key={c.id}>
                <span><b>{c.fromName}</b> {c.body} <em className="muted">· {timeAgo(c.ts)}</em></span>
                {canDelete && (
                  <button className="cmt-x" title="Borrar comentario" aria-label="Borrar comentario"
                    onClick={() => store.deleteMuralComment(post.id, c.id)}>✕</button>
                )}
              </li>
            );
          })}
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

function MediaGrid({ media, onOpen }: { media: MuralMedia[]; onOpen: (i: number) => void }) {
  const shown = media.slice(0, 4);
  const extra = media.length - shown.length;
  const cls = `mural-photos n${Math.min(shown.length, 4)}`;
  return (
    <div className={cls}>
      {shown.map((m, i) => {
        const isLast = i === shown.length - 1 && extra > 0;
        return (
          <button key={i} className="mural-photo" onClick={() => onOpen(i)} aria-label={`Ver ${m.kind === "video" ? "video" : "foto"} ${i + 1}`}>
            {m.kind === "video"
              ? <video src={m.url} muted playsInline preload="metadata" />
              : <img src={m.url} alt={`Foto ${i + 1}`} loading="lazy" />}
            {m.kind === "video" && !isLast && <span className="mural-play" aria-hidden="true">▶</span>}
            {isLast && <span className="mural-more">+{extra}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Lightbox({ media, i, onIndex, onClose }: { media: MuralMedia[]; i: number; onIndex: (i: number) => void; onClose: () => void }) {
  const prev = () => onIndex((i - 1 + media.length) % media.length);
  const next = () => onIndex((i + 1) % media.length);
  const cur = media[i];
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Cerrar">✕</button>
      {media.length > 1 && <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Anterior">‹</button>}
      {cur.kind === "video"
        ? <video className="lb-img" src={cur.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
        : <img className="lb-img" src={cur.url} alt={`Foto ${i + 1} de ${media.length}`} onClick={(e) => e.stopPropagation()} />}
      {media.length > 1 && <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Siguiente">›</button>}
      {media.length > 1 && <span className="lb-count">{i + 1} / {media.length}</span>}
    </div>
  );
}

function Composer({ onDone, post }: { onDone: () => void; post?: MuralPost }) {
  const isEdit = !!post;
  const user = store.currentUser();
  const allSalas = store.salas();
  const mySalas = user?.role === "director" ? allSalas : allSalas.filter((s) => s.teacherId === user?.teacherId);
  const salaOptions = mySalas.length ? mySalas : allSalas;
  const [text, setText] = useState(post?.text ?? "");
  const [salaId, setSalaId] = useState(post?.salaId ?? "");
  const [media, setMedia] = useState<MuralMedia[]>(post ? mediaOf(post) : []);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setErr(null);
    try {
      for (const f of files) {
        const isVideo = f.type.startsWith("video/");
        const ext = isVideo ? (f.name.split(".").pop() || "mp4") : "jpg";
        let url: string | undefined;
        if (SYNC_ENABLED) {
          // Imágenes: comprimimos a JPG. Videos: subimos el archivo tal cual.
          const blob = isVideo ? f : await compressToBlob(await fileToDataUrl(f), 1280, 0.82);
          if (blob) url = (await uploadPhoto(blob, `mural-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`)) ?? undefined;
        }
        if (!url) {
          // Fallback sin nube (o si falló la subida): data URL local.
          url = isVideo ? await fileToDataUrl(f) : await compressImage(await fileToDataUrl(f), 900, 0.72);
        }
        const item: MuralMedia = { kind: isVideo ? "video" : "image", url };
        setMedia((prev) => [...prev, item]);
      }
    } catch {
      setErr("No se pudo procesar algún archivo. Probá con otro.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function publish() {
    if (!text.trim() && media.length === 0) return;
    if (isEdit && post) store.updateMuralPost(post.id, { text, media, salaId });
    else store.addMuralPost({ text, media, salaId });
    onDone();
  }

  return (
    <div className="event-form">
      <label htmlFor="mp-sala">¿Para qué sala?</label>
      <select id="mp-sala" value={salaId} onChange={(e) => setSalaId(e.target.value)}>
        <option value="">🏫 Toda la escuela</option>
        {salaOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <label htmlFor="mp-text">¿Qué querés compartir?</label>
      <textarea id="mp-text" value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="Contales a las familias qué hicimos hoy…" />
      {media.length > 0 && (
        <div className="mural-thumbs">
          {media.map((m, i) => (
            <span key={i} className="mural-thumb">
              {m.kind === "video"
                ? <video src={m.url} muted playsInline preload="metadata" />
                : <img src={m.url} alt={`Adjunto ${i + 1}`} />}
              {m.kind === "video" && <span className="mural-play sm" aria-hidden="true">▶</span>}
              <button className="mural-thumb-x" onClick={() => setMedia((p) => p.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
            </span>
          ))}
        </div>
      )}
      {err && <div className="login-error" role="alert">{err}</div>}
      <div className="row gap" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
          {uploading ? <><span className="spinner" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />Subiendo…</> : "📷 Fotos / 🎬 Videos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />
        <button className="primary grow" onClick={publish} disabled={uploading || (!text.trim() && media.length === 0)}>{isEdit ? "Guardar cambios" : "Publicar"}</button>
        {isEdit && <button className="ghost" onClick={onDone} disabled={uploading}>Cancelar</button>}
      </div>
    </div>
  );
}
