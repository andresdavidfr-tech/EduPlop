import { useState } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS as SEED_STUDENTS, TEACHERS as SEED_TEACHERS } from "../lib/seed";
import { CargaAsistida } from "./CargaAsistida";
import type { Turno } from "../lib/types";

const TURNOS: Turno[] = ["mañana", "tarde"];
const KID_EMOJIS = ["🧒", "👧", "👦", "🧑", "👶", "👧🏽", "👦🏽", "🧒🏿"];

const isSeedStudent = (id: string) => SEED_STUDENTS.some((s) => s.id === id);
const isSeedTeacher = (id: string) => SEED_TEACHERS.some((t) => t.id === id);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Administración del establecimiento (Dirección): resumen, salas, nómina,
 * matrícula y familias. Cada sección tiene su color, filtros para acotar la
 * vista y se sincroniza entre dispositivos.
 */
export function Administracion() {
  useStore();
  const salas = store.salas();
  const teachers = store.teachers();
  const students = store.students();

  // alta de sala
  const [newSala, setNewSala] = useState("");
  const [newTurno, setNewTurno] = useState<Turno>("mañana");

  // filtros
  const [turnoF, setTurnoF] = useState<"all" | Turno>("all");
  const [docQ, setDocQ] = useState("");
  const [aluQ, setAluQ] = useState("");
  const [aluSala, setAluSala] = useState<"all" | "none" | string>("all");
  const [famQ, setFamQ] = useState("");

  // Familias = tutores primarios con sus hijos
  const familias = new Map<string, string[]>();
  store.guardianships().filter((g) => g.role === "primary_guardian").forEach((l) => {
    const arr = familias.get(l.guardianId) ?? [];
    arr.push(l.studentId);
    familias.set(l.guardianId, arr);
  });

  const salasF = turnoF === "all" ? salas : salas.filter((s) => s.turno === turnoF);
  const teachersF = teachers.filter((t) => norm(t.name).includes(norm(docQ)));
  const studentsF = students.filter((stu) => {
    if (aluQ && !norm(`${stu.name} ${stu.document}`).includes(norm(aluQ))) return false;
    const sid = store.salaOfStudent(stu.id)?.id ?? "";
    if (aluSala === "none") return !sid;
    if (aluSala !== "all") return sid === aluSala;
    return true;
  });
  const famEntries = [...familias.entries()].filter(([gid]) => {
    if (!famQ) return true;
    const fam = store.guardianById(gid);
    return norm(fam?.name ?? "").includes(norm(famQ));
  });

  return (
    <>
      {/* RESUMEN / NAVEGACIÓN RÁPIDA */}
      <section className="card span2 adm adm--overview">
        <h2>🗂️ Administración del establecimiento</h2>
        <p className="muted small">Un panel por tema. Tocá un número para saltar a su sección.</p>
        <div className="adm-overview-grid">
          <button className="adm-stat s-salas" onClick={() => scrollTo("adm-salas")}><b>{salas.length}</b><span>🏫 Salas</span></button>
          <button className="adm-stat s-doc" onClick={() => scrollTo("adm-docentes")}><b>{teachers.length}</b><span>🧑‍🏫 Docentes</span></button>
          <button className="adm-stat s-alu" onClick={() => scrollTo("adm-alumnos")}><b>{students.length}</b><span>🎓 Alumnos</span></button>
          <button className="adm-stat s-fam" onClick={() => scrollTo("adm-familias")}><b>{familias.size}</b><span>👨‍👩‍👧 Familias</span></button>
        </div>
      </section>

      {/* SALAS / CURSOS */}
      <section id="adm-salas" className="card span2 adm adm--salas">
        <h2>🏫 Salas y cursos</h2>
        <div className="adm-filters">
          <span className="muted small">Turno:</span>
          <div className="seg adm-seg">
            {(["all", "mañana", "tarde"] as const).map((t) => (
              <button key={t} className={turnoF === t ? "seg-btn active" : "seg-btn"} onClick={() => setTurnoF(t)}>
                {t === "all" ? "Todos" : `Turno ${t}`}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-list">
          {salasF.length === 0 && <p className="muted">No hay salas para este filtro.</p>}
          {salasF.map((s) => (
            <div key={s.id} className="admin-row">
              <input className="admin-name" value={s.name} onChange={(e) => store.updateSala(s.id, { name: e.target.value })} aria-label="Nombre de la sala" />
              <select value={s.turno} onChange={(e) => store.updateSala(s.id, { turno: e.target.value as Turno })} aria-label="Turno">
                {TURNOS.map((t) => <option key={t} value={t}>Turno {t}</option>)}
              </select>
              <select value={s.teacherId ?? ""} onChange={(e) => store.updateSala(s.id, { teacherId: e.target.value || undefined })} aria-label="Docente a cargo">
                <option value="">— Sin docente —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="pill">{store.studentsOfSala(s.id).length} alumno(s)</span>
              <button className="link danger" onClick={() => { if (confirm(`¿Eliminar la sala "${s.name}"?`)) store.deleteSala(s.id); }}>Eliminar</button>
            </div>
          ))}
        </div>
        <div className="row gap wrap adm-add">
          <input value={newSala} onChange={(e) => setNewSala(e.target.value)} placeholder="Nueva sala/curso (ej. 2° B)" aria-label="Nueva sala" />
          <select value={newTurno} onChange={(e) => setNewTurno(e.target.value as Turno)} aria-label="Turno de la nueva sala">
            {TURNOS.map((t) => <option key={t} value={t}>Turno {t}</option>)}
          </select>
          <button className="ghost" onClick={() => { store.addSala(newSala, newTurno); setNewSala(""); }}>+ Agregar sala</button>
        </div>
      </section>

      {/* DOCENTES (NÓMINA) */}
      <section id="adm-docentes" className="card span2 adm adm--docentes">
        <h2>🧑‍🏫 Nómina de docentes</h2>
        <div className="adm-filters">
          <input className="adm-search" value={docQ} onChange={(e) => setDocQ(e.target.value)} placeholder="🔎 Buscar docente…" aria-label="Buscar docente" />
          <span className="muted small">{teachersF.length} de {teachers.length}</span>
        </div>
        <div className="admin-list">
          {teachersF.length === 0 && <p className="muted">Sin resultados.</p>}
          {teachersF.map((t) => {
            const sala = store.salaOfTeacher(t.id);
            return (
              <div key={t.id} className="admin-row">
                <b className="admin-name">{t.name}</b>
                <span className={`pill ${sala ? "active" : "warn"}`}>{sala ? `${sala.name} · ${sala.turno}` : "Sin sala"}</span>
                <input className="grow" value={store.teacherTasksOf(t.id)} onChange={(e) => store.setTeacherTasks(t.id, e.target.value)} placeholder="Tareas (ej. Maestra de sala, Apoyo…)" aria-label={`Tareas de ${t.name}`} />
                {!isSeedTeacher(t.id) && <button className="link danger" onClick={() => { if (confirm(`¿Dar de baja a ${t.name}?`)) store.deleteTeacher(t.id); }}>Baja</button>}
              </div>
            );
          })}
        </div>
        <AddTeacher />
      </section>

      {/* MATRÍCULA (ALUMNOS) */}
      <section id="adm-alumnos" className="card span2 adm adm--alumnos">
        <h2>🎓 Matrícula de alumnos</h2>
        <div className="adm-filters">
          <input className="adm-search" value={aluQ} onChange={(e) => setAluQ(e.target.value)} placeholder="🔎 Buscar por nombre o DNI…" aria-label="Buscar alumno" />
          <select value={aluSala} onChange={(e) => setAluSala(e.target.value)} aria-label="Filtrar por sala" className="adm-filter-sel">
            <option value="all">Todas las salas</option>
            <option value="none">Sin sala asignada</option>
            {salas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="muted small">{studentsF.length} de {students.length}</span>
        </div>
        <div className="admin-list">
          {studentsF.length === 0 && <p className="muted">Sin resultados.</p>}
          {studentsF.map((stu) => {
            const salaId = store.salaOfStudent(stu.id)?.id ?? "";
            return (
              <div key={stu.id} className="admin-row">
                <span className="admin-name">{stu.emoji} {stu.name} <span className="muted small">· Doc. {stu.document}</span></span>
                <select value={salaId} onChange={(e) => store.assignStudentSala(stu.id, e.target.value)} aria-label={`Sala de ${stu.name}`}>
                  <option value="">— Sin sala —</option>
                  {salas.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.turno})</option>)}
                </select>
                {!isSeedStudent(stu.id) && <button className="link danger" onClick={() => { if (confirm(`¿Dar de baja a ${stu.name}?`)) store.deleteStudent(stu.id); }}>Baja</button>}
              </div>
            );
          })}
        </div>
        <AddStudent />
      </section>

      {/* FAMILIAS */}
      <section id="adm-familias" className="card span2 adm adm--familias">
        <h2>👨‍👩‍👧 Familias</h2>
        <div className="adm-filters">
          <input className="adm-search" value={famQ} onChange={(e) => setFamQ(e.target.value)} placeholder="🔎 Buscar familia…" aria-label="Buscar familia" />
          <span className="muted small">{famEntries.length} de {familias.size}</span>
        </div>
        {famEntries.length === 0 && <p className="muted">Sin resultados.</p>}
        {famEntries.map(([guardianId, studentIds]) => {
          const fam = store.guardianById(guardianId);
          return (
            <div key={guardianId} className="fam-block">
              <div className="fam-head">{fam?.emoji} <b>{fam?.name}</b> <span className="muted small">· {fam?.relation} · Doc. {fam?.document}</span></div>
              {studentIds.map((sid) => {
                const stu = store.studentById(sid);
                const salaId = store.salaOfStudent(sid)?.id ?? "";
                return (
                  <div key={sid} className="admin-row">
                    <span className="admin-name">{stu?.emoji} {stu?.name} <span className="muted small">· Doc. {stu?.document}</span></span>
                    <select value={salaId} onChange={(e) => store.assignStudentSala(sid, e.target.value)} aria-label={`Sala de ${stu?.name}`}>
                      <option value="">— Sin sala —</option>
                      {salas.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.turno})</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {/* CARGA ASISTIDA (herramienta) */}
      <CargaAsistida />
    </>
  );
}

function AddTeacher() {
  const [name, setName] = useState("");
  function add() {
    if (!name.trim()) return;
    store.addTeacher({ name });
    setName("");
  }
  return (
    <div className="row gap wrap adm-add">
      <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del/la docente (ej. Doc. Gómez)" aria-label="Nombre del docente"
        onKeyDown={(e) => e.key === "Enter" && add()} />
      <button className="ghost" onClick={add}>+ Agregar docente</button>
    </div>
  );
}

function AddStudent() {
  const salas = store.salas();
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [emoji, setEmoji] = useState(KID_EMOJIS[0]);
  const [salaId, setSalaId] = useState("");
  function add() {
    if (!name.trim()) return;
    store.addStudent({ name, document, emoji, salaId: salaId || undefined });
    setName(""); setDocument(""); setSalaId("");
  }
  return (
    <div className="row gap wrap adm-add">
      <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji del alumno" style={{ width: "auto" }}>
        {KID_EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" aria-label="Nombre del alumno" />
      <input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="DNI" aria-label="DNI del alumno" />
      <select value={salaId} onChange={(e) => setSalaId(e.target.value)} aria-label="Sala del alumno">
        <option value="">— Sin sala —</option>
        {salas.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.turno})</option>)}
      </select>
      <button className="ghost" onClick={add}>+ Agregar alumno/a</button>
    </div>
  );
}
