import { useState } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS, TEACHERS } from "../lib/seed";
import type { Turno } from "../lib/types";

const TURNOS: Turno[] = ["mañana", "tarde"];

/**
 * Administración del establecimiento (Dirección): salas/cursos con su turno y
 * docente, tareas de cada docente, y vínculo de cada alumno/a a su sala dentro
 * de su familia. Todo se sincroniza entre dispositivos.
 */
export function Administracion() {
  useStore();
  const salas = store.salas();
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
                {TEACHERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

      {/* DOCENTES */}
      <section className="card span2">
        <h2>🧑‍🏫 Docentes</h2>
        <p className="muted small">Sala y turno se toman de la asignación de arriba. Editá las tareas de cada docente.</p>
        <div className="admin-list">
          {TEACHERS.map((t) => {
            const sala = store.salaOfTeacher(t.id);
            return (
              <div key={t.id} className="admin-row">
                <b className="admin-name">{t.name}</b>
                <span className={`pill ${sala ? "active" : "warn"}`}>{sala ? `${sala.name} · ${sala.turno}` : "Sin sala"}</span>
                <input className="grow" value={store.teacherTasksOf(t.id)} onChange={(e) => store.setTeacherTasks(t.id, e.target.value)} placeholder="Tareas (ej. Maestra de sala, Apoyo, Coordinación…)" aria-label={`Tareas de ${t.name}`} />
              </div>
            );
          })}
        </div>
      </section>

      {/* FAMILIAS Y ALUMNOS */}
      <section className="card span2">
        <h2>👨‍👩‍👧 Familias y alumnos</h2>
        <p className="muted small">Hijos de cada familia y la sala asignada a cada alumno/a.</p>
        {[...familias.entries()].map(([guardianId, studentIds]) => {
          const fam = store.guardianById(guardianId);
          return (
            <div key={guardianId} className="fam-block">
              <div className="fam-head">{fam?.emoji} <b>{fam?.name}</b> <span className="muted small">· {fam?.relation} · Doc. {fam?.document}</span></div>
              {studentIds.map((sid) => {
                const stu = STUDENTS.find((s) => s.id === sid);
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
