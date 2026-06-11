import { useRef, useState } from "react";
import { store, useStore } from "../lib/store";
import { Modal } from "../ui/Modal";
import { compressImage, fileToDataUrl } from "../lib/image";

function initials(name?: string) {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Avatar circular: muestra la foto de perfil del usuario o sus iniciales. */
export function ProfileAvatar({ username, name, size = 36 }: { username?: string; name?: string; size?: number }) {
  useStore(); // re-render al cambiar fotos
  const photo = store.profilePhotoOf(username);
  if (photo) {
    return <img className="pfp" src={photo} alt={name ?? "Foto de perfil"} style={{ width: size, height: size }} />;
  }
  return (
    <span className="pfp pfp-ph" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {initials(name) || "🙂"}
    </span>
  );
}

/** Botón de avatar (usuario actual) que abre el editor de foto de perfil. */
export function ProfilePhotoButton() {
  useStore();
  const user = store.currentUser();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      <button className="pfp-btn" onClick={() => setOpen(true)} title="Editar foto de perfil" aria-label="Editar foto de perfil">
        <ProfileAvatar username={user.username} name={user.name} size={38} />
        <span className="pfp-edit" aria-hidden="true">✎</span>
      </button>
      {open && <ProfilePhotoModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ProfilePhotoModal({ onClose }: { onClose: () => void }) {
  useStore();
  const user = store.currentUser();
  const current = store.myProfilePhoto();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true); setErr(null);
    try {
      // El avatar se guarda como imagen compacta dentro del estado (sincronizado),
      // sin depender de un bucket de Storage: así siempre se guarda y se muestra.
      const dataUrl = await fileToDataUrl(f);
      let img = await compressImage(dataUrl, 256, 0.75);
      if (!img || img.length < 64) img = dataUrl; // por si la compresión no aplica
      store.setProfilePhoto(img);
    } catch {
      setErr("No se pudo procesar la imagen. Probá con otra (JPG o PNG).");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Modal label="Foto de perfil" onClose={onClose}>
      <div className="pfp-editor">
        <ProfileAvatar username={user?.username} name={user?.name} size={120} />
        <p className="muted small" style={{ textAlign: "center" }}>
          Tu foto de perfil ayuda a que docentes, familias y dirección se reconozcan. La ven todos.
        </p>
        {err && <div className="login-error" role="alert">{err}</div>}
        <div className="row gap" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <button className="primary" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
            {uploading ? <><span className="spinner" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />Subiendo…</> : (current ? "📷 Cambiar foto" : "📷 Subir foto")}
          </button>
          {current && <button className="ghost danger" onClick={() => store.removeProfilePhoto()} disabled={uploading}>Quitar</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </Modal>
  );
}
