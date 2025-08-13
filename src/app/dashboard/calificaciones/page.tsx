"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getHeaderBgClass, getHeaderBorderClass, getTitleTextClass, getBodyTextClass } from '@/lib/ui-colors';
import { Badge } from '@/components/ui/badge';

// Tipos básicos
type TestGrade = {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  score: number; // 0-100
  courseId: string | null;
  sectionId: string | null;
  subjectId: string | null;
  title?: string;
  gradedAt: number;
}

type Course = { id: string; name: string };
type Section = { id: string; name: string; courseId: string };

type Subject = { id: string; name: string };

type Option = { value: string; label: string };

type Task = {
  id: string;
  title: string;
  description: string;
  subject: string;
  // IDs opcionales que pueden venir en distintas fuentes del LS
  subjectId?: string | null;
  course: string;
  courseId?: string | null;
  assignedById: string;
  assignedByName: string;
  assignedTo: 'course' | 'student';
  assignedStudentIds?: string[];
  dueDate: string;
  createdAt: string;
  // Algunas fuentes usan startAt/openAt; se soportan como opcionales
  startAt?: string;
  openAt?: string;
  sectionId?: string | null;
  status: 'pending' | 'submitted' | 'reviewed' | 'delivered' | 'finished';
  priority: 'low' | 'medium' | 'high';
  taskType: 'tarea' | 'evaluacion' | 'prueba';
  topic?: string;
  numQuestions?: number;
  timeLimit?: number;
}

type PendingTask = {
  taskId: string;
  title: string;
  taskType: 'tarea' | 'evaluacion' | 'prueba';
  createdAt: string;
  subject: string;
  course: string;
  courseId?: string | null;
  sectionId?: string | null;
  assignedTo: 'course' | 'student';
  assignedStudentIds?: string[];
  columnIndex: number; // N1=0, N2=1, etc.
  topic?: string;
}

function loadJson<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } }

