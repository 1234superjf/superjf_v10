"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, ClipboardList, FileCheck2, Users, Activity, TrendingUp, Clock, Download, ChevronDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ensureDemoTeacherData } from '@/lib/demo/teacher-stats-demo';
import TrendChart from '@/components/charts/TrendChart';
// Componente: Gráfico temporal de asistencia con filtros por curso y estudiante
function AttendanceTrendCard({
  period,
  teacherUsername,
  teacherCourses,
}: {
  period: Period;
  teacherUsername: string;
  teacherCourses: Array<{ id: string; courseId: string; sectionId: string; label: string; level?: Level }>;
}) {
  const [course, setCourse] = useState<string | 'all'>('all');
  const [student, setStudent] = useState<string | 'all'>('all');

  // Rango de fechas
  const timeWindow = getTimeWindow(period);
  const fromTs = timeWindow.from ?? (Date.now() - days(30));
  const toTs = Date.now();

  // Estudiantes asignados a la sección seleccionada (si aplica)
  const assignedStudents = useMemo(() => {
    try {
      if (course === 'all') return [] as Array<{ username: string; displayName: string }>; 
      const sectionId = course.split('-').slice(-1)[0];
      const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const assignments = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
      const ids = assignments.filter((a: any) => a.sectionId === sectionId).map((a: any) => a.studentId || a.studentUsername);
      const mapped = users
        .filter((u: any) => u.role === 'student' && (ids.includes(u.id) || ids.includes(u.username)))
        .map((u: any) => ({ username: u.username || u.id, displayName: u.displayName || u.name || u.username }));
      // Orden alfabético
  mapped.sort((a: { username: string; displayName: string }, b: { username: string; displayName: string }) => (a.displayName || '').localeCompare(b.displayName || ''));
      return mapped;
    } catch { return []; }
  }, [course]);

  // Serie temporal: porcentaje de presencia por día (0-100)
  const { series, labels } = useMemo(() => {
    try {
      const att = JSON.parse(localStorage.getItem('smart-student-attendance') || '[]');
      const dayMs = days(1);
      const buckets: { from: number; to: number }[] = [];
      let ptr = fromTs - (fromTs % dayMs); // alineado a medianoche local aproximada
      const end = toTs;
      while (ptr <= end) {
        buckets.push({ from: ptr, to: ptr + dayMs });
        ptr += dayMs;
      }

      const isInBucket = (ts: number, b: { from: number; to: number }) => ts >= b.from && ts < b.to;
      const parseDateAny = (s: any): number => {
        if (!s) return 0;
        if (typeof s === 'number') return s; // epoch ms
        if (typeof s === 'string') {
          // Si ya es ISO o similar, Date.parse
          if (s.includes('T') || s.includes(':') || s.includes('/')) {
            const t = Date.parse(s);
            return Number.isNaN(t) ? 0 : t;
          }
          // Formato YYYY-MM-DD
          const parts = s.split('-').map(Number);
          const Y = parts[0]; const M = parts[1]; const D = parts[2];
          if (Y && M && D) return new Date(Y, (M || 1) - 1, D || 1).getTime();
          const t = Date.parse(s);
          return Number.isNaN(t) ? 0 : t;
        }
        return 0;
      };

      const filtered = (att as any[]).filter(a => {
        // Filtrar por profesor si existe el campo (respetando asistencia unificada)
        if (teacherUsername && a.teacherUsername && a.teacherUsername !== teacherUsername) {
          // mantener: la asistencia es única, pero si se guardó teacherUsername distinto, no contamos en stats del profesor
          return false;
        }
        // Filtro por curso (course es id compuesto courseId-sectionId)
        if (course !== 'all' && a.course !== course) return false;
        // Filtro por estudiante
        if (student !== 'all' && a.studentUsername !== student) return false;
        // Filtro por tiempo
        const t = a.timestamp ? (typeof a.timestamp === 'number' ? a.timestamp : Date.parse(a.timestamp)) : parseDateAny(a.date);
        if (Number.isNaN(t)) return false;
        if (timeWindow.from && t < timeWindow.from) return false;
        return t <= toTs;
      });

      const seriesVals: number[] = [];
      const labelsStr: string[] = [];

      buckets.forEach(b => {
        const dayRecs = filtered.filter(a => {
          const t = a.timestamp ? (typeof a.timestamp === 'number' ? a.timestamp : Date.parse(a.timestamp)) : parseDateAny(a.date);
          return isInBucket(t, b);
        });
        const total = dayRecs.length;
        const present = dayRecs.filter(a => a.status === 'present').length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        seriesVals.push(pct);
        const d = new Date(b.from);
        labelsStr.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
      });

      // Fallback demo: si no hay datos o todos 0, generar histórico aleatorio estable
      const hasSignal = seriesVals.some(v => v > 0);
      if (!hasSignal) {
        const seed = (teacherUsername || 'demo') + '|' + String(fromTs) + '|' + String(toTs) + '|' + String(course) + '|' + String(student);
        let h = 2166136261;
        for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
        const rnd = () => {
          // xorshift32 simple
          h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000;
        };
        const synth: number[] = [];
        let base = 82 + Math.round(rnd() * 10); // 82-92%
        for (let i = 0; i < buckets.length; i++) {
          const drift = (rnd() - 0.5) * 4; // +-2%
          base = Math.max(60, Math.min(98, base + drift));
          // ocasionales bajones
          const shock = rnd() < 0.06 ? -10 - rnd() * 10 : 0;
          const val = Math.round(Math.max(40, Math.min(99, base + shock)));
          synth.push(val);
        }
        return { series: synth, labels: labelsStr };
      }
      return { series: seriesVals, labels: labelsStr };
    } catch {
      return { series: [], labels: [] };
    }
  }, [period, course, student, teacherUsername, fromTs, toTs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Asistencia en el tiempo</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtros locales */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Curso</span>
            <div className="flex flex-wrap gap-2">
              <button
                className={`text-xs px-2 py-1 rounded border ${course === 'all' ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                onClick={() => { setCourse('all'); setStudent('all'); }}
              >Todos</button>
              {teacherCourses.map(tc => (
                <button
                  key={tc.id}
                  className={`text-xs px-2 py-1 rounded border truncate max-w-[10rem] ${course === tc.id ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                  onClick={() => { setCourse(tc.id); setStudent('all'); }}
                  title={tc.label}
                >{tc.label}</button>
              ))}
            </div>
          </div>

          {/* Estudiante (si hay curso seleccionado) */}
          {course !== 'all' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estudiante</span>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`text-xs px-2 py-1 rounded border ${student === 'all' ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                  onClick={() => setStudent('all')}
                >Todos</button>
                {assignedStudents.map((s: { username: string; displayName: string }) => (
                  <button
                    key={s.username}
                    className={`text-xs px-2 py-1 rounded border truncate max-w-[10rem] ${student === s.username ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                    onClick={() => setStudent(s.username)}
                    title={s.displayName}
                  >{s.displayName}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {series.length > 0 ? (
          <TrendChart data={series} labels={labels} color={'#34D399'} height={200} />
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos</p>
        )}
      </CardContent>
    </Card>
  );
}


type Period = '7d' | '30d' | '90d' | 'all';
type Level = 'basica' | 'media';

type StatsFilters = {
  courseSectionId?: string; // id compuesto courseId-sectionId
  level?: Level; // filtra por nivel del curso
};

interface TimeWindow {
  from?: number; // epoch ms
}

const now = () => Date.now();
const days = (n: number) => n * 24 * 60 * 60 * 1000;

function getTimeWindow(period: Period): TimeWindow {
  switch (period) {
    case '7d': return { from: now() - days(7) };
    case '30d': return { from: now() - days(30) };
    case '90d': return { from: now() - days(90) };
    default: return {}; // all time
  }
}

function parseWhen(x: any): number | undefined {
  const candidates = [x?.timestamp, x?.createdAt, x?.updatedAt, x?.date];
  for (const c of candidates) {
    if (!c) continue;
    const t = typeof c === 'number' ? c : Date.parse(c);
    if (!Number.isNaN(t)) return t;
  }
  return undefined;
}

function belongsToTeacher(x: any, username?: string): boolean {
  if (!username || !x) return false;
  const fields = [
    x.teacherUsername,
    x.teacher,
    x.createdBy,
    x.createdByUsername,
    x.ownerUsername,
    x.assignedBy,
  ];
  return fields.includes(username);
}

function useTeacherStats(username?: string, period: Period = '30d', filters?: StatsFilters) {
  const [refreshTick, setRefreshTick] = useState(0);
  const timeWindow = getTimeWindow(period);

  useEffect(() => {
    const onStorage = () => setRefreshTick(t => t + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return;
  }, []);

  const read = (key: string): any[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  };

  const value = useMemo(() => {
    if (!username) {
      return {
        tasksCreated: 0,
        evaluationTasks: 0,
        submissions: 0,
        gradedSubmissions: 0,
        avgGrade: undefined as number | undefined,
        attendance: { present: 0, total: 0 },
      };
    }

    const inWindow = (x: any) => {
      const t = parseWhen(x);
      if (timeWindow.from && t) return t >= timeWindow.from;
      return true;
    };

    // Helpers para filtrar por curso/nivel
    const readRaw = (key: string): any[] => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
    const coursesAll = [...readRaw('smart-student-admin-courses'), ...readRaw('smart-student-courses')];
    const sectionsAll = [...readRaw('smart-student-admin-sections'), ...readRaw('smart-student-sections')];
    const levelByCourseId: Record<string, Level | undefined> = {};
    coursesAll.forEach((c: any) => { if (c?.id) levelByCourseId[c.id] = (c.level as Level) || undefined; });

    const extractCourseSectionId = (obj: any): string | undefined => {
      // intenta obtiene id compuesto desde varios campos comunes
      const cs = obj?.courseSectionId || obj?.course || obj?.courseIdSectionId;
      if (cs && typeof cs === 'string' && cs.includes('-')) return cs;
      const courseId = obj?.courseId || obj?.course?.id || obj?.course;
      const sectionId = obj?.sectionId || obj?.section?.id || obj?.section;
      if (courseId && sectionId) return `${courseId}-${sectionId}`;
      // A veces solo viene sectionId: derivar courseId
      if (!courseId && sectionId) {
        const s = sectionsAll.find((s: any) => s && (s.id === sectionId || s.sectionId === sectionId));
        const cId = s?.courseId || (s?.course && (s.course.id || s.courseId));
        if (cId) return `${cId}-${sectionId}`;
      }
      return undefined;
    };

    const extractCourseLevel = (obj: any): Level | undefined => {
      const csId = extractCourseSectionId(obj);
      if (!csId) return undefined;
      const parts = csId.split('-');
      const cId = parts.length >= 2 ? parts.slice(0, parts.length - 1).join('-') : parts[0];
      return levelByCourseId[cId];
    };

    const matchFilters = (obj: any): boolean => {
      if (!filters) return true;
      const { courseSectionId, level } = filters;
      if (courseSectionId) {
        const csId = extractCourseSectionId(obj);
        if (csId !== courseSectionId) return false;
      }
      if (level) {
        const lvl = extractCourseLevel(obj);
        if (lvl !== level) return false;
      }
      return true;
    };

    // TAREAS
    const tasks: any[] = read('smart-student-tasks');
  const teacherTasks = tasks.filter(t => belongsToTeacher(t, username));
  const teacherTasksInWindow = teacherTasks.filter(inWindow).filter(matchFilters);
    const tasksCreated = teacherTasksInWindow.length;
    const evaluationTasks = teacherTasksInWindow.filter(t => (t.type === 'evaluation' || t.taskType === 'evaluation')).length;

    // ENTREGAS (SUBMISSIONS)
    const submissions: any[] = read('smart-student-submissions');
    // Preferimos enlazar por taskId si existe y el task es del profesor
    const taskIdsOfTeacher = new Set((teacherTasks as any[]).map(t => t.id || t.taskId));
  const teacherSubs = submissions.filter(s => {
      const byLink = s.taskId && taskIdsOfTeacher.has(s.taskId);
      const byOwner = belongsToTeacher(s, username);
      return byLink || byOwner;
  }).filter(inWindow).filter(matchFilters);
    const gradedSubs = teacherSubs.filter(s => typeof s.grade === 'number' || s.isGraded === true);
    const rawVal = (s: any) => (typeof s.grade === 'number' ? s.grade : (s.score ?? 0));
    const norm100 = (s: any) => {
      const v = rawVal(s);
      return v <= 1 ? v * 100 : v; // normalizamos a 0-100 si vino en 0-1
    };
    const avgGrade = gradedSubs.length > 0
      ? (gradedSubs.reduce((acc, s) => acc + rawVal(s), 0) / gradedSubs.length)
      : undefined;
    const avgScore100 = gradedSubs.length > 0
      ? (gradedSubs.reduce((acc, s) => acc + norm100(s), 0) / gradedSubs.length)
      : undefined;
    const avgScore20 = typeof avgScore100 === 'number' ? avgScore100 / 5 : undefined;

    // ASISTENCIA
    const attendance: any[] = read('smart-student-attendance');
  const teacherAtt = attendance.filter(a => a.teacherUsername === username).filter(inWindow).filter(matchFilters);
    const present = teacherAtt.filter(a => a.status === 'present').length;
    const total = teacherAtt.length;

    // Tendencia por día
    const bucketSize = 1; // días
  const fromTs = timeWindow.from ?? (teacherSubs.reduce((min, s) => Math.min(min, parseWhen(s) ?? now()), now()));
    const toTs = now();
    const daysCount = Math.max(1, Math.ceil((toTs - fromTs) / days(bucketSize)));
    const series = new Array(daysCount).fill(0) as number[];
    teacherSubs.forEach(s => {
      const t = parseWhen(s);
      if (!t) return;
      const idx = Math.min(daysCount - 1, Math.floor((t - fromTs) / days(bucketSize)));
      if (idx >= 0) series[idx] += 1;
    });

    // Cursos/secciones top por entregas
    const courseCounts: Record<string, number> = {};
    teacherSubs.forEach(s => {
      const course = s.course || s.courseId || s.sectionId || '—';
      courseCounts[course] = (courseCounts[course] || 0) + 1;
    });
    const topCourses = Object.entries(courseCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Distribución de notas (asumiendo 0-100 si viene score, o número libre en grade)
    const bins = { low: 0, mid: 0, high: 0, top: 0 };
    gradedSubs.forEach(s => {
      const score = norm100(s); // 0-100
      if (score <= 40) bins.low++; else if (score <= 60) bins.mid++; else if (score <= 80) bins.high++; else bins.top++;
    });

    // Aprobados/Reprobados (umbral 60)
    const approvedCount = bins.high + bins.top;
    const failedCount = bins.low + bins.mid;

    // Promedio destacado por estudiante (0-20)
    const byStudent: Record<string, { sum: number; n: number }> = {};
    gradedSubs.forEach(s => {
      const key = s.studentUsername || s.studentId || s.userId || '—';
      const sc = norm100(s);
      if (!byStudent[key]) byStudent[key] = { sum: 0, n: 0 };
      byStudent[key].sum += sc; byStudent[key].n += 1;
    });
    const topStudentAvg20 = Object.values(byStudent).length
      ? Math.max(...Object.values(byStudent).map(x => (x.sum / x.n) / 5))
      : undefined;

    // Promedio por curso (0-20) para "Comparación de Cursos"
    const byCourse: Record<string, { sum: number; n: number }> = {};
    gradedSubs.forEach(s => {
      const course = s.course || s.courseId || s.sectionId || '—';
      const sc = norm100(s);
      if (!byCourse[course]) byCourse[course] = { sum: 0, n: 0 };
      byCourse[course].sum += sc; byCourse[course].n += 1;
    });
    const courseAvg20 = Object.entries(byCourse)
      .map(([label, v]) => ({ label, avg20: (v.sum / Math.max(1, v.n)) / 5 }))
      .sort((a, b) => b.avg20 - a.avg20)
      .slice(0, 5);

    // Promedio mensual (últimos 5 meses) 0-20 para "Notas por Fecha"
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const labelsES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const nowD = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: labelsES[d.getMonth()] });
    }
    const monthlyAgg: Record<string, { sum: number; n: number }> = {};
    months.forEach(m => (monthlyAgg[m.key] = { sum: 0, n: 0 }));
    gradedSubs.forEach(s => {
      const t = parseWhen(s);
      if (!t) return;
      const d = new Date(t);
      const key = monthKey(d);
      if (!(key in monthlyAgg)) return;
      monthlyAgg[key].sum += norm100(s);
      monthlyAgg[key].n += 1;
    });
    const monthlyAvg20 = months.map(m => (
      monthlyAgg[m.key].n > 0 ? (monthlyAgg[m.key].sum / monthlyAgg[m.key].n) / 5 : 0
    ));
    const monthlyLabels = months.map(m => m.label);

    return {
      tasksCreated,
      evaluationTasks,
      submissions: teacherSubs.length,
      gradedSubmissions: gradedSubs.length,
      avgGrade,
  avgScore20: avgScore20,
      attendance: { present, total },
      trendSeries: series,
      topCourses,
      gradeBins: bins,
  approvedCount,
  failedCount,
  topStudentAvg20,
  courseAvg20,
  monthlyAvg20,
  monthlyLabels,
      _debug: refreshTick,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, period, timeWindow.from, refreshTick, JSON.stringify(filters)]);

  return value;
}

export default function TeacherStatisticsPage() {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const [period, setPeriod] = useState<Period>('30d');
  const [selectedCourse, setSelectedCourse] = useState<string | 'all'>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | Level>('all');
  const router = useRouter();

  // Generar datos demo si el entorno está vacío (solo cliente)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Intento gentil: si no existen claves o no hay datos del profesor, generamos
    try {
      const u = user?.username;
      if (!u) return;
      const tasks = JSON.parse(localStorage.getItem('smart-student-tasks') || '[]');
      const subs = JSON.parse(localStorage.getItem('smart-student-submissions') || '[]');
      const att = JSON.parse(localStorage.getItem('smart-student-attendance') || '[]');
      const hasData =
        tasks.some((t: any) => t.teacherUsername === u) ||
        subs.some((s: any) => s.teacherUsername === u || s.taskTeacherUsername === u) ||
        att.some((a: any) => a.teacherUsername === u);
      if (!hasData) {
        ensureDemoTeacherData(u);
      }
    } catch {}
  }, [user?.username]);

  const stats = useTeacherStats(
    user?.username,
    period,
    {
      courseSectionId: selectedCourse !== 'all' ? selectedCourse : undefined,
      level: selectedLevel !== 'all' ? selectedLevel : undefined,
    }
  );

  const t = (key: string, fallback?: string) => {
    const v = translate(key);
    return v === key ? (fallback ?? key) : v;
  };

  const attendanceRate = stats.attendance.total > 0
    ? Math.round((stats.attendance.present / stats.attendance.total) * 100)
    : 0;

  // Actividad reciente (memoizada fuera del JSX)
  const recentActivity = useMemo(() => {
    const read = (key: string): any[] => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
    const tasks: any[] = read('smart-student-tasks');
    const subs: any[] = read('smart-student-submissions');
    const taskMap = new Map<string, any>();
    tasks.forEach(t => taskMap.set(t.id || t.taskId, t));
    const byTime = subs
      .filter(s => belongsToTeacher(taskMap.get(s.taskId), user?.username) || belongsToTeacher(s, user?.username))
      .sort((a, b) => (parseWhen(b) || 0) - (parseWhen(a) || 0))
      .slice(0, 6);
    return byTime.map((s, idx) => {
      const task = taskMap.get(s.taskId);
      const title = s.taskTitle || s.taskName || task?.title || task?.name || '—';
      const when = parseWhen(s);
      const d = when ? new Date(when).toLocaleString() : '';
      return { id: idx, title, date: d };
    });
  }, [user?.username]);

  // Cursos/secciones reales del profesor (para filtros)
  const teacherCourses = useMemo(() => {
    try {
      const teacherAssignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
      const sections = [...JSON.parse(localStorage.getItem('smart-student-admin-sections') || '[]'), ...JSON.parse(localStorage.getItem('smart-student-sections') || '[]')];
      const courses = [...JSON.parse(localStorage.getItem('smart-student-admin-courses') || '[]'), ...JSON.parse(localStorage.getItem('smart-student-courses') || '[]')];
      const my = teacherAssignments.filter((ta: any) => ta.teacherId === user?.id || ta.teacherUsername === user?.username || ta.teacher === user?.username);
      const normalize = (ta: any) => {
        const sectionId = ta.sectionId || ta.section || ta.sectionUUID || ta.section_id || ta.sectionID;
        let courseId = ta.courseId || ta.course || ta.courseUUID || ta.course_id || ta.courseID;
        if (!courseId && sectionId) {
          const sec = sections.find((s: any) => s && (s.id === sectionId || s.sectionId === sectionId));
          courseId = sec?.courseId || (sec?.course && (sec.course.id || sec.courseId)) || courseId;
        }
        return { sectionId, courseId };
      };
      const getLabel = (courseId?: string, sectionId?: string) => {
        const c = courses.find((x: any) => x && (x.id === courseId));
        const s = sections.find((x: any) => x && (x.id === sectionId || x.sectionId === sectionId));
        const courseName = c?.fullName || c?.displayName || c?.longName || c?.label || c?.gradeName || c?.name || 'Curso';
        const sectionName = s?.fullName || s?.displayName || s?.longName || s?.label || s?.name || '';
        return `${courseName} ${sectionName}`.trim();
      };
      const list = my.map((ta: any) => {
        const { sectionId, courseId } = normalize(ta);
        if (!sectionId) return null;
        const id = `${courseId || 'unknown-course'}-${sectionId}`;
        const label = getLabel(courseId, sectionId);
        const level = courses.find((c: any) => c.id === courseId)?.level as Level | undefined;
        return { id, courseId: courseId || 'unknown-course', sectionId, label, level };
      }).filter(Boolean) as Array<{ id: string; courseId: string; sectionId: string; label: string; level?: Level }>;
      const seen = new Set<string>();
      return list.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
    } catch { return [] as Array<{ id: string; courseId: string; sectionId: string; label: string; level?: Level }>; }
  }, [user?.id, user?.username]);

  const availableLevels = useMemo(() => {
    const lv = new Set<Level>();
    teacherCourses.forEach(tc => { if (tc.level === 'basica' || tc.level === 'media') lv.add(tc.level); });
    return Array.from(lv);
  }, [teacherCourses]);

  const exportPDF = async () => {
    try {
      const container = document.getElementById('teacher-stats-container');
      if (!container) return;

      // Config PDF y márgenes
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentHeight = pageHeight - margin * 2;

      // Recolectar secciones en orden: header + bloques marcados con data-section
      const sections: HTMLElement[] = [];
      const header = container.querySelector('[data-section="header"]') as HTMLElement | null;
      if (header) sections.push(header);
      sections.push(...Array.from(container.querySelectorAll('[data-section]:not([data-section="header"])')) as HTMLElement[]);

      // Si no hay secciones marcadas, fallback: capturar todo como antes
      if (sections.length === 0) {
        const full = await html2canvas(container as HTMLElement, {
          scale: 3,
          backgroundColor: '#0b1220',
          useCORS: true,
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.clientWidth
        });
        const ratio = (pageWidth - margin * 2) / full.width;
        const sliceH = Math.floor(contentHeight / ratio);
        const total = Math.max(1, Math.ceil(full.height / sliceH));
        for (let p = 0; p < total; p++) {
          if (p > 0) pdf.addPage();
          const c = document.createElement('canvas');
          c.width = full.width; c.height = Math.min(sliceH, full.height - p * sliceH);
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,c.width,c.height);
            ctx.drawImage(full, 0, p * sliceH, full.width, c.height, 0, 0, c.width, c.height);
          }
          const w = full.width * ratio; const h = c.height * ratio;
              pdf.addImage(c.toDataURL('image/png'), 'PNG', (pageWidth - w)/2, margin, w, h, undefined, 'MEDIUM');
        }
        pdf.save(`estadisticas-${new Date().toISOString().slice(0,10)}.pdf`);
        return;
      }

      // Capturar cada sección de manera independiente, ajustando a múltiples páginas si es necesario
      let isFirstPage = true;
      for (const el of sections) {
        const canvas = await html2canvas(el, {
          scale: 3,
          backgroundColor: '#0b1220',
          useCORS: true,
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.clientWidth
        });
        const ratio = (pageWidth - margin * 2) / canvas.width;
        const sliceH = Math.floor(contentHeight / ratio);
        const pages = Math.max(1, Math.ceil(canvas.height / sliceH));
        for (let i = 0; i < pages; i++) {
          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;
          const c = document.createElement('canvas');
          c.width = canvas.width; c.height = Math.min(sliceH, canvas.height - i * sliceH);
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,c.width,c.height);
            ctx.drawImage(canvas, 0, i * sliceH, canvas.width, c.height, 0, 0, c.width, c.height);
          }
          const w = canvas.width * ratio; const h = c.height * ratio;
              pdf.addImage(c.toDataURL('image/png'), 'PNG', (pageWidth - w)/2, margin, w, h, undefined, 'MEDIUM');
        }
      }
      pdf.save(`estadisticas-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('[TeacherStatisticsPage] Error exportando PDF:', e);
    }
  };

  return (
    <div id="teacher-stats-container" className="space-y-6">
      {/* Header */}
  <div className="flex items-center justify-between" data-section="header">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--custom-rose-100))] text-[hsl(var(--custom-rose-800))] dark:bg-[hsl(var(--custom-rose-700))] dark:text-white">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('statisticsPageTitle', 'Estadísticas')}</h1>
            <p className="text-muted-foreground">{t('statisticsPageSub', 'Análisis y métricas de tu gestión como profesor')}</p>
          </div>
        </div>
        <Button className="home-card-button-green w-auto flex items-center gap-2" onClick={exportPDF}>
          <Download className="w-4 h-4" /> {t('download', 'Descargar')}
        </Button>
      </div>

      {/* Filtros: tarjetas cuadradas seleccionables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-section>
        {/* Notas (placeholder por paridad visual) */}
        <Card className="select-none">
          <CardContent className="p-4 flex flex-col items-start gap-1">
            <div className="text-sm text-muted-foreground">{t('grades', 'Notas')}</div>
            <div className="text-lg font-semibold">—</div>
          </CardContent>
        </Card>

        {/* Cursos del profesor */}
        <Card className="select-none">
          <CardContent className="p-4 flex flex-col items-start gap-2">
            <div className="text-sm text-muted-foreground">{t('course', 'Curso')}</div>
            <div className="w-full flex flex-wrap gap-2">
              <button
                className={`text-xs px-2 py-1 rounded border ${selectedCourse === 'all' ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                onClick={() => setSelectedCourse('all')}
              >{t('all', 'Todos')}</button>
              {teacherCourses.map(tc => (
                <button
                  key={tc.id}
                  className={`text-xs px-2 py-1 rounded border truncate max-w-[10rem] ${selectedCourse === tc.id ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                  onClick={() => setSelectedCourse(tc.id)}
                  title={tc.label}
                >{tc.label}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Niveles (renombrado) */}
        <Card className="select-none">
          <CardContent className="p-4 flex flex-col items-start gap-2">
            <div className="text-sm text-muted-foreground">{t('levels', 'Niveles')}</div>
            <div className="w-full flex flex-wrap gap-2">
              <button
                className={`text-xs px-2 py-1 rounded border ${selectedLevel === 'all' ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                onClick={() => setSelectedLevel('all')}
              >{t('all', 'Todos')}</button>
              {availableLevels.map(lv => (
                <button
                  key={lv}
                  className={`text-xs px-2 py-1 rounded border ${selectedLevel === lv ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                  onClick={() => setSelectedLevel(lv)}
                >{lv === 'basica' ? 'Básica' : 'Media'}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Periodo */}
        <Card className="select-none">
          <CardContent className="p-4 flex flex-col items-start gap-1">
            <div className="text-sm text-muted-foreground">{t('period', 'Periodo')}</div>
            <div className="text-lg font-semibold">{period === 'all' ? t('allTime', 'Todo') : period}</div>
            <div className="mt-2 grid grid-cols-4 gap-1 w-full">
              {(['7d','30d','90d','all'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs py-1 rounded border ${period === p ? 'bg-[hsl(var(--custom-rose-700))] text-white border-transparent' : 'bg-transparent text-muted-foreground border-muted'}`}
                  title={p === 'all' ? t('allTime', 'Todo') : p}
                >
                  {p === 'all' ? t('allTime', 'Todo') : p}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top KPIs (según imagen) */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-section>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('approvedStudents', 'Estudiantes aprobados')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-extrabold text-emerald-400">{stats.approvedCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('failedStudents', 'Estudiantes reprobados')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-extrabold text-blue-400">{stats.failedCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('avgAllStudents', 'Promedio de todos los estudiantes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-extrabold text-blue-300">{typeof stats.avgScore20 === 'number' ? stats.avgScore20.toFixed(1) : '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('topStudentAvg', 'Promedio de estudiante destacado')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-extrabold text-fuchsia-300">{typeof stats.topStudentAvg20 === 'number' ? stats.topStudentAvg20.toFixed(1) : '—'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-section>
        {/* Gráfico temporal de asistencia con filtros */}
        <AttendanceTrendCard
          period={period}
          teacherUsername={user?.username || ''}
          teacherCourses={teacherCourses}
        />

  <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> {t('quickInsights', 'Insights rápidos')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm list-disc pl-5 space-y-2">
              <li>{t('insightSubmissions', 'Más actividad de entregas en el periodo seleccionado')}</li>
              <li>{t('insightAttendance', 'La asistencia promedio te ayuda a detectar ausencias')}</li>
              <li>{t('insightGrades', 'Sigue el promedio para medir progreso')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-section>
        {/* Comparación de Cursos (barras) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('courseComparison', 'Comparación de Cursos')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 flex items-end gap-4 px-2">
              {(() => { const data = stats.courseAvg20 ?? []; return data; })().map((c, idx, arr) => {
                const max = Math.max(1, ...arr.map((x: any) => x.avg20));
                const h = Math.round((c.avg20 / max) * 180);
                const color = ['#60A5FA','#F9A8D4','#C4B5FD','#34D399'][idx % 4];
                return (
                  <div key={c.label} className="flex-1 flex flex-col items-center">
                    <div style={{ height: `${h}px`, backgroundColor: color }} className="w-10 rounded-t-md"></div>
                    <div className="mt-2 text-sm text-center truncate w-16" title={c.label}>{c.label}</div>
                  </div>
                );
              })}
              {(stats.courseAvg20?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">{t('noData', 'Sin datos')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notas por Fecha (línea) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('gradesOverTime', 'Notas por Fecha')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.monthlyAvg20 && stats.monthlyAvg20.length ? (
              <TrendChart
                data={stats.monthlyAvg20}
                labels={stats.monthlyLabels || []}
                color={'#60A5FA'}
                height={200}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('noData', 'Sin datos')}</p>
            )}
          </CardContent>
        </Card>
      </div>

  {/* Top Courses and Recent Activity */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-section>
        <Card>
          <CardHeader>
            <CardTitle>{t('topCourses', 'Cursos/Secciones con más entregas')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats.topCourses || []).map((c) => {
                const max = Math.max(1, ...(stats.topCourses || []).map(x => x.count));
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={c.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate max-w-[60%]" title={c.label}>{c.label}</span>
                      <span>{c.count}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded">
                      <div style={{ width: `${pct}%` }} className="h-2 bg-[hsl(var(--custom-rose-700))] dark:bg-white rounded"></div>
                    </div>
                  </div>
                );
              })}
              {(!stats.topCourses || stats.topCourses.length === 0) && (
                <p className="text-sm text-muted-foreground">{t('noData', 'Sin datos')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> {t('recentActivity', 'Actividad reciente')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentActivity.map(item => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[65%]" title={item.title}>{item.title}</span>
                  <span className="text-muted-foreground">{item.date}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
