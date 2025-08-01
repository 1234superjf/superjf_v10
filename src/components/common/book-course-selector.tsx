
"use client";
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useAppData } from '@/contexts/app-data-context';
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CourseData } from '@/lib/types';

interface BookCourseSelectorProps {
  onCourseChange: (course: string) => void;
  onBookChange: (book: string) => void;
  selectedCourse: string;
  selectedBook: string;
  initialBookNameToSelect?: string; // New optional prop
  showSubjectSelector?: boolean; // Para mostrar selector de asignaturas
  onSubjectChange?: (subject: string) => void; // Callback para cambio de asignatura
  selectedSubject?: string; // Asignatura seleccionada
  showBookSelector?: boolean; // Para mostrar/ocultar selector de libros
}

export function BookCourseSelector({ 
  onCourseChange, 
  onBookChange, 
  selectedCourse, 
  selectedBook, 
  initialBookNameToSelect,
  showSubjectSelector = false,
  onSubjectChange,
  selectedSubject = '',
  showBookSelector = true
}: BookCourseSelectorProps) {
  const { translate, language } = useLanguage();
  const { courses } = useAppData();
  const { getAccessibleCourses, hasAccessToCourse, isAdmin, user, isLoading } = useAuth();
  const [booksForCourse, setBooksForCourse] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  // Función para traducir nombres de asignaturas
  const translateSubjectName = (subjectName: string): string => {
    // Mapeo directo de nombres exactos de asignaturas
    const exactSubjectMap: { [key: string]: string } = {
      'Ciencias Naturales': translate('subjectCienciasNaturales'),
      'Historia, Geografía y Ciencias Sociales': translate('subjectHistoriaGeografia'),
      'Lenguaje y Comunicación': translate('subjectLenguajeComunicacion'),
      'Matemáticas': translate('subjectMatematicas'),
    };
    
    // Si encontramos una coincidencia exacta, usarla
    if (exactSubjectMap[subjectName]) {
      return exactSubjectMap[subjectName];
    }
    
    // Fallback con lógica parcial para otras asignaturas
    const lowerSubject = subjectName.toLowerCase();
    
    if (lowerSubject.includes('matemáticas') || lowerSubject.includes('matematicas') || lowerSubject.includes('mathematics') || lowerSubject.includes('math')) {
      return translate('subjectMatematicas');
    }
    if (lowerSubject.includes('ciencias naturales') || lowerSubject.includes('natural sciences')) {
      return translate('subjectCienciasNaturales');
    }
    if (lowerSubject.includes('historia') && (lowerSubject.includes('geografía') || lowerSubject.includes('geografia') || lowerSubject.includes('geography'))) {
      return translate('subjectHistoriaGeografia');
    }
    if (lowerSubject.includes('lenguaje') && (lowerSubject.includes('comunicación') || lowerSubject.includes('comunicacion') || lowerSubject.includes('communication'))) {
      return translate('subjectLenguajeComunicacion');
    }
    if (lowerSubject.includes('física') || lowerSubject.includes('fisica') || lowerSubject.includes('physics')) {
      return translate('subjectFisica');
    }
    if (lowerSubject.includes('química') || lowerSubject.includes('quimica') || lowerSubject.includes('chemistry')) {
      return translate('subjectQuimica');
    }
    
    // Si no encuentra una traducción específica, devolver el nombre original
    return subjectName;
  };

  // Función para obtener las asignaturas asignadas al profesor para un curso específico
  const getTeacherAssignedSubjectsForCourse = (courseName: string) => {
    if (!user || user.role !== 'teacher' || !courseName) return [];

    try {
      console.log('🔍 [BookSelector] Obteniendo asignaturas del profesor:', user.username, 'para curso:', courseName);
      
      const storedUsers = localStorage.getItem('smart-student-users');
      if (!storedUsers) return [];
      
      const usersData = JSON.parse(storedUsers);
      const fullUserData = usersData.find((u: any) => u.username === user.username);
      if (!fullUserData) return [];

      const storedAssignments = localStorage.getItem('smart-student-teacher-assignments');
      const storedSections = localStorage.getItem('smart-student-sections');
      const storedCourses = localStorage.getItem('smart-student-courses');

      if (storedAssignments && storedSections && storedCourses) {
        const assignments = JSON.parse(storedAssignments);
        const sections = JSON.parse(storedSections);
        const courses = JSON.parse(storedCourses);

        // Buscar asignaciones por ID del profesor
        const teacherAssignments = assignments.filter((assignment: any) => 
          assignment.teacherId === fullUserData.id
        );

        const assignedSubjectsForCourse = new Set<string>();

        teacherAssignments.forEach((assignment: any) => {
          const section = sections.find((s: any) => s.id === assignment.sectionId);
          if (section) {
            const course = courses.find((c: any) => c.id === section.courseId);
            if (course && course.name === courseName) {
              assignedSubjectsForCourse.add(assignment.subjectName);
              console.log('✅ [BookSelector] Asignatura encontrada para', courseName, ':', assignment.subjectName);
            }
          }
        });

        const result = Array.from(assignedSubjectsForCourse);
        console.log('📋 [BookSelector] Asignaturas finales para', courseName, ':', result);
        return result;
      }

      return [];
    } catch (error) {
      console.error('[BookSelector] Error al obtener asignaturas por curso:', error);
      return [];
    }
  };

  // Función para obtener las asignaturas asignadas al profesor
  const getTeacherAssignedSubjects = () => {
    if (!user || user.role !== 'teacher') return null;

    try {
      console.log('🔍 [BookSelector] Analizando asignaciones del profesor:', user.username);
      
      // Obtener datos del usuario completo desde localStorage
      const storedUsers = localStorage.getItem('smart-student-users');
      if (!storedUsers) {
        console.warn('[BookSelector] No se encontraron usuarios en localStorage');
        return null;
      }
      
      const usersData = JSON.parse(storedUsers);
      const fullUserData = usersData.find((u: any) => u.username === user.username);
      
      if (!fullUserData) {
        console.warn('[BookSelector] Usuario no encontrado:', user.username);
        return null;
      }

      console.log('👤 [BookSelector] Datos del usuario:', {
        id: fullUserData.id,
        username: fullUserData.username,
        role: fullUserData.role
      });

      // Buscar asignaciones en el sistema de gestión de usuarios
      const storedAssignments = localStorage.getItem('smart-student-teacher-assignments');
      const storedSections = localStorage.getItem('smart-student-sections');
      const storedCourses = localStorage.getItem('smart-student-courses');

      console.log('📦 [BookSelector] Verificando datos:', {
        hasAssignments: !!storedAssignments,
        hasSections: !!storedSections,
        hasCourses: !!storedCourses
      });

      if (storedAssignments && storedSections && storedCourses) {
        const assignments = JSON.parse(storedAssignments);
        const sections = JSON.parse(storedSections);
        const courses = JSON.parse(storedCourses);

        console.log('📋 [BookSelector] Total asignaciones en sistema:', assignments.length);
        console.log('📋 [BookSelector] Buscando asignaciones para teacherId:', fullUserData.id);

        // Buscar asignaciones por ID del profesor
        const teacherAssignments = assignments.filter((assignment: any) => 
          assignment.teacherId === fullUserData.id
        );

        console.log('📋 [BookSelector] Asignaciones encontradas para este profesor:', teacherAssignments);

        if (teacherAssignments.length > 0) {
          const assignedCourses = new Set<string>();
          const assignedSubjects = new Set<string>();

          teacherAssignments.forEach((assignment: any) => {
            console.log('🔍 [BookSelector] Procesando asignación:', assignment);
            const section = sections.find((s: any) => s.id === assignment.sectionId);
            
            if (section) {
              const course = courses.find((c: any) => c.id === section.courseId);
              if (course) {
                assignedCourses.add(course.name);
                console.log('📚 [BookSelector] Curso agregado:', course.name);
              }
              assignedSubjects.add(assignment.subjectName);
              console.log('🎯 [BookSelector] Asignatura agregada:', assignment.subjectName);
            }
          });

          const result = {
            courses: Array.from(assignedCourses),
            subjects: Array.from(assignedSubjects)
          };

          console.log('✅ [BookSelector] Resultado final:', result);
          return result;
        }
      }

      console.log('⚠️ [BookSelector] No se encontraron asignaciones específicas para el profesor');
      return null;

    } catch (error) {
      console.error('[BookSelector] Error al obtener asignaciones del profesor:', error);
      return null;
    }
  };

  // Función para verificar si un libro coincide con las asignaturas del profesor
  const doesBookMatchTeacherSubjects = (bookName: string): boolean => {
    if (!user || user.role !== 'teacher') return true;
    
    // Si hay selector de asignaturas y una asignatura específica seleccionada
    if (showSubjectSelector && selectedSubject) {
      console.log('🎯 [BookSelector] Filtrando por asignatura específica:', selectedSubject);
      return matchesSpecificSubject(bookName, selectedSubject);
    }
    
    // Si hay selector de asignaturas pero no hay asignatura seleccionada, no mostrar libros
    if (showSubjectSelector && !selectedSubject) {
      console.log('⚠️ [BookSelector] No hay asignatura seleccionada, no mostrar libros');
      return false;
    }
    
    // Si no hay selector de asignaturas, usar todas las asignaturas del profesor
    const teacherAssignments = getTeacherAssignedSubjects();
    if (!teacherAssignments?.subjects || teacherAssignments.subjects.length === 0) {
      return true;
    }

    return teacherAssignments.subjects.some((subject: string) => 
      matchesSpecificSubject(bookName, subject)
    );
  };

  // Función auxiliar para verificar si un libro coincide con una asignatura específica
  const matchesSpecificSubject = (bookName: string, subject: string): boolean => {
    const lowerSubject = subject.toLowerCase();
    const lowerBook = bookName.toLowerCase();
    
    // Mapear asignaturas a nombres comunes en libros
    if (lowerSubject.includes('matemáticas') || lowerSubject.includes('matematicas')) {
      return lowerBook.includes('matemática') || lowerBook.includes('matematica');
    }
    if (lowerSubject.includes('ciencias') && lowerSubject.includes('naturales')) {
      return lowerBook.includes('ciencias naturales') || lowerBook.includes('ciencias');
    }
    if (lowerSubject.includes('historia') || lowerSubject.includes('geografía') || lowerSubject.includes('sociales')) {
      return lowerBook.includes('historia') || lowerBook.includes('geografía') || lowerBook.includes('sociales');
    }
    if (lowerSubject.includes('lenguaje') || lowerSubject.includes('comunicación')) {
      return lowerBook.includes('lenguaje') || lowerBook.includes('comunicación');
    }
    if (lowerSubject.includes('física') || lowerSubject.includes('fisica')) {
      return lowerBook.includes('física') || lowerBook.includes('fisica');
    }
    if (lowerSubject.includes('química') || lowerSubject.includes('quimica')) {
      return lowerBook.includes('química') || lowerBook.includes('quimica');
    }
    if (lowerSubject.includes('biología') || lowerSubject.includes('biologia')) {
      return lowerBook.includes('biología') || lowerBook.includes('biologia');
    }
    
    // Fallback: verificación por inclusión directa
    return lowerBook.includes(lowerSubject) || lowerSubject.includes(lowerBook);
  };

  // Early return if loading or no user
  if (isLoading || !user) {
    return (
      <div className="space-y-3">
        <div className="h-12 bg-muted animate-pulse rounded-md"></div>
        <div className="h-12 bg-muted animate-pulse rounded-md"></div>
      </div>
    );
  }

  // Filtrar cursos basado en permisos del usuario  
  const isUserAdmin = isAdmin();
  let filteredCourses: string[] = [];

  if (user?.role === 'teacher') {
    // Para profesores, filtrar por cursos asignados
    const teacherAssignments = getTeacherAssignedSubjects();
    if (teacherAssignments?.courses) {
      filteredCourses = teacherAssignments.courses;
      console.log('📚 [BookSelector] Cursos filtrados para profesor:', filteredCourses);
    } else {
      // Fallback a cursos accesibles normales
      const userAccessibleCourses = getAccessibleCourses();
      filteredCourses = Object.keys(courses || {}).filter(course => 
        Array.isArray(userAccessibleCourses) && userAccessibleCourses.includes(course)
      );
    }
  } else {
    // Para admin y estudiantes, usar lógica original
    const userAccessibleCourses = getAccessibleCourses();
    const accessibleCourses = isUserAdmin ? Object.keys(courses || {}) : (userAccessibleCourses || []);
    filteredCourses = Object.keys(courses || {}).filter(course => 
      Array.isArray(accessibleCourses) && accessibleCourses.includes(course)
    );
  }

  // Cargar asignaturas disponibles para el profesor del curso seleccionado
  useEffect(() => {
    if (showSubjectSelector && user?.role === 'teacher' && selectedCourse) {
      console.log('🔍 [BookSelector] Cargando asignaturas para profesor:', user.username, 'en curso:', selectedCourse);
      const subjectsForCourse = getTeacherAssignedSubjectsForCourse(selectedCourse);
      
      if (subjectsForCourse.length > 0) {
        console.log('✅ [BookSelector] Asignaturas encontradas para el curso:', subjectsForCourse);
        setAvailableSubjects(subjectsForCourse);
        
        // Resetear la selección de asignatura si la actual no está disponible
        if (selectedSubject && !subjectsForCourse.includes(selectedSubject)) {
          onSubjectChange?.('');
        }
      } else {
        console.log('⚠️ [BookSelector] No hay asignaturas asignadas para el curso:', selectedCourse);
        setAvailableSubjects([]);
        onSubjectChange?.('');
      }
    } else if (!showSubjectSelector) {
      setAvailableSubjects([]);
    }
  }, [showSubjectSelector, user?.role, selectedCourse, selectedSubject, onSubjectChange, language]);

  useEffect(() => {
    if (selectedCourse && courses[selectedCourse] && hasAccessToCourse(selectedCourse)) {
      let newBooks = courses[selectedCourse][language] || [];
      
      // 🎓 FILTRAR LIBROS PARA PROFESORES BASADO EN SUS ASIGNATURAS ASIGNADAS
      if (user?.role === 'teacher') {
        newBooks = newBooks.filter(bookName => doesBookMatchTeacherSubjects(bookName));
        console.log(`📚 [BookSelector] Libros filtrados para profesor en ${selectedCourse}:`, newBooks);
      }
      
      setBooksForCourse(newBooks);
      
      if (initialBookNameToSelect && newBooks.includes(initialBookNameToSelect)) {
        onBookChange(initialBookNameToSelect);
      } else {
        // Only reset if not trying to set an initial book or if course itself changed significantly
        // This condition might need refinement if initialBookNameToSelect should persist across course changes that still contain it
        if (!initialBookNameToSelect || selectedBook && !newBooks.includes(selectedBook) ) {
             onBookChange('');
        }
      }
    } else {
      setBooksForCourse([]);
      onBookChange(''); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedSubject, language, courses, initialBookNameToSelect, hasAccessToCourse, user?.role, showSubjectSelector]); // agregado selectedSubject

  return (
    <>
      <Select onValueChange={onCourseChange} value={selectedCourse}>
        <SelectTrigger className="w-full py-3 text-base md:text-sm">
          <SelectValue placeholder={translate('selectCourse')} />
        </SelectTrigger>
        <SelectContent>
          {filteredCourses.map(courseName => (
            <SelectItem key={courseName} value={courseName}>
              {courseName.replace(/Básico/g, 'Básico').replace(/Medio/g, 'Medio')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showSubjectSelector && user?.role === 'teacher' && (
        <Select 
          onValueChange={(value) => {
            if (onSubjectChange) {
              onSubjectChange(value);
              // Resetear la selección de libro cuando cambie la asignatura
              onBookChange('');
            }
          }} 
          value={selectedSubject}
          disabled={!selectedCourse || availableSubjects.length === 0}
        >
          <SelectTrigger className="w-full py-3 text-base md:text-sm">
            <SelectValue placeholder={translate('selectSubject')} />
          </SelectTrigger>
          <SelectContent>
            {availableSubjects.map(subject => (
              <SelectItem key={subject} value={subject}>
                {translateSubjectName(subject)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showBookSelector && (
        <Select onValueChange={onBookChange} value={selectedBook} disabled={!selectedCourse || booksForCourse.length === 0 || (showSubjectSelector && user?.role === 'teacher' && !selectedSubject)}>
          <SelectTrigger className="w-full py-3 text-base md:text-sm">
            <SelectValue placeholder={translate('selectBook')} />
          </SelectTrigger>
          <SelectContent>
            {booksForCourse.map(bookName => (
              <SelectItem key={bookName} value={bookName}>
                {bookName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );
}
    