export default function GradesPage() {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const COLOR = 'indigo' as const;
  // Tick para forzar recomputar memos basados en localStorage
  const [refreshTick, setRefreshTick] = useState(0);

  // Helper de traducción con fallback: si translate devuelve la clave o un valor vacío, usa el fallback
  const tr = (key: string, fallback: string) => {
    try {
      const val = translate(key);
      if (!val || val === key) return fallback;
      return val;
    } catch {
      return fallback;
    }
  };

  // Datos base
  const [grades, setGrades] = useState<TestGrade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);

  // Filtros (combinar curso+sección en un solo filtro usando sectionId)
  const [levelFilter, setLevelFilter] = useState<'all' | 'basica' | 'media'>('all');
  const [comboSectionId, setComboSectionId] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [semester, setSemester] = useState<'all' | '1' | '2'>('2');
  // Calendario de semestres (configurable en Admin)
  type SemestersCfg = { first: { start: string; end: string }; second: { start: string; end: string } };
  const [semestersCfg, setSemestersCfg] = useState<SemestersCfg | null>(null);
  const SEM_KEY = 'smart-student-semesters';

  // Estado de cascada
  const [cascadeCourseId, setCascadeCourseId] = useState<string | null>(null);
  const [cascadeSectionId, setCascadeSectionId] = useState<string | null>(null);
  const [cascadeSubject, setCascadeSubject] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState<'all' | string>('all');

  // Carga inicial
  useEffect(() => {
    // Cargar y limpiar cualquier nota de demostración (testId que comienza con 'demo-')
    const loaded = loadJson<TestGrade[]>('smart-student-test-grades', []);
    const cleaned = Array.isArray(loaded)
      ? loaded.filter(g => !String(g?.testId || '').startsWith('demo-'))
      : [];
    if (cleaned.length !== loaded.length) {
      try {
        localStorage.setItem('smart-student-test-grades', JSON.stringify(cleaned));
        // Notificar a otros listeners en la app
        try { window.dispatchEvent(new StorageEvent('storage', { key: 'smart-student-test-grades', newValue: JSON.stringify(cleaned) })); } catch {}
      } catch {}
    }
    setGrades(cleaned);
    setCourses(loadJson<Course[]>('smart-student-courses', []));
    setSections(loadJson<Section[]>('smart-student-sections', []));
    setSubjects(loadJson<Subject[]>('smart-student-subjects', []));
    // Datos reales de Gestión de Usuarios (admin): usuarios + asignaciones estudiantes
    setUsers(loadJson<any[]>('smart-student-users', []));
    setStudentAssignments(loadJson<any[]>('smart-student-student-assignments', []));

    // Cargar tareas pendientes de calificación
    loadPendingTasks();
    
    // Sincronizar calificaciones de tareas con el sistema de calificaciones
    syncTaskGrades();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'smart-student-test-grades' && e.newValue) {
        try { setGrades(JSON.parse(e.newValue)); } catch {}
        // Recalcular pendientes ya que puede que una tarea quede calificada
        loadPendingTasks();
        setRefreshTick(t => t + 1);
      }
      // Escuchar cambios en comentarios de tareas para sincronizar calificaciones
      if (e.key === 'smart-student-task-comments') {
        syncTaskGrades();
        setRefreshTick(t => t + 1);
      }
      // Recargar tareas pendientes si se modifican las tareas
      if (e.key === 'smart-student-tasks') {
        // Al cambiar tareas (incluye evaluationResults), sincronizar calificaciones
        syncTaskGrades();
        loadPendingTasks();
        setRefreshTick(t => t + 1);
      }
      // Recargar si se modifican evaluaciones
      if (e.key === 'smart-student-evaluations') {
        loadPendingTasks();
        setRefreshTick(t => t + 1);
      }
      // Resultados de evaluaciones de estudiantes (deben reflejarse como notas)
      if (e.key === 'smart-student-evaluation-results') {
        try { syncTaskGrades(); } catch {}
        loadPendingTasks();
        setRefreshTick(t => t + 1);
      }
      // Reaccionar a creación/edición de Pruebas (historial por usuario)
      if (e.key && e.key.startsWith('smart-student-tests')) {
        loadPendingTasks();
        setRefreshTick(t => t + 1);
      }
      // Actualizar calendario de semestres si cambia desde Admin
      if (e.key === SEM_KEY && e.newValue) {
        try { setSemestersCfg(JSON.parse(e.newValue)); setRefreshTick(t => t + 1); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    // Cargar calendario inicial
    try { const raw = localStorage.getItem(SEM_KEY); if (raw) setSemestersCfg(JSON.parse(raw)); } catch {}
    // Eventos personalizados del flujo de evaluación/pruebas
    const onEvaluationCompleted = () => {
      try { syncTaskGrades(); } catch {}
      loadPendingTasks();
      setRefreshTick(t => t + 1);
    };
    const onTaskNotificationsUpdated = () => setRefreshTick(t => t + 1);
    window.addEventListener('evaluationCompleted', onEvaluationCompleted as any);
    window.addEventListener('taskNotificationsUpdated', onTaskNotificationsUpdated as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('evaluationCompleted', onEvaluationCompleted as any);
      window.removeEventListener('taskNotificationsUpdated', onTaskNotificationsUpdated as any);
    };
  }, []);

  // Función para sincronizar calificaciones desde tareas/comentarios del profesor
  const syncTaskGrades = () => {
    try {
      console.log('🔄 Sincronizando calificaciones de tareas...');
      
      // Cargar datos necesarios
  const tasks = JSON.parse(localStorage.getItem('smart-student-tasks') || '[]');
      const comments = JSON.parse(localStorage.getItem('smart-student-task-comments') || '[]');
      const currentGrades = JSON.parse(localStorage.getItem('smart-student-test-grades') || '[]');
      const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const subjects = JSON.parse(localStorage.getItem('smart-student-subjects') || '[]');
      const studentAssignments = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
      const sections = JSON.parse(localStorage.getItem('smart-student-sections') || '[]');

      // Índices auxiliares
      const taskById = new Map<string, any>();
      Array.isArray(tasks) && tasks.forEach((t: any) => taskById.set(String(t.id), t));
      const userById = new Map<string, any>();
      Array.isArray(users) && users.forEach((u: any) => userById.set(String(u.id), u));
      const subjectByNameOrId = (task: any) => {
        const found = subjects.find((s: any) => String(s.id) === String(task?.subjectId) || String(s.name) === String(task?.subject));
        return found?.id || task?.subject || null;
      };
      const sectionForStudent = (studentId: string) => {
        const asg = studentAssignments.find((a: any) => String(a.studentId) === String(studentId));
        return asg?.sectionId || null;
      };
      
  const newGrades: TestGrade[] = [];
  let replacements = 0;
      const queued = new Set<string>();

      // 1) Nueva fuente principal: comentarios de entrega con grade numérico (calificación del profesor)
      const gradedSubmissions = Array.isArray(comments)
        ? comments.filter((c: any) => c && c.taskId && (c.grade !== undefined && c.grade !== null) && !isNaN(Number(c.grade)))
        : [];

      console.log(`📝 Encontradas ${gradedSubmissions.length} entregas calificadas (comentarios con grade)`);

      gradedSubmissions.forEach((c: any) => {
        try {
          const task = taskById.get(String(c.taskId));
          if (!task) return;
          const student = userById.get(String(c.studentId)) || users.find((u: any) => String(u.username) === String(c.studentUsername));
          if (!student) return;
          const score = Math.max(0, Math.min(100, Number(c.grade)));
          const subjId = subjectByNameOrId(task);
          const courseId = task.courseId || task.course || null;
          const secId = task.sectionId || sectionForStudent(String(student.id));
          const key = `${task.id}-${student.id}`;
          const existing = currentGrades.find((g: any) => String(g.testId) === String(task.id) && String(g.studentId) === String(student.id));
          const base: TestGrade = {
            id: key,
            testId: String(task.id),
            studentId: String(student.id),
            studentName: student.displayName || student.name || student.username,
            score: Math.round(score * 100) / 100,
            courseId: courseId ? String(courseId) : null,
            sectionId: secId ? String(secId) : null,
            subjectId: subjId,
            title: task.title,
            gradedAt: new Date(c.reviewedAt || c.timestamp || Date.now()).getTime(),
          };
          if (!existing) {
            if (!queued.has(base.id)) { newGrades.push(base); queued.add(base.id); }
          } else {
            // Actualizar si cambió el puntaje o la fecha de revisión es más reciente
            const newer = (c.reviewedAt ? new Date(c.reviewedAt).getTime() : Date.now());
            if (Number(existing.score) !== base.score || newer > Number(existing.gradedAt)) {
              // Reemplazar existente
              const idx = currentGrades.findIndex((g: any) => g.testId === existing.testId && g.studentId === existing.studentId);
              if (idx >= 0) {
                currentGrades[idx] = { ...existing, ...base };
                replacements++;
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ Error procesando entrega calificada:', err);
        }
      });

      // 2) Compatibilidad: comentarios de profesor con calificación en texto (legacy)
      try {
        const gradeComments = comments.filter((comment: any) => {
          const text = (comment.content || comment.comment || '').toLowerCase();
          const hasGrade = /nota|calificaci[oó]n|puntaje|punto|\/\d+|\d+\/\d+|\d+\s*pts|\d+\s*puntos|\d+\s*%/i.test(text);
          const isFromTeacher = comment.authorRole === 'teacher' || comment.authorRole === 'profesor' || comment.userRole === 'teacher';
          return hasGrade && isFromTeacher;
        });
        console.log(`📝 (Compat) Comentarios con texto de calificación: ${gradeComments.length}`);
        gradeComments.forEach((comment: any) => {
          try {
            const text = String(comment.content || comment.comment || '');
            const patterns = [
              /nota[:\s]*(\d+(?:\.\d+)?)/i,
              /calificaci[oó]n[:\s]*(\d+(?:\.\d+)?)/i,
              /puntaje[:\s]*(\d+(?:\.\d+)?)/i,
              /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/,
              /(\d+(?:\.\d+)?)\s*pts/i,
              /(\d+(?:\.\d+)?)\s*puntos/i,
              /(\d+(?:\.\d+)?)\s*%/,
              /^(\d+(?:\.\d+)?)$/
            ];
            let score: number | null = null;
            for (const pattern of patterns) {
              const m = text.match(pattern);
              if (m) {
                if (pattern.source.includes('\\/')) {
                  score = (parseFloat(m[1]) / parseFloat(m[2])) * 100;
                } else {
                  score = parseFloat(m[1]);
                  if (score > 100) score = Math.min(score / 10, 100);
                }
                break;
              }
            }
            if (score == null || !isFinite(score)) return;
            const task = taskById.get(String(comment.taskId));
            if (!task) return;
            const student = userById.get(String(comment.studentId)) || users.find((u: any) => String(u.username) === String(comment.studentUsername));
            if (!student) return;
            const subjId = subjectByNameOrId(task);
            const courseId = task.courseId || task.course || null;
            const secId = task.sectionId || sectionForStudent(String(student.id));
            const key = `${task.id}-${student.id}`;
            if (!currentGrades.some((g: any) => String(g.testId) === String(task.id) && String(g.studentId) === String(student.id)) && !queued.has(key)) {
              newGrades.push({
                id: key,
                testId: String(task.id),
                studentId: String(student.id),
                studentName: student.displayName || student.name || student.username,
                score: Math.round(score * 100) / 100,
                courseId: courseId ? String(courseId) : null,
                sectionId: secId ? String(secId) : null,
                subjectId: subjId,
                title: task.title,
                gradedAt: new Date(comment.reviewedAt || comment.timestamp || Date.now()).getTime(),
              });
              queued.add(key);
            }
          } catch {/* ignore one off */}
        });
      } catch {/* legacy path errors ignored */}

      // Integración de resultados de Evaluación en tareas: task.evaluationResults
      try {
        tasks.forEach((task: any) => {
          const results = task?.evaluationResults;
          if (!results || typeof results !== 'object') return;
          Object.entries(results as Record<string, any>).forEach(([studentUsername, res]) => {
            try {
              const total = Number(res?.totalQuestions) || 0;
              const rawScore = Number(res?.score);
              let pct = total > 0 ? (rawScore / total) * 100 : Number(res?.completionPercentage) || 0;
              if (!isFinite(pct)) return;
              pct = Math.max(0, Math.min(100, pct));
              const student = users.find((u: any) => String(u.username) === String(studentUsername));
              if (!student) return;
              const subject = subjects.find((s: any) => s.name === task.subject || String(s.id) === String(task.subjectId));
              const exists = currentGrades.some((g: any) => g.testId === task.id && String(g.studentId) === String(student.id));
              if (exists) return;
              const newGrade: TestGrade = {
                id: `${task.id}-${student.id}`,
                testId: task.id,
                studentId: student.id,
                studentName: student.displayName || student.name || student.username,
                score: Math.round(pct * 100) / 100,
                courseId: task.courseId || null,
                sectionId: task.sectionId || null,
                subjectId: subject?.id || task.subject || null,
                title: task.title,
                gradedAt: new Date(res?.completedAt || Date.now()).getTime(),
              };
              if (!queued.has(newGrade.id)) {
                newGrades.push(newGrade);
                queued.add(newGrade.id);
              }
            } catch {/* row error */}
          });
        });
      } catch (err) {
        console.warn('Error integrando evaluationResults:', err);
      }

      // Integración directa desde smart-student-evaluation-results (fuente oficial al completar evaluación)
      try {
        const evalResults = JSON.parse(localStorage.getItem('smart-student-evaluation-results') || '[]');
        if (Array.isArray(evalResults)) {
          evalResults.forEach((res: any) => {
            try {
              const task = taskById.get(String(res?.taskId));
              const student = userById.get(String(res?.studentId)) || users.find((u: any) => String(u.username) === String(res?.studentUsername));
              if (!task || !student) return;
              const pctRaw = Number(res?.percentage);
              if (!isFinite(pctRaw)) return;
              const pct = Math.max(0, Math.min(100, pctRaw));
              const subjId = subjectByNameOrId(task);
              const courseId = task.courseId || task.course || null;
              const secId = task.sectionId || sectionForStudent(String(student.id));
              const key = `${task.id}-${student.id}`;
              const base: TestGrade = {
                id: key,
                testId: String(task.id),
                studentId: String(student.id),
                studentName: student.displayName || student.name || student.username,
                score: Math.round(pct * 100) / 100,
                courseId: courseId ? String(courseId) : null,
                sectionId: secId ? String(secId) : null,
                subjectId: subjId,
                title: task.title,
                gradedAt: new Date(res?.completedAt || Date.now()).getTime(),
              };
              const existing = currentGrades.find((g: any) => String(g.testId) === String(task.id) && String(g.studentId) === String(student.id));
              if (!existing) {
                if (!queued.has(base.id)) { newGrades.push(base); queued.add(base.id); }
              } else {
                if (Number(existing.score) !== base.score || Number(existing.gradedAt) < base.gradedAt) {
                  const idx = currentGrades.findIndex((g: any) => g.testId === existing.testId && g.studentId === existing.studentId);
                  if (idx >= 0) { currentGrades[idx] = { ...existing, ...base }; replacements++; }
                }
              }
            } catch {/* one result error */}
          });
        }
      } catch (err) {
        console.warn('Error integrando smart-student-evaluation-results:', err);
      }
      
      // Guardar las nuevas calificaciones (incluye reemplazos ya aplicados sobre currentGrades)
      if (newGrades.length > 0 || replacements > 0) {
        const updatedGrades = [...currentGrades, ...newGrades];
        localStorage.setItem('smart-student-test-grades', JSON.stringify(updatedGrades));
        setGrades(updatedGrades);
        
        // Emitir evento para sincronizar otras partes de la app
        window.dispatchEvent(new StorageEvent('storage', { 
          key: 'smart-student-test-grades', 
          newValue: JSON.stringify(updatedGrades) 
        }));
  // Notificar a sistema de notificaciones para reflejar cambios inmediatos
  try { window.dispatchEvent(new CustomEvent('taskNotificationsUpdated', { detail: { reason: 'gradesSynced', count: newGrades.length } })); } catch {}
        
  console.log(`🎯 Sincronizadas ${newGrades.length} nuevas calificaciones, ${replacements} actualizaciones`);
      } else {
        console.log('ℹ️ No se encontraron nuevas calificaciones para sincronizar');
      }
      
    } catch (error) {
      console.error('Error sincronizando calificaciones de tareas:', error);
    }
  };

  // Función para cargar tareas pendientes de calificación
  const loadPendingTasks = () => {
    try {
      const tasks: Task[] = loadJson<Task[]>('smart-student-tasks', []);
      // Incluir evaluaciones como tareas pendientes también
      const evalsRaw: any[] = loadJson<any[]>('smart-student-evaluations', []);
      const evaluations: Task[] = Array.isArray(evalsRaw) ? evalsRaw.map((e: any) => ({
        id: String(e.id ?? e.evaluationId ?? e.uid ?? Math.random().toString(36).slice(2)),
        title: String(e.title ?? e.name ?? 'Evaluación'),
        description: String(e.description ?? ''),
        subject: String(e.subject ?? e.subjectName ?? e.subjectId ?? 'General'),
        course: String(e.course ?? e.courseName ?? e.courseId ?? ''),
        courseId: e.courseId ?? null,
        assignedById: String(e.assignedById ?? e.teacherId ?? ''),
        assignedByName: String(e.assignedByName ?? e.teacherName ?? ''),
        assignedTo: (e.assignedTo === 'student' ? 'student' : 'course'),
        assignedStudentIds: Array.isArray(e.assignedStudentIds) ? e.assignedStudentIds.map(String) : undefined,
        sectionId: e.sectionId ?? null,
        dueDate: String(e.dueDate ?? e.closeAt ?? new Date().toISOString()),
        createdAt: String(e.createdAt ?? e.openAt ?? new Date().toISOString()),
        status: (e.status === 'finished' || e.closed) ? 'finished' : (e.status || 'pending'),
        priority: 'medium',
        taskType: 'evaluacion',
      })) : [];
      // Agregar Pruebas (smart-student-tests_*) como elementos tipo 'prueba'
      const testsRaw: any[] = (() => {
        const acc: any[] = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('smart-student-tests')) continue;
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(arr)) acc.push(...arr);
          }
        } catch {}
        try {
          const base = JSON.parse(localStorage.getItem('smart-student-tests') || '[]');
          if (Array.isArray(base)) acc.push(...base);
        } catch {}
        return acc;
      })();
      const testsAsTasks: Task[] = Array.isArray(testsRaw) ? testsRaw.map((t: any) => ({
        id: String(t.id || ''),
        title: String(t.title || 'Prueba'),
        description: String(t.description || ''),
        subject: String(t.subjectName || t.subjectId || 'General'),
        subjectId: t.subjectId ?? null,
        course: '',
        courseId: t.courseId ?? null,
        assignedById: String(t.ownerId || ''),
        assignedByName: String(t.ownerUsername || ''),
        assignedTo: 'course',
        assignedStudentIds: undefined,
        sectionId: t.sectionId ?? null,
        dueDate: new Date(Number(t.createdAt || Date.now())).toISOString(),
        createdAt: new Date(Number(t.createdAt || Date.now())).toISOString(),
        status: 'pending',
        priority: 'medium',
        taskType: 'prueba',
        topic: String(t.topic || t.title || ''),
      })) : [];
      const existingGrades = loadJson<TestGrade[]>('smart-student-test-grades', []);
      
      // Filtrar tareas que están esperando calificación
  const pending: PendingTask[] = [];
      
  const allItems: Task[] = [...tasks, ...evaluations, ...testsAsTasks];
      allItems.forEach((task) => {
        // Considerar tareas en cualquier estado que no sea 'finished' 
        // (pending = recién creada, submitted = entregada, reviewed = revisada, delivered = entregada)
        if (['pending', 'submitted', 'reviewed', 'delivered'].includes(task.status)) {
          // Verificar si la tarea ya tiene calificaciones completas
          const taskGrades = existingGrades.filter(grade => grade.testId === task.id);
          
          let needsGrading = false;
          
          if (task.assignedTo === 'course') {
            // Para todo el curso, si no hay calificaciones, está pendiente
            needsGrading = taskGrades.length === 0;
          } else if (task.assignedTo === 'student' && task.assignedStudentIds) {
            // Para estudiantes específicos, verificar si faltan calificaciones
            const gradedStudentIds = new Set(taskGrades.map(g => g.studentId));
            needsGrading = task.assignedStudentIds.some(studentId => !gradedStudentIds.has(studentId));
          }
          
          if (needsGrading) {
            // Fecha de referencia para N1..N10: priorizar createdAt
            const refIso = new Date(
              Date.parse(String(task.createdAt || task.startAt || task.openAt || task.dueDate || Date.now()))
            ).toISOString();
            pending.push({
              taskId: task.id,
              title: task.title,
              taskType: task.taskType,
              createdAt: refIso,
              subject: task.subject,
              course: task.course,
              courseId: task.courseId ?? null,
              sectionId: (task as any).sectionId ?? null,
              assignedTo: task.assignedTo,
              assignedStudentIds: task.assignedStudentIds,
              columnIndex: 0, // Se asignará después del ordenamiento
              topic: task.topic
            });
          }
        }
      });

  // Ordenar por fecha (más antigua primero) usando createdAt prioritario
  pending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      pending.forEach((task, index) => {
        task.columnIndex = Math.min(index, 9); // N1=0, N2=1, ..., N10=9
      });

      setPendingTasks(pending.slice(0, 10)); // Máximo 10 tareas pendientes
      
      if (pending.length > 0) {
        console.log(`📋 [CALIFICACIONES] ${pending.length} tarea(s) pendiente(s) de calificación:`, pending.map(t => `${t.title} (${t.taskType})`));
      }
    } catch (error) {
      console.error('Error cargando tareas pendientes:', error);
      setPendingTasks([]);
    }
  };

  // Helpers de nivel
  const getCourseLevel = (name?: string): 'basica' | 'media' | null => {
    if (!name) return null;
    const n = name.toLowerCase();
    if (n.includes('básica') || n.includes('basico') || n.includes('básico') || n.includes('basica')) return 'basica';
    if (n.includes('medio') || n.includes('media')) return 'media';
    return null;
  };

  const courseById = useMemo(() => new Map(courses.map(c => [c.id, c] as const)), [courses]);

  // Orden lógico de cursos: 1º Básico → 8º Básico → 1º Medio → 4º Medio
  const courseRank = (name?: string): number => {
    if (!name) return 9999;
    const n = name.toLowerCase();
    const numMap: Record<string, number> = { '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8 };
    const num = Object.keys(numMap).find(k => n.includes(`${k}ro`) || n.includes(`${k}º`) || n.includes(`${k}to`) || n.includes(`${k}mo`) || n.startsWith(`${k}`));
    const nn = num ? numMap[num] : 99;
    const isBasico = n.includes('básic') || n.includes('basic');
    const isMedio = n.includes('medio') || n.includes('media');
    if (isBasico) return nn;                // 1..8
    if (isMedio) return 8 + (nn || 0);      // 9..12
    return 9000 + nn;                       // Otros al final
  };
  const sectionRank = (sec?: string): number => {
    if (!sec) return 9999;
    const s = sec.trim();
    const ch = s[0]?.toUpperCase();
    return ch ? ch.charCodeAt(0) : 9999;
  };

  // Prioridad de Asignaturas (fallback a alfabético)
  const SUBJECT_ORDER = [
    'Lenguaje y Comunicación',
    'Matemática',
    'Historia, Geografía y Ciencias Sociales',
    'Ciencias Naturales',
    'Inglés',
    'Educación Física',
    'Música',
    'Artes Visuales',
    'Tecnología',
    'Orientación',
  ];
  const subjectRank = (name?: string): number => {
    if (!name) return 9999;
    const idx = SUBJECT_ORDER.findIndex(s => s.toLowerCase() === name.toLowerCase());
    if (idx >= 0) return idx;
    return 1000; // desconocidas después; se desempatan alfabéticamente
  };

  // Opciones por rol
  const teacherAssignments = useMemo(() => loadJson<any[]>('smart-student-teacher-assignments', []), []);

  const allowed = useMemo(() => {
    if (!user) return { courses: new Set<string>(), sections: new Set<string>(), subjects: new Set<string>() };
    if (user.role === 'admin') {
      return {
        courses: new Set<string>(courses.map(c => c.id)),
        sections: new Set<string>(sections.map(s => s.id)),
        subjects: new Set<string>(subjects.map(su => su.id || su.name)),
      };
    }
    if (user.role === 'teacher') {
      const mine = teacherAssignments.filter(a => a.teacherId === (user as any).id || a.teacherUsername === user.username);
      const c = new Set<string>();
      const s = new Set<string>();
      const subj = new Set<string>();
      mine.forEach(a => {
        if (a.courseId) c.add(a.courseId);
        if (a.sectionId) s.add(a.sectionId);
        // Soportar distintos nombres de campo
        const names: string[] = Array.isArray(a.subjects) ? a.subjects : (a.subjectName ? [a.subjectName] : []);
        names.forEach(n => subj.add(n));
      });
      return { courses: c, sections: s, subjects: subj };
    }
    // Estudiante
    const mine = studentAssignments.filter(a => a.studentId === (user as any).id);
    const c = new Set<string>();
    const s = new Set<string>();
    mine.forEach(a => { if (a.courseId) c.add(a.courseId); if (a.sectionId) s.add(a.sectionId); });
    return { courses: c, sections: s, subjects: new Set<string>() };
  }, [user, courses, sections, subjects, teacherAssignments, studentAssignments]);

  // Derivar chips de filtros según rol y nivel
  const courseSectionOptions: Option[] = useMemo(() => {
    const opts: Option[] = [];
    // Crear opciones por cada sección permitida, mostrando Curso + Sección (ej. "1 Medio Z")
    sections.forEach(s => {
      if (!allowed.sections.has(s.id)) return;
      const course = courseById.get(s.courseId);
      // Filtrado por nivel si aplica
      if (levelFilter !== 'all') {
        const level = getCourseLevel(course?.name);
        if (level !== levelFilter) return;
      }
      const label = `${course?.name ?? ''} ${s.name}`.trim();
      opts.push({ value: s.id, label });
    });
    // Orden alfab e9tico por etiqueta para consistencia
    return opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [sections, courseById, allowed, levelFilter]);

  // Secciones visibles según filtro y permisos (incluye nivel)
  const visibleSectionIds = useMemo(() => {
    // Prioridad: selección directa en cascada (sección), luego curso, luego combo y nivel
    if (cascadeSectionId) return new Set<string>([String(cascadeSectionId)]);
    if (cascadeCourseId) {
      const set = new Set<string>();
      sections.forEach(s => { if (String(s.courseId) === String(cascadeCourseId) && allowed.sections.has(s.id)) set.add(String(s.id)); });
      return set;
    }
    if (comboSectionId !== 'all') return new Set<string>([comboSectionId]);
    const all = [...allowed.sections];
    if (levelFilter === 'all') return new Set<string>(all);
    const keep = new Set<string>();
    sections.forEach(s => {
      if (!all.includes(s.id)) return;
      const c = courseById.get(s.courseId);
      const lvl = getCourseLevel(c?.name);
      if (lvl === levelFilter) keep.add(s.id);
    });
    return keep;
  }, [comboSectionId, allowed.sections, levelFilter, sections, courseById, cascadeCourseId, cascadeSectionId]);

  const subjectOptions: Option[] = useMemo(() => {
    const opts: Option[] = [{ value: 'all', label: translate('allSubjects') || 'Todas las asignaturas' }];
    const targetSectionIds = new Set<string>([...visibleSectionIds]);
    const nameSet = new Set<string>();
    teacherAssignments.forEach(a => {
      if (!a || !a.sectionId) return;
      if (!targetSectionIds.has(String(a.sectionId))) return;
      const names: string[] = Array.isArray(a.subjects) ? a.subjects : (a.subjectName ? [a.subjectName] : []);
      names.forEach(n => { if (n) nameSet.add(String(n)); });
    });
    let names = Array.from(nameSet);
    if (user?.role === 'teacher' && allowed.subjects.size > 0) {
      names = names.filter(n => allowed.subjects.has(n));
    }
    if (names.length === 0) {
      names = Array.from(new Set(subjects.map(su => su.name)));
    }
    names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    names.forEach(n => opts.push({ value: n, label: n }));
    return opts;
  }, [translate, visibleSectionIds, teacherAssignments, user, allowed.subjects, subjects]);

  // Estudiantes reales de Gestión de Usuarios para las secciones visibles
  const studentsInView = useMemo(() => {
    // Recolectar IDs/usuarios asignados a las secciones visibles
    const ids = new Set<string>();
    studentAssignments.forEach(a => {
      if (a && a.sectionId && visibleSectionIds.has(String(a.sectionId))) {
        if (a.studentId) ids.add(String(a.studentId));
        if (a.studentUsername) ids.add(String(a.studentUsername));
      }
    });
    // Filtrar usuarios que pertenecen a esas secciones
    let list = users.filter(u => {
      const sid = u && (u.id != null ? String(u.id) : undefined);
      const uname = u && u.username ? String(u.username) : undefined;
      return (sid && ids.has(sid)) || (uname && ids.has(uname));
    });
    // Rol estudiante: sólo su propio registro
    if (user?.role === 'student') {
      list = list.filter(u => String(u.id) === String((user as any).id) || String(u.username) === String(user.username));
    }
    // Filtro por estudiante seleccionado en cascada
    if (studentFilter !== 'all') {
      list = list.filter(u => String(u.id) === String(studentFilter) || String(u.username) === String(studentFilter));
    }
    // Ordenar por Curso-Sección y nombre
    list.sort((a: any, b: any) => {
      const assignA = studentAssignments.find(as => as && as.sectionId && visibleSectionIds.has(String(as.sectionId)) && (String(as.studentId) === String(a.id) || String(as.studentUsername) === String(a.username)));
      const assignB = studentAssignments.find(as => as && as.sectionId && visibleSectionIds.has(String(as.sectionId)) && (String(as.studentId) === String(b.id) || String(as.studentUsername) === String(b.username)));
      const secA = sections.find(s => String(s.id) === String(assignA?.sectionId));
      const secB = sections.find(s => String(s.id) === String(assignB?.sectionId));
      const courseA = courseById.get(String(secA?.courseId));
      const courseB = courseById.get(String(secB?.courseId));
      const rA = courseRank(courseA?.name);
      const rB = courseRank(courseB?.name);
      if (rA !== rB) return rA - rB;
      const sA = sectionRank(secA?.name);
      const sB = sectionRank(secB?.name);
      if (sA !== sB) return sA - sB;
      return String(a.displayName || a.name || a.username || '').localeCompare(String(b.displayName || b.name || b.username || ''), undefined, { sensitivity: 'base' });
    });
    return list;
  }, [users, studentAssignments, visibleSectionIds, user, studentFilter, sections, courseById]);

  // Filtrar notas por secciones/rol/asignatura y semestre
  const filteredGrades = useMemo(() => {
    // Mapa de creación por test para ordenar/filtrar por fecha de creación
    const createdMap = new Map<string, number>();
    // Helpers de fecha para semestre: parseo local de YYYY-MM-DD y comparación a nivel de día (ignora zona horaria)
    const parseYmdLocal = (ymd?: string) => {
      if (!ymd) return undefined as unknown as Date | undefined;
      const [y, m, d] = String(ymd).split('-').map(Number);
      if (!y || !m || !d) return undefined as unknown as Date | undefined;
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const startEndFor = (cfg: any, which: '1' | '2') => {
      const start = parseYmdLocal(which === '1' ? cfg?.first?.start : cfg?.second?.start);
      const end = parseYmdLocal(which === '1' ? cfg?.first?.end : cfg?.second?.end);
      return { start, end } as { start?: Date; end?: Date };
    };
    const sameDayFloor = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    try {
      const tks = JSON.parse(localStorage.getItem('smart-student-tasks') || '[]');
      tks.forEach((t: any) => {
        // Para N1..N10 y clasificación temporal usamos createdAt como fuente primaria (evita desajustes de dueDate)
        const raw = t.createdAt || t.startAt || t.openAt || t.dueDate;
        const ts = Date.parse(String(raw || ''));
        if (!isNaN(ts)) createdMap.set(String(t.id), ts);
      });
      const evals = JSON.parse(localStorage.getItem('smart-student-evaluations') || '[]');
      evals.forEach((e: any) => {
        const id = String(e.id ?? e.evaluationId ?? e.uid ?? '');
        const ts = Date.parse(String(e.createdAt || e.openAt || e.startAt || e.dueDate || ''));
        if (id && !isNaN(ts)) createdMap.set(id, ts);
      });
      // Incluir Pruebas (smart-student-tests_*): su createdAt es numérico
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('smart-student-tests')) continue;
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(arr)) {
            arr.forEach((t: any) => {
              const id = String(t?.id || '');
              const ts = Number(t?.createdAt || 0);
              if (id && Number.isFinite(ts) && ts > 0) createdMap.set(id, ts);
            });
          }
        }
      } catch {}
    } catch {}

  const list = grades.filter(g => {
      // Filtrar por sección visible; si no hay sectionId en la nota, inferir por asignación del estudiante
      if (g.sectionId) {
        if (!visibleSectionIds.has(String(g.sectionId))) return false;
      } else {
        // Inferir sección del estudiante
        const assign = studentAssignments.find(as => String(as.studentId) === String(g.studentId) || String(as.studentUsername) === String(g.studentId));
        const secId = assign?.sectionId ? String(assign.sectionId) : null;
        if (!secId || !visibleSectionIds.has(secId)) return false;
      }
      if (subjectFilter !== 'all') {
        const found = subjects.find(su => String(su.id) === String(g.subjectId));
        const name = found?.name || (g.subjectId ? String(g.subjectId) : '');
        if (name !== subjectFilter) return false;
      }
      if (semester !== 'all') {
        const createdTs = createdMap.get(String(g.testId)) ?? g.gradedAt;
        // Cuando hay config de semestres, usar comparación local por día
        if (semestersCfg) {
          const dt = sameDayFloor(new Date(createdTs));
          const { start, end } = startEndFor(semestersCfg, semester);
          if (!start || !end) return false;
          if (!(dt >= start && dt <= end)) return false;
        } else {
          // Fallback por mes si no hay config guardada
          const dt = new Date(createdTs);
          const m = dt.getMonth();
          if (semester === '1' && m > 5) return false; // Ene(0)..Jun(5)
          if (semester === '2' && m < 6) return false; // Jul(6)..Dic(11)
        }
      }
      if (user?.role === 'student' && String(g.studentId) !== String((user as any).id)) return false;
      if (user?.role === 'teacher') {
        if (g.courseId && !allowed.courses.has(String(g.courseId))) return false;
        if (g.sectionId && !allowed.sections.has(String(g.sectionId))) return false;
      }
  if (studentFilter !== 'all' && String(g.studentId) !== String(studentFilter)) return false;
      return true;
    });
    // Orden por fecha de creación asc (para N1..N10)
    return list.sort((a, b) => {
      const ca = createdMap.get(String(a.testId)) ?? a.gradedAt;
      const cb = createdMap.get(String(b.testId)) ?? b.gradedAt;
      return ca - cb;
    });
  }, [grades, visibleSectionIds, subjectFilter, semester, semestersCfg, user, allowed, subjects, studentFilter, refreshTick]);

  // Índice N1..N10 por estudiante
  const gradeMap = useMemo(() => {
    const map = new Map<string, TestGrade[]>();
    filteredGrades.forEach(g => {
      const key = String(g.studentId);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return map;
  }, [filteredGrades]);

  // Promedio general visible
  const avg = useMemo(() => {
    const all = filteredGrades;
    if (all.length === 0) return null;
    const sum = all.reduce((acc, g) => acc + (Number.isFinite(g.score) ? Number(g.score) : 0), 0);
    return Math.round((sum / all.length) * 10) / 10;
  }, [filteredGrades]);

  // Lista de "Pendientes" filtrada por los filtros superiores (sección, asignatura, semestre)
  const filteredPendingCards = useMemo(() => {
    const list = [...pendingTasks];
    const secs = new Set<string>([...visibleSectionIds]);
    const onlyOneSection = secs.size === 1 ? Array.from(secs)[0] : null;
    // Helpers de fecha
    const parseYmdLocal = (ymd?: string) => {
      if (!ymd) return undefined as unknown as Date | undefined;
      const [y, m, d] = String(ymd).split('-').map(Number);
      if (!y || !m || !d) return undefined as unknown as Date | undefined;
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const startEndFor = (cfg: any, which: '1' | '2') => {
      const start = parseYmdLocal(which === '1' ? cfg?.first?.start : cfg?.second?.start);
      const end = parseYmdLocal(which === '1' ? cfg?.first?.end : cfg?.second?.end);
      return { start, end } as { start?: Date; end?: Date };
    };
    const sameDayFloor = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return list.filter(task => {
      // Sección visible
      let sid = task.sectionId ? String(task.sectionId) : null;
      if (!sid && onlyOneSection) sid = onlyOneSection; // asumir la única sección visible
      if (!sid || !secs.has(sid)) return false;
      // Asignatura
      if (subjectFilter !== 'all') {
        if (String(task.subject || '').toLowerCase() !== String(subjectFilter).toLowerCase()) return false;
      }
      // Semestre
      if (semester !== 'all') {
        const ref = new Date(task.createdAt || Date.now());
        if (semestersCfg) {
          const dt = sameDayFloor(ref);
          const { start, end } = startEndFor(semestersCfg, semester);
          if (!start || !end) return false;
          if (!(dt >= start && dt <= end)) return false;
        } else {
          const m = ref.getMonth();
          if (semester === '1' && m > 5) return false;
          if (semester === '2' && m < 6) return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [pendingTasks, visibleSectionIds, subjectFilter, semester, semestersCfg]);

  // Estilos de badge para notas: 0-59 rojo, 60-100 verde
  const scoreBadgeClass = (score: number) => {
    const base = 'inline-block min-w-[2rem] rounded-full px-1.5 py-0.5 text-xs border';
    if (Number(score) < 60) {
      return `${base} bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-600`;
    }
    return `${base} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-600`;
  };

  // Componente para tooltip mejorado
  const TaskTooltip = ({ task, children }: { task: any; children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);
    
    const formatDate = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      } catch {
        return dateStr;
      }
    };

    return (
      <div 
        className="relative inline-block"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
        {isVisible && task && (
          <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-64 whitespace-normal">
              <div className="font-semibold text-yellow-200">{task.taskType === 'evaluacion' ? 'Evaluación' : task.taskType === 'prueba' ? 'Prueba' : 'Tarea'}: {task.title}</div>
              <div className="text-gray-300 mt-1">Creada: {formatDate(task.createdAt)}</div>
              {task.dueDate && (
                <div className="text-gray-300">Vence: {formatDate(task.dueDate)}</div>
              )}
              <div className="text-gray-300">Estado: {task.status === 'active' ? 'Activa' : task.status}</div>
            </div>
            {/* Flecha del tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Cargar tareas pendientes por asignatura
  const loadPendingTasksBySubject = useMemo(() => {
    // Clave compuesta: `${subject}__${sectionId}` para evitar mezclar secciones
    const tasksByKey = new Map<string, any[]>();
    const normSubj = (s?: string) => {
      const base = String(s || 'General').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      // Unificar plural simple (e.g., matematica(s))
      return base.endsWith('s') ? base.slice(0, -1) : base;
    };
    
    try {
      // Cargar tareas del localStorage
      const tasks = JSON.parse(localStorage.getItem('smart-student-tasks') || '[]');
      const evaluations = JSON.parse(localStorage.getItem('smart-student-evaluations') || '[]');
      // Cargar Pruebas (todas las claves 'smart-student-tests*')
      const tests: any[] = (() => {
        const acc: any[] = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('smart-student-tests')) continue;
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(arr)) acc.push(...arr);
          }
        } catch {}
        try {
          const base = JSON.parse(localStorage.getItem('smart-student-tests') || '[]');
          if (Array.isArray(base)) acc.push(...base);
        } catch {}
        return acc;
      })();
      const grades = JSON.parse(localStorage.getItem('smart-student-test-grades') || '[]');
      
  // Combinar tareas y evaluaciones
  const allTasks = [
        ...tasks.map((t: any) => ({ ...t, taskType: t.taskType || 'tarea' })),
        ...evaluations.map((e: any) => ({ ...e, taskType: 'evaluacion' })),
        ...tests.map((t: any) => ({
          ...t,
          taskType: 'prueba',
          subject: t.subjectName || t.subjectId || 'General',
          subjectId: t.subjectId ?? null,
          courseId: t.courseId ?? null,
          sectionId: t.sectionId ?? null,
          createdAt: new Date(Number(t.createdAt || Date.now())).toISOString(),
          status: 'pending',
        }))
      ];
      
      // Helpers de fecha iguales a los de filteredGrades
      const parseYmdLocal = (ymd?: string) => {
        if (!ymd) return undefined as unknown as Date | undefined;
        const [y, m, d] = String(ymd).split('-').map(Number);
        if (!y || !m || !d) return undefined as unknown as Date | undefined;
        return new Date(y, (m || 1) - 1, d || 1);
      };
      const sameDayFloor = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const startEndFor = (cfg: any, which: '1' | '2') => {
        const start = parseYmdLocal(which === '1' ? cfg?.first?.start : cfg?.second?.start);
        const end = parseYmdLocal(which === '1' ? cfg?.first?.end : cfg?.second?.end);
        return { start, end } as { start?: Date; end?: Date };
      };

      // Expandir por sección y filtrar por semestre
      const coursesLS = JSON.parse(localStorage.getItem('smart-student-courses') || '[]');
      const sectionsLS = JSON.parse(localStorage.getItem('smart-student-sections') || '[]');
      const assignsLS = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
      const activeTasks: any[] = [];
      allTasks.forEach(task => {
        // Estado permitido (excluir 'finished' únicamente)
        const st = String(task.status || '').toLowerCase();
        const allowed = new Set(['active', 'pending', 'submitted', 'reviewed', 'delivered']);
        if (!allowed.has(st)) return;
        // Fecha (createdAt prioritario)
        const refRaw = task.createdAt || task.startAt || task.openAt || task.dueDate;
        const created = new Date(refRaw);
        if (semester !== 'all') {
          try {
            if (semestersCfg) {
              const dt = sameDayFloor(created);
              const { start, end } = startEndFor(semestersCfg, semester);
              if (!start || !end) return;
              if (!(dt >= start && dt <= end)) return;
            } else {
              const m = created.getMonth();
              if (semester === '1' && m > 5) return;
              if (semester === '2' && m < 6) return;
            }
          } catch {}
        }
        // Determinar secciones objetivo
        const pushFor = (secId: string) => {
          if (!visibleSectionIds.has(String(secId))) return;
          activeTasks.push({ ...task, sectionId: String(secId) });
        };
        let secId = task.sectionId ? String(task.sectionId) : '';
        if (!secId && task.assignedTo === 'student' && Array.isArray(task.assignedStudentIds) && task.assignedStudentIds.length > 0) {
          try {
            const sid = String(task.assignedStudentIds[0]);
            const asg = assignsLS.find((a: any) => String(a.studentId) === sid || String(a.studentUsername) === sid);
            if (asg?.sectionId) secId = String(asg.sectionId);
          } catch {}
        }
        if (secId) {
          pushFor(secId);
          return;
        }
        // Si no hay sectionId: expandir por curso (courseId o nombre)
        const courseId = task.courseId ? String(task.courseId) : (() => {
          if (!task.course) return '';
          // 1) Intentar por id exacto
          const byId = coursesLS.find((c: any) => String(c.id) === String(task.course));
          if (byId?.id) return String(byId.id);
          // 2) Intentar por nombre
          const byName = coursesLS.find((c: any) => String(c.name).toLowerCase() === String(task.course).toLowerCase());
          return byName?.id ? String(byName.id) : '';
        })();
        if (courseId) {
          sectionsLS.filter((s: any) => String(s.courseId) === courseId).forEach((s: any) => pushFor(String(s.id)));
        }
      });
      
      // Agrupar por asignatura + sección
      activeTasks.forEach(task => {
        const subject = normSubj(task.subject || task.subjectName || 'General');
        const secId = String(task.sectionId);
        const key = `${subject}__${secId}`;
        if (!tasksByKey.has(key)) tasksByKey.set(key, []);
        
        // Relajar filtro: ocultar solo si ya hay calificaciones explícitas en esa sección
        const hasGradesInSection = grades.some((g: any) => String(g.testId) === String(task.id) && String(g.sectionId || '') === String(secId));
        if (!hasGradesInSection) tasksByKey.get(key)!.push(task);
      });
      
      // Ordenar por createdAt ascendente por cada clave
      tasksByKey.forEach((arr) => {
        const ref = (t: any) => new Date(t.createdAt || t.startAt || t.openAt || t.dueDate).getTime();
        arr.sort((a, b) => ref(a) - ref(b));
      });
      
    } catch (error) {
      console.warn('Error cargando tareas pendientes:', error);
    }
    
  return tasksByKey;
  }, [visibleSectionIds, refreshTick, semester, semestersCfg]);

  // (Eliminado) Generador de notas demo

  // (Eliminado) Generador de notas demo

  // Función para obtener tarea pendiente por columna y asignatura específica
  const getPendingTaskForColumn = (columnIndex: number, subjectName: string, sectionId?: string | null): PendingTask | null => {
    const normSubj = (s?: string) => {
      const base = String(s || 'General').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      return base.endsWith('s') ? base.slice(0, -1) : base;
    };
    if (!sectionId) return null;
    const key = `${normSubj(subjectName)}__${String(sectionId)}`;
    const tasks = loadPendingTasksBySubject.get(key) || [];
    const t = tasks[columnIndex];
    if (!t) return null;
    return {
      taskId: String(t.id),
      title: String(t.title || t.name || ''),
      taskType: String(t.taskType || 'tarea') as any,
      createdAt: String(t.createdAt || t.startAt || t.openAt || t.dueDate || new Date().toISOString()),
      subject: String(subjectName || t.subject || 'General'),
      course: String(t.course || ''),
      courseId: t.courseId ?? null,
      sectionId: t.sectionId ?? null,
      assignedTo: String(t.assignedTo || 'course') as any,
      assignedStudentIds: Array.isArray(t.assignedStudentIds) ? t.assignedStudentIds.map(String) : undefined,
      columnIndex,
      topic: t.topic,
    };
  };

  // Función para formatear fecha
  const formatDate = (dateString: string): string => {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Layout: una columna amplia (se eliminan tarjetas laterales para dar más espacio a la tabla) */}
      <div className="flex flex-col gap-6">
        {/* Columna única */}
        <div className="flex-1 lg:w-full">
          <Card>
            <CardHeader>
              <CardTitle>
                {tr('gradesDashboardTitle', 'Calificaciones')}
                {': '}
                {semester === '1' ? tr('firstSemester', '1er Semestre') : semester === '2' ? tr('secondSemester', '2do Semestre') : tr('allSemesters', 'Todos los semestres')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Vista en cascada y filtros */}
              {/* Vista en cascada: Nivel → Curso → Sección → Asignatura → Estudiantes */}
              <div className="space-y-4">
                {/* Niveles */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">{tr('levels', 'Niveles')}</div>
                  <div className="flex items-center gap-2">
                    <Badge
                      onClick={() => { const next = levelFilter === 'basica' ? 'all' : 'basica'; setLevelFilter(next); setCascadeCourseId(null); setCascadeSectionId(null); setCascadeSubject(null); setComboSectionId('all'); setSubjectFilter('all'); setStudentFilter('all'); }}
                      className={`cursor-pointer select-none rounded-full px-3 py-1 ${levelFilter === 'basica' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-600'}`}
                    >{tr('basicLevel', 'Básica')}</Badge>
                    <Badge
                      onClick={() => { const next = levelFilter === 'media' ? 'all' : 'media'; setLevelFilter(next); setCascadeCourseId(null); setCascadeSectionId(null); setCascadeSubject(null); setComboSectionId('all'); setSubjectFilter('all'); setStudentFilter('all'); }}
                      className={`cursor-pointer select-none rounded-full px-3 py-1 ${levelFilter === 'media' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-600'}`}
                    >{tr('middleLevel', 'Media')}</Badge>
                  </div>
                </div>

                {/* Cursos del nivel seleccionado */}
                {levelFilter !== 'all' && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{tr('courses', 'Cursos')}</div>
                    <div className="flex flex-wrap gap-2">
                      {courses
                        .filter(c => getCourseLevel(c.name) === levelFilter)
                        .sort((a, b) => {
                          const ra = courseRank(a.name);
                          const rb = courseRank(b.name);
                          if (ra !== rb) return ra - rb;
                          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                        })
                        .map(c => {
                          const sectionsOfCourse = sections.filter(s => s.courseId === c.id);
                          const sectionIds = new Set(sectionsOfCourse.map(s => String(s.id)));
                          const studentCount = studentAssignments.filter(a => a.sectionId && sectionIds.has(String(a.sectionId))).length;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { const isSelected = cascadeCourseId === c.id; setCascadeCourseId(isSelected ? null : c.id); setCascadeSectionId(null); setCascadeSubject(null); setComboSectionId('all'); setSubjectFilter('all'); setStudentFilter('all'); }}
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs border transition ${
                                cascadeCourseId === c.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200'
                              }`}
                              title={`${studentCount} estudiante(s)`}
                            >{c.name} <span className="ml-2 opacity-80">({studentCount})</span></button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Secciones: visibles con curso seleccionado o solo nivel */}
                {(cascadeCourseId || levelFilter !== 'all') && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{tr('sections', 'Secciones')}</div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        let list = sections.slice();
                        if (cascadeCourseId) {
                          list = list.filter(s => s.courseId === cascadeCourseId);
                        } else if (levelFilter !== 'all') {
                          list = list.filter(s => getCourseLevel(courseById.get(s.courseId)?.name) === levelFilter);
                        }
                        list.sort((a, b) => {
                          const ca = courseById.get(a.courseId)?.name || '';
                          const cb = courseById.get(b.courseId)?.name || '';
                          const ra = courseRank(ca);
                          const rb = courseRank(cb);
                          if (ra !== rb) return ra - rb;
                          const sa = sectionRank(a.name);
                          const sb = sectionRank(b.name);
                          if (sa !== sb) return sa - sb;
                          const na = `${ca} ${a.name}`.trim();
                          const nb = `${cb} ${b.name}`.trim();
                          return na.localeCompare(nb, undefined, { sensitivity: 'base' });
                        });
                        return list;
                      })().map(s => {
                        const studentCount = studentAssignments.filter(a => String(a.sectionId) === String(s.id)).length;
                        const courseName = courseById.get(s.courseId)?.name;
                        const label = cascadeCourseId ? s.name : `${courseName ?? ''} ${s.name}`.trim();
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { const isSelected = cascadeSectionId === s.id; setCascadeSectionId(isSelected ? null : s.id); setCascadeSubject(null); setComboSectionId(isSelected ? 'all' : String(s.id)); setSubjectFilter('all'); setStudentFilter('all'); }}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs border transition ${
                              cascadeSectionId === s.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200'
                            }`}
                            title={`${studentCount} estudiante(s)`}
                          >{label} <span className="ml-2 opacity-80">({studentCount})</span></button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Asignaturas de la sección seleccionada */}
                {cascadeSectionId && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{tr('subjects', 'Asignaturas')}</div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const names = new Set<string>();
                        teacherAssignments.forEach(a => {
                          if (String(a.sectionId) !== String(cascadeSectionId)) return;
                          const list: string[] = Array.isArray(a.subjects) ? a.subjects : (a.subjectName ? [a.subjectName] : []);
                          list.forEach(n => { if (n) names.add(String(n)); });
                        });
                        const items = Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                        return items.length > 0 ? items : ['General'];
                      })().map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { const isSelected = cascadeSubject === n; setCascadeSubject(isSelected ? null : n); setSubjectFilter(isSelected || n === 'General' ? 'all' : n); }}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs border transition ${
                            cascadeSubject === n ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200'
                          }`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estudiantes de la sección (con selección/toggle) */}
                {cascadeSectionId && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{tr('students', 'Estudiantes')}</div>
                    <div className="flex flex-wrap gap-2">
                      {users
                        .filter(u => (u?.role === 'student' || u?.role === 'estudiante'))
                        .filter(u => studentAssignments.some(a => (String(a.studentId) === String(u.id) || String(a.studentUsername) === String(u.username)) && String(a.sectionId) === String(cascadeSectionId)))
                        .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')))
                        .map(u => {
                          const selected = studentFilter !== 'all' && String(studentFilter) === String(u.id);
                          return (
                            <button
                              key={String(u.id)}
                              type="button"
                              onClick={() => setStudentFilter(selected ? 'all' : String(u.id))}
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs border transition ${
                                selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200'
                              }`}
                            >{u.displayName || u.name || u.username}</button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Filtro de Semestre inferior (sin "Todos los semestres") */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">{tr('filterSemester', 'Semestre')}</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setSemester(semester === '1' ? 'all' : '1')}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs border transition ${
                        semester === '1'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200'
                      }`}
                    >{tr('firstSemester', '1er Semestre')}</button>
                    <button
                      type="button"
                      onClick={() => setSemester(semester === '2' ? 'all' : '2')}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs border transition ${
                        semester === '2'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200'
                      }`}
                    >{tr('secondSemester', '2do Semestre')}</button>
                    {/* Botones de notas demo eliminados */}
                  </div>
                </div>

                {/* Botón de sincronización manual eliminado: la sincronización ahora es automática por eventos */}
              </div>
              {/* La tabla de resultados se mantiene debajo del Card en la misma columna */}
          </CardContent>
        </Card>

        {/* Resultados: un cuadro (Card) separado por cada asignatura - permanecen en columna izquierda */}
  {studentsInView.length === 0 ? (
          <Card className="mt-4"><CardContent><div className="text-muted-foreground text-sm">{tr('noStudentsForFilters', 'Sin estudiantes para los filtros seleccionados')}</div></CardContent></Card>
        ) : (
          (() => {
            let subjectsToRender: string[] = [];
            if (subjectFilter !== 'all') {
              subjectsToRender = [subjectFilter];
            } else if (cascadeSubject) {
              subjectsToRender = [cascadeSubject];
            } else {
              const nameSet = new Set<string>();
              teacherAssignments.forEach(a => {
                if (!a || !a.sectionId || !visibleSectionIds.has(String(a.sectionId))) return;
                const names: string[] = Array.isArray(a.subjects) ? a.subjects : (a.subjectName ? [a.subjectName] : []);
                names.forEach(n => { if (n) nameSet.add(String(n)); });
              });
              if (nameSet.size === 0) {
                subjects.forEach(su => { if (su?.name) nameSet.add(String(su.name)); });
              }
              subjectsToRender = Array.from(nameSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            }
            if (subjectsToRender.length === 0) subjectsToRender = [''];
            return (
              <div className="pr-2">
                {subjectsToRender.map((subjName, idx) => (
                  <Card key={`card-${subjName || 'general'}`} className="mt-4">
                    <CardContent>
                  {/* Evitar scroll vertical dentro de cada tabla de asignatura; mantener solo scroll horizontal si es necesario */}
                  <div className="overflow-x-auto overflow-y-visible pb-10">
                    {/* Tabla optimizada: menos espacios vacíos, promedio visible sin scroll */}
                    <table className="w-full table-fixed text-sm border-collapse">
                      <colgroup>
                        {/* Curso/Sección 18% - reducido */}
                        <col style={{ width: '18%' }} />
                        {/* Estudiante 14% - reducido */}
                        <col style={{ width: '14%' }} />
                        {/* Asignatura 20% - reducido */}
                        <col style={{ width: '20%' }} />
                        {/* N1..N10: 10 × 3.8% = 38% - aumentado para mejor visibilidad */}
                        {Array.from({ length: 10 }).map((_, i) => (
                          <col key={i} style={{ width: '3.8%' }} />
                        ))}
                        {/* Promedio 10% - aumentado significativamente */}
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      {/* Encabezado visible solo en la primera tabla */}
                      {idx === 0 && (
                        <thead>
                          <tr>
                            <th className="py-2 px-2 align-bottom text-left whitespace-nowrap text-sm">{tr('courseSection', 'Curso/Sección')}</th>
                            <th className="py-2 px-2 align-bottom text-left whitespace-nowrap text-sm">{tr('student', 'Estudiante')}</th>
                            <th className="py-2 px-2 align-bottom text-left whitespace-nowrap text-sm">{tr('subject', 'Asignatura')}</th>
                            <th className="py-2 px-2 text-center font-semibold text-sm" colSpan={10}>
                              {semester === '1' ? tr('firstSemester', '1er Semestre') : semester === '2' ? tr('secondSemester', '2do Semestre') : tr('allSemesters', 'Todos los semestres')}
                            </th>
                            <th className="py-2 px-2 align-bottom text-center whitespace-nowrap text-sm">{tr('average', 'Promedio')}</th>
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {(() => {
                          let prevGroup: string | null = null;
                          const rows: React.ReactNode[] = [];
                          studentsInView.forEach((stu) => {
                            const assign = studentAssignments.find(a => (String(a.studentId) === String(stu.id) || String(a.studentUsername) === String(stu.username)) && visibleSectionIds.has(String(a.sectionId)));
                            const section = sections.find(s => String(s.id) === String(assign?.sectionId));
                            const course = courses.find(c => String(c.id) === String(section?.courseId));
                            const listAll = filteredGrades.filter(g => String(g.studentId) === String(stu.id));
                            const nameOf = (g: any) => {
                              const found = subjects.find(su => String(su.id) === String(g.subjectId));
                              return found?.name || (g.subjectId ? String(g.subjectId) : '');
                            };
                            const list = listAll.filter(g => (subjectFilter === 'all' ? nameOf(g) === subjName : true)).slice(0, 10);
                            const rowAvg = list.length ? Math.round((list.reduce((acc, g) => acc + (Number(g.score) || 0), 0) / list.length) * 10) / 10 : null;
                            const subjectName = subjName || (subjectFilter !== 'all' ? subjectFilter : '');
                            const courseSectionLabel = `${course?.name || ''} ${section?.name || ''}`.trim() || '—';

                            if (courseSectionLabel !== prevGroup) {
                              rows.push(
                                <tr key={`grp-${subjName || 'general'}-${courseSectionLabel}`} className="border-t">
                                  {/* Curso/Sección ocupa las tres primeras columnas */}
                                  <td className="py-1 px-2 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200" colSpan={3}>
                                    {courseSectionLabel}
                                  </td>
                                  {/* N1..N10 en la fila azul */}
                                  {Array.from({ length: 10 }).map((_, i) => {
                                    const pendingTask = getPendingTaskForColumn(i, subjName || '', section?.id);
                                    const bubble = pendingTask?.taskType === 'evaluacion'
                                      ? { bg: 'bg-purple-600', text: 'text-white', title: 'Evaluación', icon: '📊' }
                                      : pendingTask?.taskType === 'prueba'
                                        ? { bg: 'bg-indigo-600', text: 'text-white', title: 'Prueba', icon: '🧪' }
                                        : { bg: 'bg-orange-600', text: 'text-white', title: 'Tarea', icon: '📝' };
                                    return (
                                      <td key={`grp-n-${i}`} className="py-1 px-1 text-center text-xs bg-indigo-50 dark:bg-indigo-900/30">
                                        <div className="relative inline-block group">
                                          {pendingTask ? (
                                            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${bubble.bg} ${bubble.text}`}>
                                              {`N${i + 1}`}
                                            </span>
                                          ) : (
                                            <span className={'text-indigo-700 dark:text-indigo-200'}>{`N${i + 1}`}</span>
                                          )}
                                          {pendingTask && (
                                            <div className="absolute left-1/2 top-full transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[9999] pointer-events-none">
                                              <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-[11px] rounded-md px-3 py-2 shadow-xl border border-gray-200 dark:border-gray-600 min-w-[220px] max-w-[260px]">
                                                <div className={`font-semibold mb-1 flex items-center gap-2 ${pendingTask.taskType === 'evaluacion' ? 'text-purple-600 dark:text-purple-200' : pendingTask.taskType === 'prueba' ? 'text-indigo-600 dark:text-indigo-200' : 'text-orange-600 dark:text-orange-200'}`}>
                                                  <span>{bubble.icon}</span>
                                                  <span className="truncate max-w-[180px]">{bubble.title}: {pendingTask.title}</span>
                                                </div>
                                                <div className="text-gray-700 dark:text-gray-200 space-y-0.5">
                                                  <div className="flex items-center gap-2"><span>🧩</span><span className="truncate max-w-[200px]">Tema: {(pendingTask as any).topic || pendingTask.title}</span></div>
                                                  <div className="flex items-center gap-2"><span>📅</span><span>Fecha: {formatDate(pendingTask.createdAt)}</span></div>
                                                </div>
                                              </div>
                                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2">
                                                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-white dark:border-b-gray-900"></div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  {/* Celda de cierre para la columna Promedio */}
                                  <td className="py-1 px-1 bg-indigo-50 dark:bg-indigo-900/30"></td>
                                </tr>
                              );
                              prevGroup = courseSectionLabel;
                            }

                            rows.push(
                              <tr key={`${String(stu.id)}-${String(assign?.sectionId)}-${subjName || 'general'}`} className="border-b">
                                <td className="py-2 px-2 text-sm" title={courseSectionLabel}></td>
                                <td className="py-2 px-2 whitespace-nowrap text-sm">{stu.displayName || stu.name || stu.username || '—'}</td>
                                {/* Asignatura con mejor ajuste de espacio */}
                                <td className="py-2 px-2 whitespace-normal break-words leading-tight text-sm" title={subjectName || '—'}>{subjectName || '—'}</td>
                                {Array.from({ length: 10 }).map((_, idx) => {
                                  const g = list[idx];
                                  return (
                                    <td key={idx} className="py-1 px-1 text-center">
                                      {g ? <span className={scoreBadgeClass(g.score)}>{g.score}</span> : <span className="text-muted-foreground text-xs">—</span>}
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-2 text-center font-semibold whitespace-nowrap">
                                  {rowAvg === null ? '—' : <span className={scoreBadgeClass(rowAvg)}>{rowAvg}</span>}
                                </td>
                              </tr>
                            );
                          });
                          return rows;
                        })()}
                        {/* Fila de Promedio General por tabla eliminada: se muestra un resumen único al final */}
                      </tbody>
                    </table>
                  </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()
        )}
        </div>

        {/* Resumen final: Promedio General según filtros activos */}
        {studentsInView.length > 0 && (
          <Card className="mt-2">
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm border-collapse">
                  <colgroup>
                    <col style={{ width: '90%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="py-2 px-2 text-left whitespace-nowrap text-sm">{tr('summary', 'Resumen')}</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap text-sm">{tr('average', 'Promedio')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="py-2 px-2 whitespace-nowrap text-sm">{tr('generalAverage', 'Promedio General')}</td>
                      <td className="py-2 px-2 text-center font-semibold whitespace-nowrap">
                        {avg === null ? '—' : <span className={scoreBadgeClass(avg)}>{avg}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Panel de tareas pendientes de calificación */}
  {filteredPendingCards.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="animate-pulse">🔔</span>
    Pendientes de Calificación ({filteredPendingCards.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredPendingCards.map((task) => {
                  // Datos auxiliares para etiquetas y N dinámico
                  const secs = loadJson<any[]>('smart-student-sections', []);
                  const crs = loadJson<any[]>('smart-student-courses', []);
                  const assigns = loadJson<any[]>('smart-student-student-assignments', []);
                  const isUuidLike = (s?: string) => !!s && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(s);
                  // Normalización idéntica a la usada en la tabla y en loadPendingTasksBySubject
                  const normSubj = (s?: string) => {
                    const base = String(s || 'General')
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .toLowerCase()
                      .replace(/\s+/g, ' ')
                      .trim();
                    return base.endsWith('s') ? base.slice(0, -1) : base;
                  };
                  // Resolver sección para el cálculo de N por sección
                  let resolvedSectionId: string | null = task.sectionId ? String(task.sectionId) : null;
                  // Si no viene definida y solo hay una sección visible, usarla como fallback (coincide con el filtro aplicado arriba)
                  if (!resolvedSectionId) {
                    const secsVisible = new Set<string>([...visibleSectionIds]);
                    if (secsVisible.size === 1) {
                      resolvedSectionId = Array.from(secsVisible)[0];
                    }
                  }
                  if (!resolvedSectionId && task.assignedTo === 'student' && Array.isArray(task.assignedStudentIds) && task.assignedStudentIds.length > 0) {
                    const sid = String(task.assignedStudentIds[0]);
                    const asg = assigns.find(a => String(a.studentId) === sid || String(a.studentUsername) === sid);
                    if (asg?.sectionId) resolvedSectionId = String(asg.sectionId);
                  }
                  if (!resolvedSectionId && task.course) {
                    // Si task.course parece un sectionId
                    const secById = secs.find(s => String(s.id) === String(task.course));
                    if (secById) {
                      resolvedSectionId = String(secById.id);
                    } else {
                      // Intentar derivar la sección desde la etiqueta "CursoNombre Sección"
                      const target = String(task.course);
                      for (const s of secs) {
                        const c = crs.find((cc: any) => String(cc.id) === String(s.courseId));
                        const label = `${c?.name || ''} ${s.name}`.trim();
                        if (label && label.toLowerCase() === target.toLowerCase()) { resolvedSectionId = String(s.id); break; }
                      }
                    }
                  }
                  // Calcular N dinámico según asignatura+sección en loadPendingTasksBySubject
                  let computedN = task.columnIndex + 1;
                  if (resolvedSectionId) {
                    const key = `${normSubj(task.subject)}__${resolvedSectionId}`;
                    const arr = loadPendingTasksBySubject.get(key) || [];
                    const idx = arr.findIndex((t: any) => String(t.id) === String(task.taskId));
                    if (idx >= 0) computedN = idx + 1;
                  }
                  // Determinar etiqueta Curso/Sección con múltiples estrategias
                  let courseSectionLabel = '';
                  try {
                    if (task.sectionId) {
                      const sec = secs.find(s => String(s.id) === String(task.sectionId));
                      if (sec) {
                        const courseObj = crs.find(c => String(c.id) === String(sec.courseId));
                        courseSectionLabel = `${courseObj?.name || ''} ${sec.name}`.trim();
                      }
                    } else if (task.assignedTo === 'student' && Array.isArray(task.assignedStudentIds) && task.assignedStudentIds.length > 0) {
                      // Inferir sección desde el primer estudiante asignado
                      const sid = String(task.assignedStudentIds[0]);
                      const asg = assigns.find(a => String(a.studentId) === sid || String(a.studentUsername) === sid);
                      if (asg?.sectionId) {
                        const sec = secs.find(s => String(s.id) === String(asg.sectionId));
                        if (sec) {
                          const courseObj = crs.find(c => String(c.id) === String(sec.courseId));
                          courseSectionLabel = `${courseObj?.name || ''} ${sec.name}`.trim();
                        }
                      }
                    } else if (task.courseId) {
                      const courseObj = crs.find(c => String(c.id) === String(task.courseId));
                      if (courseObj) courseSectionLabel = String(courseObj.name || '');
                    } else if (task.course) {
                      // Si task.course coincide con una sección
                      const sec = secs.find(s => String(s.id) === String(task.course));
                      if (sec) {
                        const courseObj = crs.find(c => String(c.id) === String(sec.courseId));
                        courseSectionLabel = `${courseObj?.name || ''} ${sec.name}`.trim();
                      } else {
                        // Si coincide con un curso por id
                        const courseObj = crs.find(c => String(c.id) === String(task.course));
                        if (courseObj) courseSectionLabel = String(courseObj.name || '');
                      }
                    }
                    // Fallback: usar task.course solo si no parece un UUID/código
                    if (!courseSectionLabel) {
                      const maybe = String(task.course || '');
                      if (maybe && !isUuidLike(maybe)) courseSectionLabel = maybe;
                    }
                  } catch {}
                  const colorWrap = task.taskType === 'evaluacion'
                    ? { ring: 'border-purple-200 dark:border-purple-700', bg: 'bg-purple-50 dark:bg-purple-900/20', tag: 'text-purple-700 dark:text-purple-300', icon: '📊', title: 'Evaluación' }
                    : task.taskType === 'prueba'
                      ? { ring: 'border-indigo-200 dark:border-indigo-700', bg: 'bg-indigo-50 dark:bg-indigo-900/20', tag: 'text-indigo-700 dark:text-indigo-300', icon: '🧪', title: 'Prueba' }
                      : { ring: 'border-orange-200 dark:border-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/20', tag: 'text-orange-700 dark:text-orange-300', icon: '📝', title: 'Tarea' };
                  return (
                    <div key={task.taskId} className={`flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border ${colorWrap.ring}`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 ${colorWrap.bg} ${colorWrap.tag} rounded-full font-bold text-sm`}>
                          N{computedN}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            <span className="mr-1">{colorWrap.icon}</span>{colorWrap.title}: {task.title}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {task.subject} • {courseSectionLabel || task.course || '—'} • {formatDate(task.createdAt)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {task.assignedTo === 'course' ? 'Todo el curso' : `${task.assignedStudentIds?.length || 0} estudiante(s) específico(s)`}
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-medium ${colorWrap.tag}`}>
                        Pendiente
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/40">
                <p className="text-sm text-muted-foreground">
                  💡 Consejo: Las columnas N1–N10 se asignan estrictamente por orden de creación (createdAt). Colores: 📝 Tarea (naranja), 📊 Evaluación (morado), 🧪 Prueba (índigo).
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
