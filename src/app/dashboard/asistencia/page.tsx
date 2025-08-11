"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { 
  Calendar, 
  Users, 
  Check, 
  X, 
  Clock, 
  UserCheck, 
  UserX, 
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { es as esLocale, enGB } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Tipos de datos
interface Student {
  username: string;
  displayName: string;
  activeCourses: string[];
  assignedTeachers?: Record<string, string>;
  id?: string;
}

interface AttendanceRecord {
  id: string;
  studentUsername: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  subject: string;
  course: string; // composite course-section id
  teacherUsername: string;
  notes?: string;
  timestamp: string;
}

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

// Obtener nombre de mes acorde al locale del navegador
const getMonthName = (monthIndex: number, year: number) =>
  new Date(year, monthIndex, 1).toLocaleString(undefined, { month: 'long' });

const statusColors = {
  present: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  late: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  excused: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
};

const statusIcons = {
  present: Check,
  absent: X,
  late: Clock,
  excused: UserCheck
};

// Labels traducibles para los estados (definidos dentro del componente usando translate)

// Utilidades de fechas en horario local para evitar desfases por zona horaria
const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseLocalDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// --- Calendario Admin: utilidades para detectar días no laborables ---
type VacationRange = { start?: string; end?: string };
type CalendarYearConfig = { showWeekends: boolean; summer: VacationRange; winter: VacationRange; holidays: string[] };
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inRange = (date: Date, range?: VacationRange) => {
  if (!range?.start || !range?.end) return false;
  // Comparar en horario local: construir fechas sin pasar por Date ISO string
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const aDate = parseLocalDate(range.start);
  const bDate = parseLocalDate(range.end);
  const a = aDate.getTime();
  const b = bDate.getTime();
  const [min, max] = a <= b ? [a, b] : [b, a];
  return t >= min && t <= max;
};
const loadCalendarConfig = (year: number): CalendarYearConfig => {
  const def: CalendarYearConfig = { showWeekends: true, summer: {}, winter: {}, holidays: [] };
  try {
    const raw = localStorage.getItem(`admin-calendar-${year}`);
    if (!raw) return def;
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { /* ignore */ } }
    return { ...def, ...(parsed && typeof parsed === 'object' ? parsed : {}) } as CalendarYearConfig;
  } catch { return def; }
};
const getNonWorkingReason = (dateStr: string): null | 'holiday' | 'summer' | 'winter' | 'weekend' => {
  const d = parseLocalDate(dateStr);
  const cfg = loadCalendarConfig(d.getFullYear());
  if (cfg.holidays?.includes(keyOf(d))) return 'holiday';
  if (inRange(d, cfg.summer)) return 'summer';
  if (inRange(d, cfg.winter)) return 'winter';
  const dow = d.getDay(); // 0=Dom, 6=Sab
  // Solo considerar fin de semana como no laborable si el Admin lo tiene habilitado
  if (cfg.showWeekends && (dow === 0 || dow === 6)) return 'weekend';
  return null;
};

