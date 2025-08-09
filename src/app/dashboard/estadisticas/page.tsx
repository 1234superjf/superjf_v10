"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, ClipboardList, FileCheck2, Users, Activity, TrendingUp, Clock } from 'lucide-react';
import { ensureDemoTeacherData } from '@/lib/demo/teacher-stats-demo';

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
  const window = getTimeWindow(period);

  useEffect(() => {
    const onStorage = () => setRefreshTick(t => t + 1);
    window.addEventListener?.('storage', onStorage);
    return () => window.removeEventListener?.('storage', onStorage);
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
      if (window.from && t) return t >= window.from;
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
    const avgGrade = gradedSubs.length > 0
      ? (gradedSubs.reduce((acc, s) => acc + (typeof s.grade === 'number' ? s.grade : (s.score ?? 0)), 0) / gradedSubs.length)
      : undefined;

    // ASISTENCIA
    const attendance: any[] = read('smart-student-attendance');
    const teacherAtt = attendance.filter(a => a.teacherUsername === username).filter(inWindow);
    const present = teacherAtt.filter(a => a.status === 'present').length;
    const total = teacherAtt.length;

    // Tendencia por día
    const bucketSize = 1; // días
    const fromTs = window.from ?? (teacherSubs.reduce((min, s) => Math.min(min, parseWhen(s) ?? now()), now()));
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
      const val = typeof s.grade === 'number' ? s.grade : (s.score ?? 0);
      const score = val <= 1 ? val * 100 : val; // si el valor viniera 0-1
      if (score <= 40) bins.low++; else if (score <= 60) bins.mid++; else if (score <= 80) bins.high++; else bins.top++;
    });

    return {
      tasksCreated,
      evaluationTasks,
      submissions: teacherSubs.length,
      gradedSubmissions: gradedSubs.length,
      avgGrade,
      attendance: { present, total },
      trendSeries: series,
      topCourses,
      gradeBins: bins,
      _debug: refreshTick,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, period, window.from, refreshTick]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--custom-rose-100))] text-[hsl(var(--custom-rose-800))] dark:bg-[hsl(var(--custom-rose-700))] dark:text-white">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('statisticsPageTitle', 'Estadísticas')}</h1>
            <p className="text-muted-foreground">{t('statisticsPageSub', 'Análisis y métricas de tu gestión como profesor')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          {(['7d','30d','90d','all'] as Period[]).map(p => (
            <Button
              key={p}
              onClick={() => setPeriod(p)}
              variant={period === p ? 'default' : 'ghost'}
              className={period === p ? 'home-card-button-rose' : 'home-card-button-stats'}
            >
              {p === 'all' ? t('allTime', 'Todo') : p}
            </Button>
          ))}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> {t('statsTasksCreated', 'Tareas creadas')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.tasksCreated}</div>
            <p className="text-sm text-muted-foreground">{t('lastPeriod', 'en el periodo seleccionado')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" /> {t('statsSubmissions', 'Entregas de tareas')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.submissions}</div>
            <p className="text-sm text-muted-foreground">{t('gradedCountLabel', 'Calificadas')}: {stats.gradedSubmissions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" /> {t('statsAvgGrade', 'Promedio de calificación')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{typeof stats.avgGrade === 'number' ? stats.avgGrade.toFixed(1) : '—'}</div>
            <p className="text-sm text-muted-foreground">{t('onlyGraded', 'Solo sobre entregas calificadas')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" /> {t('statsAttendanceRate', 'Asistencia (%)')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attendanceRate}%</div>
            <Progress value={attendanceRate} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-1">
              {stats.attendance.present}/{stats.attendance.total} {t('attendanceMarks', 'marcajes')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* Trend and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> {t('trendSubmissions', 'Tendencia de entregas')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-28 flex items-end gap-1">
              {stats.trendSeries && stats.trendSeries.length > 0 ? (
                stats.trendSeries.map((v, i) => {
                  const max = Math.max(1, ...stats.trendSeries);
                  const h = Math.round((v / max) * 100);
                  return (
                    <div key={i} className="flex-1 min-w-[4px] bg-[hsl(var(--custom-rose-100))] dark:bg-[hsl(var(--custom-rose-700))] rounded-t">
                      <div style={{ height: `${h}%` }} className="w-full bg-[hsl(var(--custom-rose-700))] dark:bg-white rounded-t"></div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">{t('noData', 'Sin datos')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('gradesDistribution', 'Distribución de calificaciones')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { k: 'low', label: '<=40' },
              { k: 'mid', label: '41-60' },
              { k: 'high', label: '61-80' },
              { k: 'top', label: '81-100' },
            ] as const).map(b => {
              const total = stats.gradedSubmissions || 1;
              const n = (stats.gradeBins as any)?.[b.k] || 0;
              const pct = Math.round((n / total) * 100);
              return (
                <div key={b.k}>
                  <div className="flex justify-between text-sm mb-1"><span>{b.label}</span><span>{n} ({pct}%)</span></div>
                  <Progress value={pct} />
                </div>
              );
            })}
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
