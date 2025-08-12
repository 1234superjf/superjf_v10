"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

function loadJson<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } }

export default function GradesPage() {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const COLOR = 'emerald' as const;

  // Datos base
  const [grades, setGrades] = useState<TestGrade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Filtros
  const [courseId, setCourseId] = useState<string>('all');
  const [sectionId, setSectionId] = useState<string>('all');
  const [subjectId, setSubjectId] = useState<string>('all');

  // Carga inicial
  useEffect(() => {
    setGrades(loadJson<TestGrade[]>('smart-student-test-grades', []));
    setCourses(loadJson<Course[]>('smart-student-courses', []));
    setSections(loadJson<Section[]>('smart-student-sections', []));
    setSubjects(loadJson<Subject[]>('smart-student-subjects', []));

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'smart-student-test-grades' && e.newValue) {
        try { setGrades(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Opciones por rol
  const teacherAssignments = useMemo(() => loadJson<any[]>('smart-student-teacher-assignments', []), []);
  const studentAssignments = useMemo(() => loadJson<any[]>('smart-student-student-assignments', []), []);

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

  // Derivar opciones de filtros segan rol
  const courseOptions: Option[] = useMemo(() => {
    const opts = [{ value: 'all', label: translate('allCourses') || 'Todos los cursos' }];
    courses.forEach(c => { if (allowed.courses.has(c.id)) opts.push({ value: c.id, label: c.name }); });
    return opts;
  }, [courses, allowed, translate]);

  const sectionOptions: Option[] = useMemo(() => {
    const opts = [{ value: 'all', label: translate('allSections') || 'Todas las secciones' }];
    sections
      .filter(s => courseId === 'all' || s.courseId === courseId)
      .forEach(s => { if (allowed.sections.has(s.id)) opts.push({ value: s.id, label: s.name }); });
    return opts;
  }, [sections, courseId, allowed, translate]);

  const subjectOptions: Option[] = useMemo(() => {
    const opts = [{ value: 'all', label: translate('allSubjects') || 'Todas las asignaturas' }];
    if (user?.role === 'teacher') {
      // Para profesor, usar solo asignaturas asignadas
      allowed.subjects.forEach(n => opts.push({ value: String(n), label: String(n) }));
    } else {
      subjects.forEach(su => opts.push({ value: su.id || su.name, label: su.name }));
    }
    return opts;
  }, [subjects, allowed, user, translate]);

  // Aplicar filtros a las calificaciones
  const filtered = useMemo(() => {
    const list = grades.filter(g => {
      if (courseId !== 'all' && g.courseId !== courseId) return false;
      if (sectionId !== 'all' && g.sectionId !== sectionId) return false;
      if (subjectId !== 'all') {
        // Las notas de pruebas no guardan subjectId siempre; tolerar por título
        if (g.subjectId && g.subjectId !== subjectId) return false;
      }
      // Filtrar por rol: estudiantes solo ven sus notas
      if (user?.role === 'student' && g.studentId !== (user as any).id) return false;
      // Profesores: si hay restricciones de cursos/secciones
      if (user?.role === 'teacher') {
        if (g.courseId && !allowed.courses.has(g.courseId)) return false;
        if (g.sectionId && !allowed.sections.has(g.sectionId)) return false;
      }
      return true;
    });
    // Orden: más reciente primero
    return list.sort((a, b) => b.gradedAt - a.gradedAt);
  }, [grades, courseId, sectionId, subjectId, user, allowed]);

  // Estaddsticas simples
  const avg = useMemo(() => {
    if (filtered.length === 0) return null;
    const sum = filtered.reduce((acc, g) => acc + (Number.isFinite(g.score) ? g.score : 0), 0);
    return Math.round((sum / filtered.length) * 10) / 10;
  }, [filtered]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className={`${getHeaderBgClass(COLOR)} ${getHeaderBorderClass(COLOR)} mb-4`}>
        <CardHeader className="pb-2">
          <CardTitle className={`flex items-center justify-between ${getTitleTextClass(COLOR)}`}>
            <span>{translate('gradesDashboardTitle') || 'Calificaciones'}</span>
            {avg !== null && (
              <Badge className="bg-emerald-600 text-white">{(translate('average') || 'Promedio')}: {avg}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className={getBodyTextClass(COLOR)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm block mb-1">{translate('filterCourse') || 'Curso'}</label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={translate('selectCourse') || 'Selecciona curso'} />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm block mb-1">{translate('filterSection') || 'Sección'}</label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={translate('selectSection') || 'Selecciona sección'} />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm block mb-1">{translate('filterSubject') || 'Asignatura'}</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={translate('selectSubject') || 'Selecciona asignatura'} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translate('gradesListTitle') || 'Listado de calificaciones'}</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-muted-foreground text-sm">{translate('noGrades') || 'Sin calificaciones para los filtros seleccionados'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4">{translate('student') || 'Estudiante'}</th>
                    <th className="py-2 pr-4">{translate('course') || 'Curso'}</th>
                    <th className="py-2 pr-4">{translate('section') || 'Sección'}</th>
                    <th className="py-2 pr-4">{translate('subject') || 'Asignatura'}</th>
                    <th className="py-2 pr-4">{translate('testTitle') || 'Prueba'}</th>
                    <th className="py-2 pr-4">{translate('grade') || 'Nota'}</th>
                    <th className="py-2 pr-4">{translate('date') || 'Fecha'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const course = courses.find(c => c.id === g.courseId);
                    const section = sections.find(s => s.id === g.sectionId);
                    const subjectName = (() => {
                      if (!g.subjectId) return '';
                      const s1 = subjects.find(su => su.id === g.subjectId);
                      if (s1) return s1.name;
                      // fallback si subjectId es un nombre
                      return typeof g.subjectId === 'string' ? g.subjectId : '';
                    })();
                    const date = new Date(g.gradedAt);
                    const ds = `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${date.getFullYear()}`;
                    return (
                      <tr key={g.id} className="border-b">
                        <td className="py-2 pr-4">{g.studentName}</td>
                        <td className="py-2 pr-4">{course?.name || '—'}</td>
                        <td className="py-2 pr-4">{section?.name || '—'}</td>
                        <td className="py-2 pr-4">{subjectName || '—'}</td>
                        <td className="py-2 pr-4">{g.title || '—'}</td>
                        <td className="py-2 pr-4 font-semibold">{g.score}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{ds}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