export default function AttendancePage() {
  const { translate, language } = useLanguage();
  const { user } = useAuth();
  const dateLocale: Locale = language === 'es' ? esLocale : enGB;
  
  // Helper de traducción con fallback: si translate devuelve la clave tal cual, usamos el valor por defecto
  const t = useCallback((key: string, def?: string) => {
    const val = translate(key);
    return val === key ? (def || '') : val;
  }, [translate]);

  // Mapas de etiquetas con traducción
  const statusLabels = useMemo(() => ({
    present: t('attendance.present', t('present', 'Present')),
    absent: t('attendance.absent', t('absent', 'Absent')),
    late: t('attendance.late', t('late', 'Late')),
    excused: t('attendance.excused', t('excused', 'Excused'))
  }), [t]);
  
  // Estados principales
  const [selectedView, setSelectedView] = useState<'dashboard' | 'calendar' | 'students' | 'reports'>('dashboard');
  // selectedCourse es un ID compuesto courseId-sectionId
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateString(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Datos
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const [teacherCourseSections, setTeacherCourseSections] = useState<Array<{ id: string; courseId: string; sectionId: string; label: string }>>([]);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [nonWorkingReason, setNonWorkingReason] = useState<null | 'holiday' | 'summer' | 'winter' | 'weekend'>(null);

  // Derivados del selectedCourse
  const selectedCourseIds = useMemo(() => {
    if (!selectedCourse) return { courseId: '', sectionId: '' };
    const parts = selectedCourse.split('-');
    if (parts.length >= 10) {
      // UUIDv4 course + section (5 y 5 bloques)
      return { courseId: parts.slice(0, 5).join('-'), sectionId: parts.slice(5, 10).join('-') };
    }
    const [courseId, sectionId] = selectedCourse.split('::');
    return { courseId: courseId || '', sectionId: sectionId || '' };
  }, [selectedCourse]);

  // Cargar datos iniciales
  useEffect(() => {
    if (user && user.role === 'teacher') {
      loadTeacherData();
      loadAttendanceRecords();
    }
  }, [user]);

  const loadTeacherData = () => {
    try {
      const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
  // Datos bases
  const courses = JSON.parse(localStorage.getItem('smart-student-courses') || '[]');
  const sections = JSON.parse(localStorage.getItem('smart-student-sections') || '[]');
  // Posibles colecciones del Mod Admin (Gestión Usuarios)
  const adminCourses = JSON.parse(localStorage.getItem('smart-student-admin-courses') || '[]');
  const adminSections = JSON.parse(localStorage.getItem('smart-student-admin-sections') || '[]');
  const teacherAssignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');

      // Intentar obtener un mapa de etiquetas curso-sección si existe en el storage
      // Estructuras soportadas:
      // - Array de { courseId, sectionId, label }
      // - Objeto con clave `${courseId}-${sectionId}`: label
      let csLabelMap: Record<string, string> = {};
      try {
        const labelsRaw = localStorage.getItem('smart-student-course-section-labels')
          || localStorage.getItem('smart-student-course-sections-labels')
          || localStorage.getItem('smart-student-course-sections-map');
        if (labelsRaw) {
          const parsed = JSON.parse(labelsRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((x: any) => {
              if (x && (x.courseId || x.course) && (x.sectionId || x.section) && x.label) {
                const k = `${x.courseId || x.course}-${x.sectionId || x.section}`;
                csLabelMap[k] = x.label;
              }
            });
          } else if (parsed && typeof parsed === 'object') {
            csLabelMap = parsed;
          }
        }
      } catch {}

      const getCourseSectionLabel = (courseId: string, sectionId: string) => {
        const key = `${courseId}-${sectionId}`;
        if (csLabelMap[key]) return csLabelMap[key];
        // Buscar en colecciones base y en Admin (priorizar Admin si tiene nombres humanos)
        const courseSources = [
          ...adminCourses,
          ...courses
        ];
        const sectionSources = [
          ...adminSections,
          ...sections
        ];
        // localizar sección primero
        const s = sectionSources.find((x: any) => x && (x.id === sectionId || x.sectionId === sectionId)) || {};
        // si no viene courseId, intentar derivarlo desde la sección encontrada
        const derivedCourseId = courseId || (s && (s.courseId || (s.course && (s.course.id || s.courseId))));
        const c = courseSources.find((x: any) => x && (x.id === derivedCourseId || x.courseId === derivedCourseId)) || {};
        // Tomar nombres más expresivos posibles
        const courseName = c.fullName || c.displayName || c.longName || c.label || c.gradeName || c.name || translate('course');
        const sectionName = s.fullName || s.displayName || s.longName || s.label || s.name || '';
        // Si el assignment ya trae label explícito, usarlo
        if ((c as any).label && (s as any).label) return `${(c as any).label} ${(s as any).label}`.trim();
        return `${courseName} ${sectionName}`.trim();
      };

      // Filtrar asignaciones del profesor por id o username
      const myAssignments = teacherAssignments.filter((ta: any) =>
        ta.teacherId === user?.id ||
        ta.teacherId === user?.username ||
        ta.teacherUsername === user?.username ||
        ta.teacher === user?.username
      );

      // Normalizar posibles nombres de campos y deducir courseId desde la sección cuando falte
      const sectionSourcesAll = [...adminSections, ...sections];
      const normalizeIds = (ta: any) => {
        const sectionId = ta.sectionId || ta.section || ta.sectionUUID || ta.sectionUuid || ta.section_id || ta.sectionID;
        let courseId = ta.courseId || ta.course || ta.courseUUID || ta.courseUuid || ta.course_id || ta.courseID;
        if (!courseId && sectionId) {
          const sec = sectionSourcesAll.find((s: any) => s && (s.id === sectionId || s.sectionId === sectionId));
          courseId = sec?.courseId || (sec?.course && (sec.course.id || sec.courseId)) || courseId;
        }
        return { courseId, sectionId };
      };

      const courseSections: Array<{ id: string; courseId: string; sectionId: string; label: string }> = myAssignments
        .map((ta: any) => {
          const { courseId, sectionId } = normalizeIds(ta);
          if (!sectionId) return null;
          const safeCourseId = courseId || 'unknown-course';
          const id = `${safeCourseId}-${sectionId}`;
          return { id, courseId: safeCourseId, sectionId, label: getCourseSectionLabel(courseId, sectionId) };
        })
        .filter(Boolean) as Array<{ id: string; courseId: string; sectionId: string; label: string }>;
      // Quitar duplicados por id (tipado fuerte)
      const seen = new Set<string>();
      const unique: Array<{ id: string; courseId: string; sectionId: string; label: string }> = courseSections.filter((cs) => {
        if (seen.has(cs.id)) return false;
        seen.add(cs.id);
        return true;
      });
  // Ordenar por etiqueta para una mejor UX
  unique.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
  setTeacherCourseSections(unique);

      // Materias del profesor
      const teacher = users.find((u: any) => u.username === user?.username || u.id === user?.id);
      const subjects = teacher?.teachingSubjects || [];
      setMySubjects(subjects);

      if (unique.length > 0 && !selectedCourse) {
        setSelectedCourse(unique[0].id);
      }
      if (subjects.length > 0 && !selectedSubject) {
        setSelectedSubject(subjects[0]);
      }

      // Cargar estudiantes por sección seleccionada (si ya hay selección inicial)
      if (unique.length > 0) {
        const initial: { id: string; courseId: string; sectionId: string; label: string } = unique[0];
        loadStudentsForSection(initial.sectionId, users);
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
    }
  };

  // Cargar estudiantes de una sección específica usando smart-student-student-assignments
  const loadStudentsForSection = (sectionId: string, usersCache?: any[]) => {
    try {
      const users = usersCache || JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const studentAssignments = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
      const studentIds = studentAssignments
        .filter((sa: any) => sa.sectionId === sectionId)
        .map((sa: any) => sa.studentId || sa.studentUsername);
      const assigned = users.filter((u: any) => u.role === 'student' && (studentIds.includes(u.id) || studentIds.includes(u.username)));
      setStudents(assigned);
    } catch (e) {
      console.error('Error loading students for section:', e);
    }
  };

  const loadAttendanceRecords = () => {
    try {
      const stored = localStorage.getItem('smart-student-attendance');
      if (stored) {
        const records = JSON.parse(stored);
        // ✅ Asistencia compartida: cargar TODOS los registros (independiente del profesor)
        setAttendanceRecords(records);
      }
    } catch (error) {
      console.error('Error loading attendance records:', error);
    }
  };

  const saveAttendanceRecord = (record: AttendanceRecord) => {
    try {
      const stored = JSON.parse(localStorage.getItem('smart-student-attendance') || '[]');
      // ✅ Asistencia única por estudiante-fecha-curso (independiente de profesor/asignatura)
      const existingIndex = stored.findIndex((r: AttendanceRecord) => 
        r.studentUsername === record.studentUsername &&
        r.date === record.date &&
        r.course === record.course
      );

      if (existingIndex >= 0) {
        stored[existingIndex] = record;
      } else {
        stored.push(record);
      }

      const newValue = JSON.stringify(stored);
      const oldValue = localStorage.getItem('smart-student-attendance');
      localStorage.setItem('smart-student-attendance', newValue);
      // Notificar a otros módulos (dashboard/campana) para actualizar contadores
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'smart-student-attendance',
          oldValue,
          newValue,
          storageArea: localStorage,
        }));
      } catch {}
  try { window.dispatchEvent(new CustomEvent('updateDashboardCounts', { detail: { source: 'attendance', action: 'save' } })); } catch {}
  try { window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { source: 'attendance', action: 'save' } })); } catch {}
      loadAttendanceRecords();
    } catch (error) {
      console.error('Error saving attendance record:', error);
    }
  };

  const markAttendance = (studentUsername: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    if (nonWorkingReason) {
      return; // No permitir marcaje en días no laborables
    }
    const record: AttendanceRecord = {
      id: `${studentUsername}-${selectedDate}-${selectedSubject}-${selectedCourse}`,
      studentUsername,
      date: selectedDate,
      status,
      subject: selectedSubject,
      course: selectedCourse,
      teacherUsername: user?.username || '',
      timestamp: new Date().toISOString()
    };

    saveAttendanceRecord(record);
    
    // Actualizar estado local
    setDailyAttendance(prev => ({
      ...prev,
      [studentUsername]: status
    }));
  };

  // Limpiar marcas del día: elimina registros persistidos y refresca el calendario
  const clearMarks = useCallback(() => {
    try {
      const all: AttendanceRecord[] = JSON.parse(localStorage.getItem('smart-student-attendance') || '[]');
      // ✅ Borrar para el día y curso/ sección seleccionados, independiente de profesor/asignatura
      const filtered = all.filter((r: AttendanceRecord) => !(
        r.date === selectedDate &&
        r.course === selectedCourse
      ));

      if (filtered.length !== all.length) {
        const oldValue = localStorage.getItem('smart-student-attendance');
        const newValue = JSON.stringify(filtered);
        localStorage.setItem('smart-student-attendance', newValue);
        // Notificar a otros módulos (dashboard/campana) para actualizar contadores
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'smart-student-attendance',
            oldValue,
            newValue,
            storageArea: localStorage,
          }));
        } catch {}
  try { window.dispatchEvent(new CustomEvent('updateDashboardCounts', { detail: { source: 'attendance', action: 'clear' } })); } catch {}
  try { window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { source: 'attendance', action: 'clear' } })); } catch {}
      }

      // Reset estado local y recargar desde storage para refrescar el calendario
      setDailyAttendance({});
      loadAttendanceRecords();
    } catch (e) {
      console.error('Error clearing attendance marks:', e);
      setDailyAttendance({});
    }
  }, [user?.username, selectedDate, selectedCourse, selectedSubject]);

  const getAttendanceForDate = (date: string) => {
    // ✅ Asistencia compartida: considerar solo fecha y curso (ignorar asignatura y profesor)
    return attendanceRecords.filter(record => 
      record.date === date &&
      record.course === selectedCourse
    );
  };

  const getStudentAttendanceStats = (studentUsername: string): AttendanceStats => {
    const studentRecords = attendanceRecords.filter(record => 
      record.studentUsername === studentUsername &&
      record.course === selectedCourse
    );

    const stats = {
      present: studentRecords.filter(r => r.status === 'present').length,
      absent: studentRecords.filter(r => r.status === 'absent').length,
      late: studentRecords.filter(r => r.status === 'late').length,
      excused: studentRecords.filter(r => r.status === 'excused').length,
      total: studentRecords.length
    };

    return stats;
  };

  // Nueva: tasa de asistencia según calendario admin (solo días laborables) usando presentes vs ausentes
  const getWorkingAttendanceRate = (studentUsername: string): number => {
    const studentRecords = attendanceRecords.filter(record => 
      record.studentUsername === studentUsername &&
      record.course === selectedCourse
    );
    let present = 0;
    let absent = 0;
    studentRecords.forEach((r) => {
      const reason = getNonWorkingReason(r.date);
      // Contar solo días laborables según el Calendario Admin.
      // Si showWeekends=false, los fines de semana se consideran laborables.
      if (!reason) {
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
      }
    });
    const total = present + absent;
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  const generateCalendarDays = () => {
  const firstDay = new Date(selectedYear, selectedMonth, 1);
  // Ajuste lunes-domingo: offset calculado con Monday=0
  const mondayOffset = (firstDay.getDay() + 6) % 7; // 0..6
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - mondayOffset);

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getDateAttendanceStats = (date: Date): AttendanceStats => {
  const dateStr = toLocalDateString(date);
    const dayRecords = getAttendanceForDate(dateStr);

    return {
      present: dayRecords.filter(r => r.status === 'present').length,
      absent: dayRecords.filter(r => r.status === 'absent').length,
      late: dayRecords.filter(r => r.status === 'late').length,
      excused: dayRecords.filter(r => r.status === 'excused').length,
      total: dayRecords.length
    };
  };

  const filteredStudents = students.filter(student => {
  if (!selectedCourse) return true;
  // Si hay asignaciones formales, students ya viene filtrado por sección
    if (searchTerm) {
      return student.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  // Cargar asistencia del día seleccionado
  useEffect(() => {
    const dayRecords = getAttendanceForDate(selectedDate);
    const dayAttendance: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
    
    dayRecords.forEach(record => {
      dayAttendance[record.studentUsername] = record.status;
    });
    
    setDailyAttendance(dayAttendance);
  }, [selectedDate, selectedCourse, selectedSubject, attendanceRecords]);

  // Detectar día no laborable según Calendario Admin
  useEffect(() => {
    setNonWorkingReason(getNonWorkingReason(selectedDate));
  }, [selectedDate]);

  // Escuchar cambios del calendario admin en otras pestañas/ventanas
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('admin-calendar-')) {
        setNonWorkingReason(getNonWorkingReason(selectedDate));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [selectedDate]);

  // Sincronizar mes/año del calendario con la fecha seleccionada del encabezado/input
  useEffect(() => {
  // Usar parseo local para evitar desfases por zona horaria
  const d = parseLocalDate(selectedDate);
    const m = d.getMonth();
    const y = d.getFullYear();
    if (m !== selectedMonth) setSelectedMonth(m);
    if (y !== selectedYear) setSelectedYear(y);
  }, [selectedDate]);

  // Cuando cambia el curso-sección seleccionado, recargar estudiantes de esa sección
  useEffect(() => {
    if (!selectedCourse) return;
    const { sectionId } = selectedCourseIds;
    if (sectionId) loadStudentsForSection(sectionId);
  }, [selectedCourse]);

  // Escuchar cambios en asignaciones del Admin en tiempo real para refrescar selector
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'smart-student-teacher-assignments' || e.key === 'smart-student-admin-sections' || e.key === 'smart-student-admin-courses') {
        loadTeacherData();
      }
    };
    const handleCustom = () => loadTeacherData();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('teacherAssignmentsChanged', handleCustom as any);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('teacherAssignmentsChanged', handleCustom as any);
    };
  }, []);

  if (user?.role !== 'teacher') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <UserX className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">{translate('accessRestricted')}</h2>
              <p className="text-gray-500">{translate('teachersOnly')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-indigo-100 to-blue-50 dark:from-indigo-900/20 dark:via-indigo-800/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 w-full">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <UserCheck className="inline h-7 w-7 md:h-8 md:w-8 mr-2 text-indigo-600" />
            {translate('attendanceManagement') || 'Gestión de Asistencia'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {translate('attendanceControl') || 'Registra y visualiza la asistencia de tus estudiantes.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="bg-indigo-600 text-white">{format(parseLocalDate(selectedDate), 'dd/MM/yyyy', { locale: dateLocale })}</Badge>
            {selectedCourse && (
              <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:text-indigo-300">
                {teacherCourseSections.find(cs => cs.id === selectedCourse)?.label || translate('course')}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Filtros principales */}
        <div className="flex flex-wrap gap-2">
          <Select value={selectedCourse} onValueChange={(v) => setSelectedCourse(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={translate('attendanceSelectCourse') || 'Curso + Sección'} />
            </SelectTrigger>
            <SelectContent>
              {teacherCourseSections.map(cs => (
                <SelectItem
                  key={cs.id}
                  value={cs.id}
                  className="hover:!bg-transparent focus:!bg-transparent data-[highlighted]:!bg-transparent data-[state=checked]:!bg-transparent data-[highlighted]:!text-current data-[state=checked]:!text-current focus-visible:!ring-0 outline-none"
                >
                  {cs.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b">
        {[
          { id: 'dashboard', label: translate('dashboardTab'), icon: BarChart3 },
          { id: 'calendar', label: translate('calendarTab'), icon: Calendar },
          { id: 'students', label: translate('studentsTab'), icon: Users }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={selectedView === tab.id ? 'default' : 'ghost'}
            className={cn(
              "flex items-center gap-2 hover:bg-indigo-600 hover:text-white",
              selectedView === tab.id && "bg-indigo-600 text-white hover:bg-indigo-600"
            )}
            onClick={() => setSelectedView(tab.id as any)}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Dashboard View */}
      {selectedView === 'dashboard' && (
        <div className="space-y-6">
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { 
                title: translate('attendanceTotalStudents'), 
                value: filteredStudents.length, 
                icon: Users, 
                color: 'blue' 
              },
              { 
                title: translate('presentToday'), 
                value: Object.values(dailyAttendance).filter(status => status === 'present').length, 
                icon: UserCheck, 
                color: 'green' 
              },
              { 
                title: translate('absentToday'), 
                value: Object.values(dailyAttendance).filter(status => status === 'absent').length, 
                icon: UserX, 
                color: 'red' 
              },
              { 
                title: translate('lateToday'), 
                value: Object.values(dailyAttendance).filter(status => status === 'late').length, 
                icon: Clock, 
                color: 'yellow' 
              }
            ].map((stat, index) => (
              <Card key={index} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                    </div>
                    <div className={cn(
                      "p-3 rounded-full",
                      stat.color === 'blue' && "bg-blue-100 dark:bg-blue-900/30",
                      stat.color === 'green' && "bg-green-100 dark:bg-green-900/30",
                      stat.color === 'red' && "bg-red-100 dark:bg-red-900/30",
                      stat.color === 'yellow' && "bg-yellow-100 dark:bg-yellow-900/30"
                    )}>
                      <stat.icon className={cn(
                        "h-6 w-6",
                        stat.color === 'blue' && "text-blue-600 dark:text-blue-300",
                        stat.color === 'green' && "text-green-600 dark:text-green-300",
                        stat.color === 'red' && "text-red-600 dark:text-red-300",
                        stat.color === 'yellow' && "text-yellow-600 dark:text-yellow-300"
                      )} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Asistencia del día */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {translate('attendanceDate') || 'Asistencia del día'} - {format(parseLocalDate(selectedDate), 'dd/MM/yyyy', { locale: dateLocale })}
                </CardTitle>
                <DateInput value={selectedDate} onChange={(v) => setSelectedDate(v)} locale={dateLocale} />
              </div>
            </CardHeader>
            <CardContent>
              {nonWorkingReason && (
                <div className="mb-4 p-3 rounded-md border text-sm bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 text-amber-800 dark:text-amber-200">
                  {nonWorkingReason === 'holiday' && (translate('noAttendanceHoliday') || 'No se requiere asistencia: feriado')}
                  {nonWorkingReason === 'summer' && (translate('noAttendanceSummer') || 'No se requiere asistencia: vacaciones de verano')}
                  {nonWorkingReason === 'winter' && (translate('noAttendanceWinter') || 'No se requiere asistencia: vacaciones de invierno')}
                  {nonWorkingReason === 'weekend' && (translate('noAttendanceWeekend') || 'No se requiere asistencia: fin de semana')}
                </div>
              )}
              {/* Acciones rápidas */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button size="sm" variant="secondary" disabled={!!nonWorkingReason} className="hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50" onClick={() => {
                  const next: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
                  filteredStudents.forEach(s => { next[s.username] = 'present'; });
                  setDailyAttendance(next);
                  filteredStudents.forEach(s => markAttendance(s.username, 'present'));
                }}>{translate('markAllPresent') || 'Marcar todos presente'}</Button>
                <Button size="sm" variant="outline" className="hover:bg-indigo-600 hover:text-white transition-colors" onClick={clearMarks}>{translate('clearMarks') || 'Limpiar marcas'}</Button>
              </div>
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">{translate('noStudentsSelected') || 'No hay estudiantes para la sección seleccionada.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map(student => {
                    const currentStatus = dailyAttendance[student.username];
                    
                    return (
                      <div key={student.username} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="font-semibold text-gray-700">
                              {student.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{student.displayName}</p>
                            <p className="text-sm text-gray-500">{student.username}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {currentStatus && (
                            <Badge className={statusColors[currentStatus]}>
                              {statusLabels[currentStatus]}
                            </Badge>
                          )}
                          
                          <div className="flex gap-1">
            {Object.entries(statusLabels).map(([status, label]) => {
                              const Icon = statusIcons[status as keyof typeof statusIcons];
                              return (
                <Button
                                  key={status}
              disabled={!!nonWorkingReason}
                                  size="sm"
                                  variant={currentStatus === status ? "default" : "outline"}
                                  className={cn(
                  "p-2 transition-colors",
                  // Mantener el mismo color al hacer hover (incoloro)
                  currentStatus === status && status === 'present' && "bg-green-600 hover:bg-green-600",
                  currentStatus === status && status === 'absent' && "bg-red-600 hover:bg-red-600",
                  currentStatus === status && status === 'late' && "bg-yellow-600 hover:bg-yellow-600",
                  currentStatus === status && status === 'excused' && "bg-blue-600 hover:bg-blue-600",
                  // Para estados no seleccionados: hover con color indigo característico
      currentStatus !== status && "hover:bg-indigo-600 hover:text-white",
      nonWorkingReason && "opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => markAttendance(student.username, status as any)}
                                  title={label}
                                >
                                  <Icon className="h-4 w-4" />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar View */}
      {selectedView === 'calendar' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {translate('attendanceCalendarTitle') || 'Calendario de Asistencia'} - {getMonthName(selectedMonth, selectedYear)} {selectedYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-transparent"
                    onClick={() => {
                      // Ir al mes anterior manteniendo el día en rango
                      // Evitar desfases: parsear YYYY-MM-DD en local time
                      const current = parseLocalDate(selectedDate);
                      let newMonth = selectedMonth - 1;
                      let newYear = selectedYear;
                      if (newMonth < 0) { newMonth = 11; newYear = selectedYear - 1; }
                      const day = current.getDate();
                      const maxDay = new Date(newYear, newMonth + 1, 0).getDate();
                      const newDate = new Date(newYear, newMonth, Math.min(day, maxDay));
                      setSelectedMonth(newMonth);
                      setSelectedYear(newYear);
                      setSelectedDate(toLocalDateString(newDate));
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-transparent"
                    onClick={() => {
                      // Ir al mes siguiente manteniendo el día en rango
                      // Evitar desfases: parsear YYYY-MM-DD en local time
                      const current = parseLocalDate(selectedDate);
                      let newMonth = selectedMonth + 1;
                      let newYear = selectedYear;
                      if (newMonth > 11) { newMonth = 0; newYear = selectedYear + 1; }
                      const day = current.getDate();
                      const maxDay = new Date(newYear, newMonth + 1, 0).getDate();
                      const newDate = new Date(newYear, newMonth, Math.min(day, maxDay));
                      setSelectedMonth(newMonth);
                      setSelectedYear(newYear);
                      setSelectedDate(toLocalDateString(newDate));
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {[translate('monShort')||'Lun', translate('tueShort')||'Mar', translate('wedShort')||'Mié', translate('thuShort')||'Jue', translate('friShort')||'Vie', translate('satShort')||'Sáb', translate('sunShort')||'Dom'].map(day => (
                  <div key={day} className="p-2 text-center font-semibold text-gray-600">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((date, index) => {
                  const isCurrentMonth = date.getMonth() === selectedMonth;
                  const isToday = date.toDateString() === new Date().toDateString();
                  const stats = getDateAttendanceStats(date);
                  const hasData = stats.total > 0;
                  const reason = getNonWorkingReason(toLocalDateString(date));
                  const isBlocked = !!reason;
                  const hiddenComment = reason === 'holiday'
                    ? (translate('noAttendanceHoliday') || 'No se requiere asistencia: feriado')
                    : reason === 'summer'
                      ? (translate('noAttendanceSummer') || 'No se requiere asistencia: vacaciones de verano')
                      : reason === 'winter'
                        ? (translate('noAttendanceWinter') || 'No se requiere asistencia: vacaciones de invierno')
                        : reason === 'weekend'
                          ? (translate('noAttendanceWeekend') || 'No se requiere asistencia: fin de semana')
                          : '';
                  
                  return (
                    <div
                      key={index}
                      className={cn(
                        "p-2 min-h-16 border rounded transition-colors",
                        isBlocked ? "bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed" : "cursor-pointer",
                        isCurrentMonth ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/60",
                        isToday && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700",
                        hasData && "border-indigo-200 dark:border-indigo-700"
                      )}
                      onClick={() => { if (!isBlocked) setSelectedDate(toLocalDateString(date)); }}
                      title={hiddenComment}
                    >
                      <div className={cn(
                        "text-sm font-medium",
                        isCurrentMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500",
                        isToday && "text-blue-600 dark:text-blue-300"
                      )}>
                        {date.getDate()}
                      </div>
                      {hasData && (
                        <div className="mt-1 space-y-1">
                          <div className="flex gap-1">
                            {stats.present > 0 && (
                              <div className="w-2 h-2 bg-green-500 rounded-full" title={`${stats.present} presente(s)`} />
                            )}
                            {stats.absent > 0 && (
                              <div className="w-2 h-2 bg-red-500 rounded-full" title={`${stats.absent} ausente(s)`} />
                            )}
                            {stats.late > 0 && (
                              <div className="w-2 h-2 bg-yellow-500 rounded-full" title={`${stats.late} tarde(s)`} />
                            )}
                            {stats.excused > 0 && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" title={`${stats.excused} justificado(s)`} />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stats.total} {translate('records') || 'registros'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Students View */}
      {selectedView === 'students' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {translate('studentTracking') || 'Seguimiento por estudiante'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={translate('searchStudent') || 'Buscar estudiante'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredStudents.map(student => {
                  const stats = getStudentAttendanceStats(student.username);
                  const attendanceRate = getWorkingAttendanceRate(student.username);
                  
                  return (
                    <div key={student.username} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="font-semibold text-gray-700">
                              {student.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold">{student.displayName}</h3>
                            <p className="text-sm text-gray-500">{student.username}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-indigo-600">{attendanceRate}%</div>
                          <div className="text-sm text-gray-500">{translate('attendanceRate') || 'Tasa de asistencia'}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(statusLabels).map(([status, label]) => {
                          const count = stats[status as keyof AttendanceStats] as number;
                          const Icon = statusIcons[status as keyof typeof statusIcons];
                          
                          return (
                            <div key={status} className="text-center">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1",
                                status === 'present' && "bg-green-100",
                                status === 'absent' && "bg-red-100",
                                status === 'late' && "bg-yellow-100",
                                status === 'excused' && "bg-blue-100"
                              )}>
                                <Icon className={cn(
                                  "h-5 w-5",
                                  status === 'present' && "text-green-600",
                                  status === 'absent' && "text-red-600",
                                  status === 'late' && "text-yellow-600",
                                  status === 'excused' && "text-blue-600"
                                )} />
                              </div>
                              <div className="font-semibold">{count}</div>
                              <div className="text-xs text-gray-500">{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      
    </div>
  );
}

// Selector de fecha con popover y calendario (localizado) que emite YYYY-MM-DD y muestra dd/MM/yyyy
function DateInput({ value, onChange, locale }: { value: string; onChange: (v: string) => void; locale: Locale }) {
  // Parseo local seguro: evita que YYYY-MM-DD se interprete como UTC y reste un día en algunas zonas horarias
  const parsed = value ? parseLocalDate(value) : undefined;
  const selected = parsed && !isNaN(parsed.getTime()) ? parsed : undefined;
  const label = selected ? format(selected, 'dd/MM/yyyy', { locale }) : 'dd/mm/yyyy';
  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
          <CalendarDays className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <UICalendar
          mode="single"
          selected={selected}
          locale={locale}
          onSelect={(d) => d && onChange(toIso(d))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
