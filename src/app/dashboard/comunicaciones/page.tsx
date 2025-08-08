"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Send, Trash2, Edit, Megaphone, Users, UserCheck, Calendar, Search, Eye, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { LocalStorageManager } from '@/lib/education-utils';

// Tipos de datos
interface Communication {
  id: string;
  title: string;
  content: string;
  type: 'course' | 'student';
  targetCourse?: string;
  targetSection?: string;
  // Fallbacks amigables para mostrar en historial si faltan datos en memoria
  targetCourseName?: string;
  targetSectionName?: string;
  targetStudent?: string;
  createdBy: string;
  senderId: string;
  createdAt: string;
  readBy: string[];
  // Marca de lectura por usuario (userId -> ISO timestamp)
  readAt?: Record<string, string>;
}

interface Course {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  courseId: string;
}

// Nueva interfaz para cursos-sección combinados
interface CourseSection {
  id: string;
  name: string; // "5to Básico A"
  courseId: string;
  sectionId: string;
  courseName: string;
  sectionName: string;
}

interface Student {
  id: string;
  username: string;
  displayName: string;
  email: string;
  assignedCourses: string[];
}

export default function ComunicacionesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { translate, language } = useLanguage();

  // Formateador consistente de fecha y hora en una sola línea, según idioma actual
  const formatDateTimeOneLine = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const locale = language === 'en' ? 'en-US' : 'es-CL';
      return date.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };
  
  // Función helper para generar claves únicas más robustas
  const generateUniqueKey = (prefix: string, id: string, index?: number, suffix?: string) => {
    const timestamp = Date.now().toString(36); // Base36 para ser más compacto
    const random = Math.random().toString(36).substr(2, 5); // 5 caracteres aleatorios
    let baseKey = `${prefix}-${id}`;
    
    if (index !== undefined) {
      baseKey += `-${index}`;
    }
    
    if (suffix) {
      baseKey += `-${suffix}`;
    }
    
    // Agregar timestamp y random para garantizar unicidad absoluta
    const finalKey = `${baseKey}-${timestamp}-${random}`;
    
    // Log para debugging (remover en producción)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔑 Generated key: ${finalKey}`);
    }
    
    return finalKey;
  };
  
  // Estados para el formulario (solo para profesores)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'course' as 'course' | 'student',
    targetCourse: '',
    targetSection: '',
    targetStudent: '',
  selectedCourseForStudent: '', // Nuevo campo para curso cuando se selecciona estudiante específico
  selectedStudents: [] as string[] // múltiples destinatarios (ids)
  });
  
  // Estados para datos
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [courseSections, setCourseSections] = useState<CourseSection[]>([]); // Nuevo estado para cursos-sección
  const [students, setStudents] = useState<Student[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [teacherCourses, setTeacherCourses] = useState<Course[]>([]); // Nuevo estado para cursos del profesor
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCommunication, setEditingCommunication] = useState<Communication | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Estados específicos para estudiantes
  const [receivedCommunications, setReceivedCommunications] = useState<Communication[]>([]);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  
  // Estados de validación
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Estado adicional para forzar re-render completo cuando sea necesario
  const [forceRenderKey, setForceRenderKey] = useState(0);

  // Memoizar listas para evitar re-renders innecesarios
  const memoizedCourseSections = useMemo(() => courseSections, [courseSections]);
  const memoizedAvailableStudents = useMemo(() => availableStudents, [availableStudents]);
  const memoizedCommunications = useMemo(() => communications, [communications]);
  const memoizedReceivedCommunications = useMemo(() => receivedCommunications, [receivedCommunications]);

  // Deep-link: abrir automáticamente una comunicación cuando viene ?commId= en la URL
  useEffect(() => {
    try {
      const commId = searchParams?.get('commId');
      if (!commId) return;

      // Buscar primero en las recibidas (estudiante), luego en todas
      const pool = user?.role === 'student' && receivedCommunications.length > 0
        ? receivedCommunications
        : communications;
      const target = pool.find(c => c.id === commId);
      if (target) {
        handleViewCommunication(target);
        // Limpiar el query param para evitar reabrir
        try { router.replace('/dashboard/comunicaciones'); } catch {}
      }
    } catch (e) {
      console.warn('[Comunicaciones] Error handling commId query param:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, receivedCommunications, communications, user]);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  // Forzar re-render cuando cambien los datos críticos
  useEffect(() => {
    setForceRenderKey(prev => prev + 1);
  }, [courseSections, availableStudents]);

  // Si es estudiante, recalcular sus comunicaciones cuando ya tengamos catálogos
  useEffect(() => {
    if (user?.role === 'student' && communications.length > 0) {
      loadStudentCommunications(communications);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, sections, communications]);

  // Enriquecer comunicaciones con nombres de curso/sección cuando carguen catálogos
  useEffect(() => {
    if (communications.length === 0 || (courses.length === 0 && sections.length === 0)) return;
    let changed = false;
    const enriched = communications.map((comm) => {
      if (comm.type === 'course') {
        const courseName = comm.targetCourseName || courses.find(c => c.id === comm.targetCourse)?.name;
        const sectionName = comm.targetSectionName || sections.find(s => s.id === comm.targetSection)?.name;
        if (courseName !== comm.targetCourseName || sectionName !== comm.targetSectionName) {
          changed = true;
          return { ...comm, targetCourseName: courseName, targetSectionName: sectionName };
        }
      }
      return comm;
    });
    if (changed) {
      setCommunications(enriched);
      try { localStorage.setItem('smart-student-communications', JSON.stringify(enriched)); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, sections]);

  // Filtrar estudiantes cuando cambia el tipo o curso/sección
  useEffect(() => {
    if (formData.type === 'student') {
      let filteredStudents = [...students];

      // Filtrar por curso-sección seleccionado
      if (formData.selectedCourseForStudent) {
        const selectedCourseSection = courseSections.find(cs => cs.id === formData.selectedCourseForStudent);
        const courseName = selectedCourseSection?.courseName;
        const sectionId = selectedCourseSection?.sectionId;

        try {
          const stored = localStorage.getItem('smart-student-student-assignments');
          if (stored && sectionId) {
            const assignments = JSON.parse(stored);
            const allowedIds = new Set(
              assignments
                .filter((a: any) => a.sectionId === sectionId)
                .map((a: any) => a.studentId)
            );
            filteredStudents = filteredStudents.filter(s => allowedIds.has(s.id));
          } else if (courseName) {
            // Fallback por curso cuando no hay asignaciones por sección
            filteredStudents = filteredStudents.filter(student => 
              student.assignedCourses.includes(courseName)
            );
          }
        } catch (e) {
          // Si algo falla, usar filtro por curso como respaldo
          if (courseName) {
            filteredStudents = filteredStudents.filter(student => 
              student.assignedCourses.includes(courseName)
            );
          }
        }
      }

      setAvailableStudents(filteredStudents);
    } else {
      setAvailableStudents([]);
      setFormData(prev => ({ 
        ...prev, 
        targetStudent: '',
  selectedCourseForStudent: '',
  selectedStudents: []
      }));
    }
  }, [formData.type, formData.selectedCourseForStudent, students, courseSections]);

  const loadData = () => {
    try {
      // Cargar comunicaciones
      const storedCommunications = localStorage.getItem('smart-student-communications');
      if (storedCommunications) {
        const allCommunications = JSON.parse(storedCommunications);

        // Migración/normalización: separar courseId y sectionId si vienen combinados
        let changed = false; // Variable para rastrear cambios
        const normalized: Communication[] = allCommunications.map((comm: any) => {
          if (comm?.type === 'course') {
            let courseId = comm.targetCourse || '';
            let sectionId = comm.targetSection || '';

            // Si alguno viene combinado, separarlo (soporta "courseId::sectionId" y 5+5 con guiones)
            const trySplit = (val: string) => {
              if (typeof val !== 'string') return null;
              if (val.includes('::')) {
                const [c, s] = val.split('::');
                if (c && s) return { c, s };
              }
              const parts = val.split('-');
              if (parts.length >= 10) {
                const c = parts.slice(0, 5).join('-');
                const s = parts.slice(5, 10).join('-');
                if (c && s) return { c, s };
              }
              return null;
            };

            const fromCourse = trySplit(courseId);
            const fromSection = trySplit(sectionId);

            if (fromCourse && (!sectionId || sectionId === courseId || fromSection)) { 
              courseId = fromCourse.c;
              sectionId = fromCourse.s;
              changed = true;
            } else if (fromSection) {
              courseId = fromSection.c;
              sectionId = fromSection.s;
              changed = true;
            }

            if (changed) { 
              return { ...comm, targetCourse: courseId, targetSection: sectionId } as Communication;
            }
          }
          return comm as Communication;
        });

        if (changed) {
          localStorage.setItem('smart-student-communications', JSON.stringify(normalized));
        }

        const finalCommunications: Communication[] = changed ? normalized : allCommunications;
        setCommunications(finalCommunications);
        
        // Si es estudiante, filtrar comunicaciones dirigidas a él usando la lista final
        if (user?.role === 'student') {
          loadStudentCommunications(finalCommunications);
        }
      }

      // Cargar cursos y secciones reales del sistema usando LocalStorageManager
      const coursesData = LocalStorageManager.getCourses();
      const sectionsData = LocalStorageManager.getSections();
      
      console.log('🔍 DEBUG - Cursos cargados:', coursesData);
      console.log('🔍 DEBUG - Secciones cargadas:', sectionsData);
      
      setCourses(coursesData);
      setSections(sectionsData);

      // Si es profesor, crear cursos-sección basados en asignaciones reales del módulo admin
      if (user?.role === 'teacher') {
        console.log('🔍 DEBUG - Usuario es profesor:', user.id, user.username);
        
        // Obtener asignaciones de profesores desde el módulo de gestión de usuarios
        const teacherAssignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
        console.log('🔍 DEBUG - Asignaciones encontradas:', teacherAssignments);
        
        // Buscar asignaciones del profesor actual
        const currentTeacherAssignments = teacherAssignments.filter((assignment: any) => 
          assignment.teacherId === user.id || assignment.teacherId === user.username
        );
        console.log('🔍 DEBUG - Asignaciones del profesor actual:', currentTeacherAssignments);
        
        // Obtener sectionIds únicos asignados al profesor
        const assignedSectionIds = [...new Set(currentTeacherAssignments.map((assignment: any) => assignment.sectionId))];
        console.log('🔍 DEBUG - IDs de secciones asignadas:', assignedSectionIds);
        
        // Crear cursos-sección solo para las secciones asignadas
        const assignedCourseSections = sectionsData
          .filter((section: any) => assignedSectionIds.includes(section.id))
          .map((section: any) => {
            const course = coursesData.find((course: any) => course.id === section.courseId);
            console.log(`🔍 DEBUG - Mapeando sección ${section.id} (${section.name}) con curso:`, course);
            return {
              id: `${section.courseId}-${section.id}`,
              name: `${course?.name || 'Curso'} ${section.name}`, // "5to Básico A"
              courseId: section.courseId,
              sectionId: section.id,
              courseName: course?.name || 'Curso',
              sectionName: section.name
            };
          });
        
        console.log('🔍 DEBUG - Cursos-sección creados:', assignedCourseSections);
        setCourseSections(assignedCourseSections);
        
        // Debug: Verificar IDs únicos
        const sectionIds = assignedCourseSections.map((cs: CourseSection) => cs.id);
        const uniqueIds = [...new Set(sectionIds)];
        if (sectionIds.length !== uniqueIds.length) {
          console.warn('⚠️ ADVERTENCIA: Se detectaron IDs de curso-sección duplicados');
          console.log('IDs originales:', sectionIds);
          console.log('IDs únicos:', uniqueIds);
        } else {
          console.log('✅ Todos los IDs de curso-sección son únicos');
        }
        
        // Crear lista de cursos únicos asignados al profesor para selector de estudiantes específicos
        const uniqueCourseIds = [...new Set(assignedCourseSections.map((cs: CourseSection) => cs.courseId))];
        const assignedCourses = coursesData.filter((course: any) => uniqueCourseIds.includes(course.id));
        console.log('🔍 DEBUG - Cursos únicos del profesor:', assignedCourses);
        setTeacherCourses(assignedCourses);
        
        // Si no hay asignaciones, mostrar mensaje en consola
        if (assignedCourseSections.length === 0) {
          console.log('❌ PROBLEMA: No se encontraron cursos-sección para el profesor');
          console.log('💡 SOLUCIÓN: Ve al módulo Admin > Gestión de Usuarios > Asignaciones');
          console.log('💡 O ejecuta el script DIAGNOSTICO-COMUNICACIONES.js');
        }
        
        // Cargar estudiantes
        const storedUsers = localStorage.getItem('smart-student-users');
        if (storedUsers) {
          const users = JSON.parse(storedUsers);
          const studentUsers = users.filter((u: any) => u.role === 'student').map((u: any) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            email: u.email || '',
            assignedCourses: u.activeCourses || []
          }));
          setStudents(studentUsers);
        }
      } else {
        // Para estudiantes o admin, mostrar todos los cursos-sección
        const allCourseSections = sectionsData.map((section: any) => {
          const course = coursesData.find((course: any) => course.id === section.courseId);
          return {
            id: `${section.courseId}-${section.id}`,
            name: `${course?.name || 'Curso'} ${section.name}`,
            courseId: section.courseId,
            sectionId: section.id,
            courseName: course?.name || 'Curso',
            sectionName: section.name
          };
        });
        setCourseSections(allCourseSections);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: translate('error') || 'Error',
        description: translate('errorLoadingData') || 'Error al cargar los datos',
        variant: 'destructive'
      });
    }
  };

  // Función para cargar comunicaciones específicas para estudiantes
  const loadStudentCommunications = (allCommunications: Communication[]) => {
    if (!user || user.role !== 'student') return;

    try {
  const studentCommunications = allCommunications.filter(comm => {
        // Comunicaciones dirigidas específicamente a este estudiante
        if (comm.type === 'student' && comm.targetStudent === user.id) {
          return true;
        }

        // Comunicaciones dirigidas al curso y sección del estudiante
        if (comm.type === 'course' && comm.targetCourse && comm.targetSection) {
          // 1) Fuente primaria: asignaciones estudiante-sección
          try {
            const studentAssignmentsRaw = localStorage.getItem('smart-student-student-assignments');
            if (studentAssignmentsRaw) {
              const assignments: any[] = JSON.parse(studentAssignmentsRaw);
              const myAssignments = assignments.filter(a => a && a.studentId === user.id);
              if (myAssignments.length > 0) {
                // Coincidencia estricta por courseId + sectionId
                const matchCourseAndSection = myAssignments.some(a => a.courseId === comm.targetCourse && a.sectionId === comm.targetSection);
                if (matchCourseAndSection) return true;

                // Coincidencia relajada por sectionId (por si el courseId falta en la comunicación o en la asignación)
                const matchSectionOnly = myAssignments.some(a => a.sectionId === comm.targetSection);
                if (matchSectionOnly) return true;

                // Fallback por nombre de sección cuando el perfil tiene solo nombre
                const studentSectionName = (user as any).sectionName;
                if (studentSectionName && comm.targetSectionName && studentSectionName === comm.targetSectionName) {
                  return true;
                }

                // Tiene asignaciones pero ninguna coincide
                return false;
              }
            }
          } catch (e) {
            console.warn('[Comunicaciones] No se pudo leer student-assignments para filtrar:', e);
          }

          // 2) Fuente secundaria: activeCourses (por id o por nombre legible, tolerando formato "Curso - Sección X")
          const active = (user as any).activeCourses as string[] | undefined;
          if (active && active.length > 0) {
            const course = courses.find(c => c.id === comm.targetCourse);
            const courseName = course?.name || comm.targetCourseName || '';
            const normalizedActive = active.map(v => String(v));
            const hasCourse = normalizedActive.some(str => {
              if (!str) return false;
              if (str === comm.targetCourse) return true; // id exacto
              if (courseName && (str === courseName || str.includes(courseName))) return true; // nombre exacto o incluido en "Curso - Sección"
              return false;
            });
            if (!hasCourse) return false; // No pertenece a este curso

            // Si coincide el curso por nombre/id, aceptamos sin bloquear por sección (algunos perfiles no incluyen sección en activeCourses)
            // Si el perfil tiene sectionName y la comunicación trae targetSectionName, opcionalmente podemos reforzar
            const studentSectionName = (user as any).sectionName;
            if (studentSectionName && comm.targetSectionName) {
              return studentSectionName === comm.targetSectionName;
            }
            return true;
          }

          // 3) Sin datos de asignaciones ni activeCourses: incluir como fallback para no perder comunicaciones
          return true;
        }

        return false;
      });

      // Ordenar por fecha (más recientes primero)
      studentCommunications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setReceivedCommunications(studentCommunications);
      
      console.log(`📧 [Student] ${user.username} loaded ${studentCommunications.length} communications`);
    } catch (error) {
      console.error('Error loading student communications:', error);
    }
  };

  // Función para manejar la visualización de comunicaciones por estudiantes
  const handleViewCommunication = (communication: Communication) => {
    setSelectedCommunication(communication);
    setShowCommunicationDialog(true);
    
    // Marcar como leída si no lo está
    if (!communication.readBy?.includes(user?.id || '')) {
      markCommunicationAsRead(communication.id);
    }
  };

  // Función para marcar comunicación como leída
  const markCommunicationAsRead = (communicationId: string) => {
    if (!user) return;

    try {
      const updatedCommunications = communications.map(comm => {
        if (comm.id === communicationId) {
          const readBy = comm.readBy || [];
          if (!readBy.includes(user.id)) {
            return {
              ...comm,
              readBy: [...readBy, user.id],
              readAt: { ...(comm.readAt || {}), [user.id]: new Date().toISOString() }
            };
          } else if (!comm.readAt || !comm.readAt[user.id]) {
            // Ya estaba marcado anteriormente; aseguremos timestamp
            return {
              ...comm,
              readAt: { ...(comm.readAt || {}), [user.id]: new Date().toISOString() }
            };
          }
        }
        return comm;
      });

  setCommunications(updatedCommunications);
  localStorage.setItem('smart-student-communications', JSON.stringify(updatedCommunications));
  try { if (editingCommunication) { window.dispatchEvent(new CustomEvent('studentCommunicationsUpdated', { detail: { action: 'edited', id: editingCommunication.id } })); } } catch {}
      
      // Actualizar las comunicaciones recibidas del estudiante
      if (user.role === 'student') {
        loadStudentCommunications(updatedCommunications);
      }

      console.log(`📖 Communication ${communicationId} marked as read by ${user.username}`);
      // Notificar a otros módulos (dashboard/campana) para actualizar contadores
      try {
        window.dispatchEvent(new CustomEvent('studentCommunicationsUpdated', { detail: { action: 'read', userId: user.id, communicationId } }));
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('studentCommunicationsUpdated', { detail: { action: 'created' } }));
      } catch {}
    } catch (error) {
      console.error('Error marking communication as read:', error);
    }
  };

  // Función para obtener información del remitente
  const getSenderInfo = (senderId: string) => {
    try {
      const storedUsers = localStorage.getItem('smart-student-users');
      if (storedUsers) {
        const users = JSON.parse(storedUsers);
        const sender = users.find((u: any) => u.id === senderId);
        return sender ? {
          name: sender.displayName || sender.username,
          email: sender.email || ''
        } : { name: translate('commUnknownSender') || 'Remitente desconocido', email: '' };
      }
    } catch (error) {
      console.error('Error getting sender info:', error);
    }
    return { name: translate('commUnknownSender') || 'Remitente desconocido', email: '' };
  };

  // Función para obtener información del curso/sección
  const getCourseInfo = (courseId: string, sectionId?: string) => {
    try {
      const course = courses.find(c => c.id === courseId);
      const section = sectionId ? sections.find(s => s.id === sectionId) : null;
      
      if (course) {
        return section 
          ? `${course.name} - ${section.name}`
          : course.name;
      }
    } catch (error) {
      console.error('Error getting course info:', error);
    }
    return translate('commUnknownCourse') || 'Curso desconocido';
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = translate('titleRequired') || 'El título es obligatorio';
    }

    if (!formData.content.trim()) {
      newErrors.content = translate('contentRequired') || 'El contenido es obligatorio';
    }

    if (formData.type === 'course') {
      if (!formData.targetCourse || !formData.targetSection) {
        newErrors.targetCourse = translate('courseRequired') || 'Selecciona un curso-sección';
      }
      // Ya no necesitamos validar targetSection por separado
    } else if (formData.type === 'student') {
      if (!formData.selectedCourseForStudent) {
        newErrors.selectedCourseForStudent = translate('courseRequired') || 'Selecciona un curso';
      }
      if (!formData.targetStudent && (formData.selectedStudents?.length || 0) === 0) {
        newErrors.targetStudent = translate('studentRequired') || 'Selecciona al menos un estudiante';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      let updatedCommunications = [...communications];

  if (formData.type === 'student') {
        // Destinatarios: los seleccionados o el actual del Select si no se agregó a la lista
        const recipients = (formData.selectedStudents && formData.selectedStudents.length > 0)
          ? formData.selectedStudents
          : (formData.targetStudent ? [formData.targetStudent] : []);

    recipients.forEach((studentId, i) => {
          const comm: Communication = {
            id: `comm_${Date.now()}_${i}`,
            title: formData.title,
            content: formData.content,
            type: 'student',
            targetStudent: studentId,
            createdBy: user?.username || '',
            senderId: user?.id || '',
            createdAt: new Date().toISOString(),
      readBy: [],
      readAt: {}
          };
          updatedCommunications.push(comm);
        });
      } else {
        // type = 'course'. Ya tenemos courseId y sectionId en formData
        const courseId = formData.targetCourse;
        const sectionId = formData.targetSection;
        const courseName = courses.find(c => c.id === courseId)?.name;
        const sectionName = sections.find(s => s.id === sectionId)?.name;
        const comm: Communication = {
          id: `comm_${Date.now()}`,
          title: formData.title,
          content: formData.content,
          type: 'course',
          targetCourse: courseId,
          targetSection: sectionId,
          targetCourseName: courseName,
          targetSectionName: sectionName,
          createdBy: user?.username || '',
          senderId: user?.id || '',
          createdAt: new Date().toISOString(),
          readBy: [],
          readAt: {}
        };
        updatedCommunications.push(comm);
      }

      setCommunications(updatedCommunications);
      localStorage.setItem('smart-student-communications', JSON.stringify(updatedCommunications));
  try { window.dispatchEvent(new CustomEvent('studentCommunicationsUpdated', { detail: { action: 'created' } })); } catch {}

      // Limpiar formulario
      setFormData({
        title: '',
        content: '',
        type: 'course',
        targetCourse: '',
        targetSection: '',
        targetStudent: '',
        selectedCourseForStudent: '',
        selectedStudents: []
      });
      setErrors({});

      toast({
        title: translate('communicationSent') || 'Comunicación enviada',
        description: translate('communicationSentSuccess') || 'La comunicación ha sido enviada con éxito',
      });
    } catch (error) {
      console.error('Error saving communication:', error);
      toast({
        title: translate('error') || 'Error',
        description: translate('errorSavingCommunication') || 'Error al guardar la comunicación',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (communication: Communication) => {
    setEditingCommunication(communication);
    setFormData({
      title: communication.title,
      content: communication.content,
      type: communication.type,
      targetCourse: communication.targetCourse || '',
      targetSection: communication.targetSection || '',
      targetStudent: communication.targetStudent || '',
  selectedCourseForStudent: '',
  selectedStudents: []
    });
    setShowEditDialog(true);
  };

  // Manejar quitar estudiante de la lista seleccionada
  const removeSelectedStudent = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStudents: prev.selectedStudents.filter(id => id !== studentId)
    }));
  };

  const handleUpdate = () => {
    if (!validateForm() || !editingCommunication) {
      return;
    }

    const updatedCommunication: Communication = {
      ...editingCommunication,
      title: formData.title,
      content: formData.content,
      type: formData.type,
  targetCourse: formData.type === 'course' ? formData.targetCourse : undefined,
  targetSection: formData.type === 'course' ? formData.targetSection : undefined,
  targetCourseName: formData.type === 'course' ? (courses.find(c => c.id === formData.targetCourse)?.name) : undefined,
  targetSectionName: formData.type === 'course' ? (sections.find(s => s.id === formData.targetSection)?.name) : undefined,
      targetStudent: formData.type === 'student' ? formData.targetStudent : undefined,
    };

    try {
      const updatedCommunications = communications.map(comm => 
        comm.id === editingCommunication.id ? updatedCommunication : comm
      );
      setCommunications(updatedCommunications);
      localStorage.setItem('smart-student-communications', JSON.stringify(updatedCommunications));

      setShowEditDialog(false);
      setEditingCommunication(null);
      setFormData({
        title: '',
        content: '',
        type: 'course',
        targetCourse: '',
        targetSection: '',
        targetStudent: '',
  selectedCourseForStudent: '',
  selectedStudents: []
      });
      setErrors({});

      toast({
        title: translate('communicationUpdated') || 'Comunicación actualizada',
        description: translate('communicationUpdatedSuccess') || 'La comunicación ha sido actualizada con éxito',
      });
    } catch (error) {
      console.error('Error updating communication:', error);
      toast({
        title: translate('error') || 'Error',
        description: translate('errorUpdatingCommunication') || 'Error al actualizar la comunicación',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = (communicationId: string) => {
    try {
      const updatedCommunications = communications.filter(comm => comm.id !== communicationId);
  setCommunications(updatedCommunications);
  localStorage.setItem('smart-student-communications', JSON.stringify(updatedCommunications));
  try { window.dispatchEvent(new CustomEvent('studentCommunicationsUpdated', { detail: { action: 'deleted', id: communicationId } })); } catch {}

      toast({
        title: translate('communicationDeleted') || 'Comunicación eliminada',
        description: translate('communicationDeletedSuccess') || 'La comunicación ha sido eliminada con éxito',
      });
    } catch (error) {
      console.error('Error deleting communication:', error);
      toast({
        title: translate('error') || 'Error',
        description: translate('errorDeletingCommunication') || 'Error al eliminar la comunicación',
        variant: 'destructive'
      });
    }
  };

  const getTargetInfo = (communication: Communication) => {
    if (communication.type === 'course') {
      // 1) Intento directo por IDs
      let course = courses.find(c => c.id === communication.targetCourse);
      let section = sections.find(s => s.id === communication.targetSection);

      // 2) Formatos combinados (legado): "courseId-sectionId" o "courseId::sectionId"
      const trySplit = (val?: string) => {
        if (!val) return null;
        if (val.includes('::')) return val.split('::');
        if (val.includes('-')) return val.split('-');
        return null;
      };

      if ((!course || !section) && (communication.targetCourse || communication.targetSection)) {
        const cSplit = trySplit(communication.targetCourse);
        const sSplit = trySplit(communication.targetSection);
        const maybeCourseId = cSplit?.[0] || communication.targetCourse;
        const maybeSectionId = cSplit?.[1] || sSplit?.[1] || sSplit?.[0] || communication.targetSection;

        if (!course && maybeCourseId) {
          course = courses.find(c => c.id === maybeCourseId) || courses.find(c => c.name === maybeCourseId);
        }
        if (!section && maybeSectionId) {
          // Buscar por id directo primero
          section = sections.find(s => s.id === maybeSectionId);
          // Si no existe, intentar por nombre + courseId (caso: 'A'/'B')
          if (!section) {
            const candidateCourseId = course?.id;
            if (candidateCourseId) {
              section = sections.find(s => s.courseId === candidateCourseId && s.name === maybeSectionId) || undefined as any;
            }
          }
        }
      }

      // 3) Derivar curso desde la sección si aún falta
      if (!course && section) {
        const secCourseId = (section as Section).courseId;
        if (secCourseId) {
          course = courses.find(c => c.id === secCourseId);
        }
      }

  // 4) Fallback usando courseSections (cuando existen en estado)
      if ((!course || !section) && courseSections.length > 0) {
        // Por sectionId
        if (!section && communication.targetSection) {
          const cs = courseSections.find(cs => cs.sectionId === communication.targetSection || cs.id.endsWith(`-${communication.targetSection}`));
          if (cs) {
            section = { id: cs.sectionId, name: cs.sectionName, courseId: cs.courseId } as Section;
            if (!course) course = courses.find(c => c.id === cs.courseId) || { id: cs.courseId, name: cs.courseName } as Course;
          }
        }
        // Por courseId o nombre del curso
        if (!course && communication.targetCourse) {
          const cs = courseSections.find(cs => cs.courseId === communication.targetCourse || cs.courseName === communication.targetCourse || cs.name.includes(String(communication.targetCourse)));
          if (cs) {
            course = { id: cs.courseId, name: cs.courseName } as Course;
            if (!section && communication.targetSection) {
              const s = courseSections.find(x => x.courseId === cs.courseId && (x.sectionId === communication.targetSection || x.sectionName === communication.targetSection));
              if (s) section = { id: s.sectionId, name: s.sectionName, courseId: s.courseId } as Section;
            }
          }
        }
      }

      // 5) Último recurso: leer directamente del LocalStorage (por si el estado aún no cargó)
      if (!course || !section) {
        try {
          const lsCourses = LocalStorageManager.getCourses();
          const lsSections = LocalStorageManager.getSections();
          if (!course && communication.targetCourse) {
            course = lsCourses.find((c: any) => c.id === communication.targetCourse || c.name === communication.targetCourse);
          }
          if (!section && communication.targetSection) {
            section = lsSections.find((s: any) => s.id === communication.targetSection);
            if (!section && course?.id) {
              // Buscar por nombre A/B en la sección si solo vino el nombre
              section = lsSections.find((s: any) => s.courseId === course!.id && s.name === communication.targetSection);
            }
          }
        } catch (e) {
          // ignore
        }
      }

  const finalCourseName = course?.name || communication.targetCourseName;
  const finalSectionName = section?.name || communication.targetSectionName;
  return `${finalCourseName || 'Curso desconocido'} - ${finalSectionName || 'Sección desconocida'}`;
    } else {
      const student = students.find(s => s.id === communication.targetStudent);
      return student?.displayName || 'Estudiante desconocido';
    }
  };

  const filteredCommunications = useMemo(() => {
    return memoizedCommunications
      .filter(comm => comm.createdBy === user?.username)
      .filter(comm => 
        comm.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comm.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getTargetInfo(comm).toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [memoizedCommunications, user?.username, searchTerm]);

  // Verificar que el usuario tenga acceso a comunicaciones
  if (user?.role !== 'teacher' && user?.role !== 'student') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {translate('teacherOnlyAccess') || 'Esta página es solo para profesores y estudiantes.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Renderizar vista específica según el rol
  if (user?.role === 'student') {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header para estudiantes */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center text-foreground">
              <Megaphone className="w-8 h-8 mr-3 text-red-500" />
              {translate('receivedCommunications') || 'Comunicaciones Recibidas'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {translate('receivedCommunicationsSubtitle') || 'Mensajes y anuncios enviados por tus profesores'}
            </p>
          </div>
        </div>

        {/* Comunicaciones recibidas */}
        <Card>
          <CardContent className="p-6">
            {receivedCommunications.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {translate('noReceivedCommunications') || 'No tienes comunicaciones nuevas'}
                </h3>
                <p className="text-muted-foreground">
                  {translate('noReceivedCommunicationsSubtext') || 'Aquí aparecerán los mensajes que envíen tus profesores'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {memoizedReceivedCommunications.map((communication, index) => {
                  const isRead = communication.readBy?.includes(user.id);
                  const senderInfo = getSenderInfo(communication.senderId);
                  
                  return (
                    <div
                      key={generateUniqueKey('received', communication.id, index, 'comm')}
                      className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                        !isRead
                          ? 'border-blue-200 bg-blue-50/50 dark:border-blue-500/50 dark:bg-blue-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      onClick={() => handleViewCommunication(communication)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{communication.title}</h3>
                            {isRead ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700 transition-colors hover:bg-red-200 hover:border-red-300 dark:hover:bg-red-900/40">
                                {translate('readCommunication') || 'Leído'}
                              </span>
                            ) : (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full transition-colors hover:bg-blue-600 dark:hover:bg-blue-400">
                                {translate('unreadCommunication') || 'Sin leer'}
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground mb-3 line-clamp-2">
                            {communication.content}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <UserCheck className="w-4 h-4 mr-1" />
                              {translate('sentBy') || 'Enviado por'}:
                              <Badge
                                variant="outline"
                                className="ml-2 mr-2 text-[10px] px-2 py-0.5 rounded-full border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700"
                              >
                                <Shield className="w-3 h-3 inline mr-1" />
                                {translate('teacherTitle') || 'Profesor'}
                              </Badge>
                              {senderInfo.name}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDateTimeOneLine(communication.createdAt)}
                            </div>
                            {communication.type === 'course' && (
                              <div className="flex items-center">
                                <Users className="w-4 h-4 mr-1" />
                                {getCourseInfo(communication.targetCourse || '', communication.targetSection)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para ver detalles de comunicación */}
        <Dialog open={showCommunicationDialog} onOpenChange={setShowCommunicationDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {translate('communicationDetails') || 'Detalles de la Comunicación'}
              </DialogTitle>
            </DialogHeader>
            {selectedCommunication && (
              <div className="space-y-4 py-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">{selectedCommunication.title}</h3>
                  <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>{translate('sentBy') || 'Enviado por'}:</strong><br />
                        <Badge
                          variant="outline"
                          className="mr-2 text-[10px] px-2 py-0.5 rounded-full border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700"
                        >
                          <Shield className="w-3 h-3 inline mr-1" />
                          {translate('teacherTitle') || 'Profesor'}
                        </Badge>
                        {getSenderInfo(selectedCommunication.senderId).name}
                      </div>
                      <div>
                        <strong>{translate('sentDate') || 'Fecha de envío'}:</strong><br />
                        {formatDateTimeOneLine(selectedCommunication.createdAt)}
                      </div>
                      <div>
                        <strong>{translate('readByYou') || 'Leído por ti'}:</strong><br />
                        {selectedCommunication.readAt?.[user.id]
                          ? formatDateTimeOneLine(selectedCommunication.readAt[user.id])
                          : '—'}
                      </div>
                      <div className="md:col-span-2">
                        <strong>{translate('targetAudience') || 'Dirigido a'}:</strong><br />
                        {selectedCommunication.type === 'course' 
                          ? getCourseInfo(selectedCommunication.targetCourse || '', selectedCommunication.targetSection)
                          : translate('specificStudent') || 'Estudiante específico'
                        }
                      </div>
                    </div>
                  </div>
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                      {selectedCommunication.content}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                    onClick={() => setShowCommunicationDialog(false)}
                  >
                    {translate('close') || 'Cerrar'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center text-foreground">
            <Megaphone className="w-8 h-8 mr-3 text-red-500" />
            {translate('cardCommunicationsTitle') || 'Comunicaciones'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {translate('communicationsDescription') || 'Envía mensajes a cursos completos o estudiantes específicos'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario de creación */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Send className="w-5 h-5 mr-2" />
                {translate('createNewCommunication') || 'Crear Nueva Comunicación'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Título */}
                <div>
                  <Label htmlFor="title">
                    {translate('communicationTitle') || 'Título'} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={translate('communicationTitlePlaceholder') || 'Ingresa el título del mensaje'}
                    className={errors.title ? 'border-red-500' : ''}
                  />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                </div>

                {/* Tipo de destinatario */}
                <div>
                  <Label htmlFor="type">
                    {translate('recipientType') || 'Tipo de Destinatario'} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    key={`type-selector-${forceRenderKey}`}
                    value={formData.type}
                    onValueChange={(value: 'course' | 'student') => {
                      setFormData(prev => ({ 
                        ...prev, 
                        type: value,
                        targetCourse: '',
                        targetSection: '',
                        targetStudent: '',
                        selectedCourseForStudent: ''
                      }));
                      // Forzar re-render completo al cambiar tipo
                      setForceRenderKey(prev => prev + 1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">
                        {translate('commCourse') || 'Curso'}
                      </SelectItem>
                      <SelectItem value="student">
                        {translate('specificStudent') || 'Estudiante Específico'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selección de curso para estudiante específico */}
                {formData.type === 'student' && (
                  <div key={`student-course-container-${forceRenderKey}`}>
                    <Label htmlFor="courseForStudent">
                      {translate('commCourse') || 'Curso'} <span className="text-red-500">*</span>
                    </Label>
          <Select
                      key={`student-course-selector-${forceRenderKey}`}
                      value={formData.selectedCourseForStudent}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
            selectedCourseForStudent: value,
            targetStudent: '', // Limpiar estudiante seleccionado al cambiar curso
            selectedStudents: [] // Limpiar múltiples seleccionados al cambiar curso
                      }))}
                    >
                      <SelectTrigger className={errors.selectedCourseForStudent ? 'border-red-500' : ''}>
                        <SelectValue placeholder={translate('commSelectCourse') || 'Selecciona un curso'} />
                      </SelectTrigger>
                      <SelectContent>
                        {memoizedCourseSections.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No tienes cursos asignados
                          </div>
                        ) : (
                          memoizedCourseSections.map((courseSection, index) => {
                            const uniqueKey = `student-course-${courseSection.id}-${index}-${forceRenderKey}`;
                            return (
                              <SelectItem key={uniqueKey} value={courseSection.id}>
                                {courseSection.name}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {errors.selectedCourseForStudent && <p className="text-red-500 text-sm mt-1">{errors.selectedCourseForStudent}</p>}
                  </div>
                )}

                {/* Selección de curso */}
                {formData.type === 'course' && (
                  <div key={`course-container-${forceRenderKey}`}>
                    <Label htmlFor="course">
                      {translate('commCourse') || 'Curso-Sección'} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      key={`course-selector-${forceRenderKey}`}
                      value={formData.targetCourse && formData.targetSection ? `${formData.targetCourse}::${formData.targetSection}` : ''}
                      onValueChange={(value) => {
                        const [courseId, sectionId] = value.split('::');
                        setFormData(prev => ({ ...prev, targetCourse: courseId, targetSection: sectionId }));
                      }}
                    >
                      <SelectTrigger className={errors.targetCourse ? 'border-red-500' : ''}>
                        <SelectValue placeholder={translate('commSelectCourse') || 'Selecciona un curso-sección'} />
                      </SelectTrigger>
                      <SelectContent>
                        {memoizedCourseSections.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            {user?.role === 'teacher' 
                              ? 'No tienes asignaciones. Ve a Admin > Gestión de Usuarios'
                              : 'No hay cursos-sección disponibles'
                            }
                          </div>
                        ) : (
                          memoizedCourseSections.map((courseSection, index) => {
                            const uniqueKey = `course-section-${courseSection.id}-${index}-${forceRenderKey}`;
                            return (
                              <SelectItem key={uniqueKey} value={`${courseSection.courseId}::${courseSection.sectionId}`}>
                                {courseSection.name}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {errors.targetCourse && <p className="text-red-500 text-sm mt-1">{errors.targetCourse}</p>}
                  </div>
                )}

                {/* Selección de estudiante */}
                {formData.type === 'student' && (
                  <div key={`student-container-${forceRenderKey}`}>
                    <Label htmlFor="student">
                      {translate('commStudent') || 'Estudiante'} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      key={`student-selector-${forceRenderKey}`}
                      value={formData.targetStudent}
                      onValueChange={(value) => {
                        setFormData(prev => {
                          const already = prev.selectedStudents.includes(value);
                          return {
                            ...prev,
                            targetStudent: value,
                            selectedStudents: already ? prev.selectedStudents : [...prev.selectedStudents, value]
                          };
                        });
                      }}
                    >
                      <SelectTrigger 
                        disabled={!formData.selectedCourseForStudent}
                        className={`${errors.targetStudent ? 'border-red-500' : ''} ${!formData.selectedCourseForStudent ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <SelectValue 
                          placeholder={
                            !formData.selectedCourseForStudent
                              ? (translate('selectCourseFirst') || 'Selecciona un curso primero')
                              : (translate('commSelectStudent') || 'Selecciona un estudiante')
                          } 
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {memoizedAvailableStudents.map((student, index) => {
                          const uniqueKey = `student-${student.id}-${index}-${forceRenderKey}`;
                          return (
                            <SelectItem key={uniqueKey} value={student.id}>
                              {student.displayName} ({student.email})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {/* Chips de seleccionados */}
                    {formData.selectedStudents.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.selectedStudents.map((id) => {
                          const s = students.find(st => st.id === id) || availableStudents.find(st => st.id === id);
                          const name = s?.displayName || id;
                          return (
                            <div key={`chip-${id}`} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-full text-sm">
                              <span>{name}</span>
                              <button
                                type="button"
                                aria-label="Remove student"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => removeSelectedStudent(id)}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {errors.targetStudent && <p className="text-red-500 text-sm mt-1">{errors.targetStudent}</p>}
                  </div>
                )}

                {/* Contenido */}
                <div>
                  <Label htmlFor="content">
                    {translate('messageContent') || 'Contenido del Mensaje'} <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={translate('messageContentPlaceholder') || 'Escribe el contenido de tu mensaje aquí...'}
                    className={`min-h-[120px] ${errors.content ? 'border-red-500' : ''}`}
                  />
                  {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
                </div>

                <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white">
                  <Send className="w-4 h-4 mr-2" />
                  {translate('sendCommunication') || 'Enviar Comunicación'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral con estadísticas */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {translate('communicationsStats') || 'Estadísticas'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {translate('totalCommunications') || 'Total enviadas'}
                </span>
                <Badge variant="secondary">
                  {filteredCommunications.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {translate('courseCommunications') || 'A cursos'}
                </span>
                <Badge variant="outline">
                  {filteredCommunications.filter(c => c.type === 'course').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {translate('studentCommunications') || 'A estudiantes'}
                </span>
                <Badge variant="outline">
                  {filteredCommunications.filter(c => c.type === 'student').length}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {translate('quickAccess') || 'Acceso Rápido'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                onClick={() => setFormData(prev => ({ ...prev, type: 'course' }))}
              >
                <Users className="w-4 h-4 mr-2" />
                {translate('messageToCourse') || 'Mensaje a Curso'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                onClick={() => setFormData(prev => ({ ...prev, type: 'student' }))}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                {translate('messageToStudent') || 'Mensaje a Estudiante'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Historial de comunicaciones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              {translate('communicationsHistory') || 'Historial de Comunicaciones'}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={translate('searchCommunications') || 'Buscar comunicaciones...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCommunications.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm 
                  ? (translate('noSearchResults') || 'No se encontraron comunicaciones que coincidan con tu búsqueda')
                  : (translate('noCommunications') || 'No has enviado comunicaciones aún')
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCommunications
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((communication, index) => (
                  <div
                    key={generateUniqueKey('sent', communication.id, index, 'history')}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{communication.title}</h3>
                        <p className="text-muted-foreground mb-3 line-clamp-3">
                          {communication.content}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            {communication.type === 'course' ? (
                              <Users className="w-4 h-4 mr-1" />
                            ) : (
                              <UserCheck className="w-4 h-4 mr-1" />
                            )}
                            {getTargetInfo(communication)}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDateTimeOneLine(communication.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleEdit(communication)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(communication.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edición */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {translate('editCommunication') || 'Editar Comunicación'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mismo formulario que el de creación */}
            <div>
              <Label htmlFor="edit-title">
                {translate('communicationTitle') || 'Título'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={translate('communicationTitlePlaceholder') || 'Ingresa el título del mensaje'}
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <Label htmlFor="edit-content">
                {translate('messageContent') || 'Contenido del Mensaje'} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder={translate('messageContentPlaceholder') || 'Escribe el contenido de tu mensaje aquí...'}
                className={`min-h-[120px] ${errors.content ? 'border-red-500' : ''}`}
              />
              {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                {translate('cancel') || 'Cancelar'}
              </Button>
              <Button onClick={handleUpdate}>
                {translate('saveChanges') || 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
