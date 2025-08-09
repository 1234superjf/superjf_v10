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

type Period = '7d' | '30d' | '90d' | 'all';

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

function useTeacherStats(username?: string, period: Period = '30d') {
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

    // TAREAS
    const tasks: any[] = read('smart-student-tasks');
    const teacherTasks = tasks.filter(t => belongsToTeacher(t, username));
    const teacherTasksInWindow = teacherTasks.filter(inWindow);
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
    }).filter(inWindow);
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
    const teacherAtt = attendance.filter(a => a.teacherUsername === username).filter(inWindow);
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
  }, [username, period, timeWindow.from, refreshTick]);

  return value;
}

export default function TeacherStatisticsPage() {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const [period, setPeriod] = useState<Period>('30d');
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

  const stats = useTeacherStats(user?.username, period);

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

  const exportPDF = async () => {
    try {
      const container = document.getElementById('teacher-stats-container');
      if (!container) return;
      // Ajustar ancho A4 a 96 DPI aprox: 794 x 1123 px, margen pequeño
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;

      // Canvas por secciones visibles para evitar sobreflows
      const sections = Array.from(container.querySelectorAll('[data-section]')) as HTMLElement[];
      if (sections.length === 0) {
        // fallback: captura total
        const canvas = await html2canvas(container as HTMLElement, { scale: 2, backgroundColor: '#0b1220' });
        const imgData = canvas.toDataURL('image/png');
        const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
        const w = canvas.width * ratio; const h = canvas.height * ratio;
        pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, margin, w, h, undefined, 'FAST');
      } else {
        for (let i = 0; i < sections.length; i++) {
          const el = sections[i];
          // Asegurar fondo consistente en modo dark
          el.style.background = el.style.background || 'transparent';
          const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0b1220' });
          const imgData = canvas.toDataURL('image/png');
          const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
          const w = canvas.width * ratio; const h = canvas.height * ratio;
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, margin, w, h, undefined, 'FAST');
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
      <div className="flex items-center justify-between">
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
        {[
          { key: 'grades', label: t('grades', 'Notas'), sub: '—' },
          { key: 'course', label: t('course', 'Curso'), sub: '—' },
          { key: 'levels', label: t('allLevels', 'Todos los niveles'), sub: '—' },
          { key: 'period', label: t('period', 'Periodo'), sub: period === 'all' ? t('allTime', 'Todo') : period },
        ].map(card => (
          <Card key={card.key} className="cursor-pointer hover:shadow-md transition select-none">
            <CardContent className="p-4 flex flex-col items-start gap-1">
              <div className="text-sm text-muted-foreground">{card.label}</div>
              <div className="text-lg font-semibold">{card.sub}</div>
              {card.key === 'period' && (
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
              )}
            </CardContent>
          </Card>
        ))}
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> {t('statsEvaluationTasks', 'Evaluaciones asignadas')}
              <Badge variant="secondary" className="ml-2">{stats.evaluationTasks}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{t('evaluationTasksHelp', 'Cuenta las tareas de tipo evaluación creadas por ti en el periodo')}</p>
            <div className="flex flex-wrap gap-2">
              <Button className="home-card-button home-card-button-stats w-auto" variant="outline">
                {t('viewTasks', 'Ver tareas')}
              </Button>
              <Button className="home-card-button home-card-button-stats w-auto" variant="outline" onClick={() => router.push('/dashboard/evaluacion')}>
                {t('goToEvaluations', 'Ir a Evaluaciones')}
              </Button>
            </div>
          </CardContent>
        </Card>

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
