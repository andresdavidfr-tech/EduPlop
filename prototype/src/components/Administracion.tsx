import { useState } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS as SEED_STUDENTS, TEACHERS as SEED_TEACHERS } from "../lib/seed";
import { CargaAsistida } from "./CargaAsistida";
import type { Turno } from "../lib/types";

const TURNOS: Turno[] = ["mañana", "tarde"];
const KID_EMOJIS = ["🧒", "👧", "👦", "🧑", "👶", "👧🏽", "👦🏽", "🧒🏿"];

const isSeedStudent = (id: string) => SEED_STUDENTS.some((s) => s.id === id);
const isSeedTeacher = (id: string) => SEED_TEACHERS.some((t) => t.id === id);

/**
 * Administración del establecimiento (Dirección): salas/cursos, nómina de
 * docentes, matrícula de alumnos y vínculo de cada alumno/a a su sala.
 * Todo se da de alta acá y se sincroniza entre dispositivos.
 */
export function Administracion() {
  useStore();
  const salas = store.salas();
  const teachers = store.teachers();
  const students = store.students();
  const [newSala, setNewSala] = useState("");
  const [newTurno, setNewTurno] = useState<Turno>("mañana");

  // Familias = tutores primarios con sus hijos
  const familias = new Map<string, string[]>();
  store.guardianships().filter((g) => g.role === "primary_guardian").forEach((l) => {
    const arr = familias.get(l.guardianId) ?? [];
    arr.push(l.studentId);
    familias.set(l.guardianId, arr);
  });

  return (
    <>
      <CargaAsistida />

      {/* SALAS / CURSOS */}
      <section className="card span2">
        <h2>🏫 Salas y cursos</h2>
        <p className="muted small">Definí las salas/cursos, su turno y el docente a cargo. Cada cambio se sincroniza.</p>
        <div className="admin-list">
          {salas.length === 0 && <p className="muted">No hay salas cargadas.</p>}
          {salas.map((s) => (
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
        <div className="row gap wrap" style={{ marginTop: 14 }}>
          <input value={newSala} onChange={(e) => setNewSala(e.target.value)} placeholder="Nueva sala/curso (ej. 2° B)" aria-label="Nueva sala" />
          <select value={newTurno} onChange={(e) => setNewTurno(e.target.value as Turno)} aria-label="Turno de la nueva sala">
            {TURNOS.map((t) => <option key={t} value={t}>Turno {t}</option>)}
          </select>
          <button className="ghost" onClick={() => { store.addSala(newSala, newTurno); setNewSala(""); }}>+ Agregar sala</button>
        </div>
      </section>

      {/* DOCENTES (NÓMINA) */}
      <section className="card span2">
        <h2>🧑‍🏫 Nómina de docentes</h2>
        <p className="muted small">Alta del personal docente. La sala/turno se toma de la asignación de arriba; editá las tareas de cada uno.</p>
        <div className="admin-list">
          {teachers.map((t) => {
            const sala = store.salaOfTeacher(t.id);
            return (
              <div key={t.id} className="admin-row">
                <b className="admin-name">{t.name}</b>
                <span className={`pill ${sala ? "active" : "warn"}`}>{sala ? `${sala.name} · ${sala.turno}` : "Sin sala"}</span>
                <input className="grow" value={store.teacherTasksOf(t.id)} onChange={(e) => store.setTeacherTasks(t.id, e.target.value)} placeholder="Tareas (ej. Maestra de sala, Apoyo, Coordinación…)" aria-label={`Tareas de ${t.name}`} />
                {!isSeedTeacher(t.id) && <button className="link danger" onClick={() => { if (confirm(`¿Dar de baja a ${t.name}?`)) store.deleteTeacher(t.id); }}>Baja</button>}
              </div>
            );
          })}
        </div>
        <AddTeacher />
      </section>

      {/* MATRÍCULA (ALUMNOS) */}
      <section className="card span2">
        <h2>🎓 Matrícula de alumnos</h2>
        <p className="muted small">Alta de alumnos/as y asignación de sala. {students.length} en total.</p>
        <div className="admin-list">
          {students.map((stu) => {
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

      {/* FAMILIAS Y ALUMNOS */}
      <section className="card span2">
        <h2>👨‍👩‍👧 Familias</h2>
        <p className="muted small">Hijos de cada familia y la sala asignada a cada alumno/a.</p>
        {[...familias.entries()].map(([guardianId, studentIds]) => {
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
    <div className="row gap wrap" style={{ marginTop: 14 }}>
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
    <div className="row gap wrap" style={{ marginTop: 14 }}>
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
