"use client";

import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useAppData } from '@/contexts/app-data-context';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Library, Download, Book, FileText, GraduationCap, Filter, Microscope, Calculator, BookOpen, Map, Atom, Zap, TestTube, Brain, Users, Scale } from 'lucide-react';
import { bookPDFs, BookPDF } from '@/lib/books-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

export default function LibrosPage() {
  const { translate, language } = useLanguage();
  const { courses } = useAppData();
  const { user, getAccessibleCourses, hasAccessToCourse, isLoading } = useAuth();
  const { toast } = useToast();

  // Early return if loading or no user
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{translate('loadingLibrary')}</p>
        </div>
      </div>
    );
  }

  // 🎓 FUNCIÓN PARA OBTENER ASIGNACIONES DEL PROFESOR
  const getTeacherAssignedSubjects = () => {
    if (!user || user.role !== 'teacher') return null;

    try {
      console.log('🔍 [Libros] Analizando asignaciones del profesor:', user.username);
      
      // Obtener datos del usuario completo desde localStorage
      const storedUsers = localStorage.getItem('smart-student-users');
      if (!storedUsers) {
        console.warn('[Libros] No se encontraron usuarios en localStorage');
        return null;
      }
      
      const usersData = JSON.parse(storedUsers);
      const fullUserData = usersData.find((u: any) => u.username === user.username);
      
      if (!fullUserData) {
        console.warn('[Libros] No se encontró el usuario completo');
        return null;
      }

      // Buscar asignaciones en el sistema de gestión de usuarios (teacher-assignments)
      const assignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
      const courses = JSON.parse(localStorage.getItem('smart-student-courses') || '[]');
      const sections = JSON.parse(localStorage.getItem('smart-student-sections') || '[]');

      console.log('📊 [Libros] Datos del sistema:', { 
        assignments: assignments.length, 
        courses: courses.length, 
        sections: sections.length,
        teacherId: fullUserData.id 
      });

      // Buscar asignaciones por ID del profesor
      const teacherAssignments = assignments.filter((assignment: any) => 
        assignment.teacherId === fullUserData.id
      );

      console.log('📋 [Libros] Asignaciones encontradas:', teacherAssignments);

      if (teacherAssignments.length > 0) {
        // Extraer cursos y asignaturas únicos
        const assignedCourses = new Set<string>();
        const assignedSubjects = new Set<string>();

        teacherAssignments.forEach((assignment: any) => {
          const section = sections.find((s: any) => s.id === assignment.sectionId);
          
          if (section) {
            const course = courses.find((c: any) => c.id === section.courseId);
            if (course) {
              assignedCourses.add(course.name);
            }
            assignedSubjects.add(assignment.subjectName);
          }
        });

        console.log('✅ [Libros] Cursos asignados:', Array.from(assignedCourses));
        console.log('✅ [Libros] Asignaturas asignadas:', Array.from(assignedSubjects));

        return {
          courses: Array.from(assignedCourses),
          subjects: Array.from(assignedSubjects)
        };
      }

      // Fallback: usar teachingAssignments del usuario
      if (fullUserData.teachingAssignments && Array.isArray(fullUserData.teachingAssignments) && fullUserData.teachingAssignments.length > 0) {
        console.log('⚠️ [Libros] Usando teachingAssignments como fallback');
        
        const assignedCourses = new Set<string>();
        const assignedSubjects = new Set<string>();

        fullUserData.teachingAssignments.forEach((assignment: any) => {
          if (assignment.courses && Array.isArray(assignment.courses)) {
            assignment.courses.forEach((course: string) => assignedCourses.add(course));
          }
          if (assignment.subject) {
            assignedSubjects.add(assignment.subject);
          }
        });

        return {
          courses: Array.from(assignedCourses),
          subjects: Array.from(assignedSubjects)
        };
      }

      // Último fallback: asignación por defecto
      console.log('⚠️ [Libros] Usando asignación por defecto');
      return {
        courses: ['4to Básico'],
        subjects: ['Matemáticas']
      };

    } catch (error) {
      console.error('[Libros] Error al obtener asignaciones del profesor:', error);
      return null;
    }
  };

  // Function to get subject icon and color
  const getSubjectIconAndColor = (subject: string) => {
    const lowerSubject = subject.toLowerCase();
    
    // Ciencias básicas
    if (lowerSubject.includes('ciencias') && lowerSubject.includes('naturales')) {
      return { icon: Microscope, color: 'text-green-600' };
    } 
    // Materias específicas de media
    else if (lowerSubject.includes('biología') || lowerSubject.includes('biologia')) {
      return { icon: Atom, color: 'text-emerald-600' };
    } else if (lowerSubject.includes('física') || lowerSubject.includes('fisica')) {
      return { icon: Zap, color: 'text-yellow-600' };
    } else if (lowerSubject.includes('química') || lowerSubject.includes('quimica')) {
      return { icon: TestTube, color: 'text-purple-600' };
    } else if (lowerSubject.includes('filosofía') || lowerSubject.includes('filosofia')) {
      return { icon: Brain, color: 'text-indigo-600' };
    } else if (lowerSubject.includes('ciencias para la ciudadanía') || lowerSubject.includes('ciencias para la ciudadania')) {
      return { icon: Users, color: 'text-teal-600' };
    } else if (lowerSubject.includes('educación ciudadana') || lowerSubject.includes('educacion ciudadana')) {
      return { icon: Scale, color: 'text-orange-600' };
    }
    // Materias básicas
    else if (lowerSubject.includes('matemáticas') || lowerSubject.includes('matematicas')) {
      return { icon: Calculator, color: 'text-blue-600' };
    } else if (lowerSubject.includes('lenguaje') || lowerSubject.includes('comunicación')) {
      return { icon: BookOpen, color: 'text-red-600' };
    } else if (lowerSubject.includes('historia') || lowerSubject.includes('geografía') || lowerSubject.includes('sociales')) {
      return { icon: Map, color: 'text-amber-700' };
    } else {
      return { icon: Book, color: 'text-gray-600' };
    }
  };

  // Función para traducir nombres de asignaturas
  const translateSubject = (subject: string): string => {
    if (language === 'es') return subject; // Sin traducción si está en español
    
    const subjectMap: { [key: string]: string } = {
      'Ciencias Naturales': translate('subjectCienciasNaturales'),
      'Historia, Geografía y Ciencias Sociales': translate('subjectHistoriaGeografia'),
      'Lenguaje y Comunicación': translate('subjectLenguajeComunicacion'),
      'Matemáticas': translate('subjectMatematicas'),
      'Física': translate('subjectFisica'),
      'Química': translate('subjectQuimica'),
      'Biología': translate('subjectBiologia'),
      'Filosofía y Psicología': translate('subjectFilosofia'),
      'Educación Ciudadana': translate('subjectEducacionCiudadana'),
      'Inglés': translate('subjectIngles'),
      'Artes Visuales': translate('subjectArtes'),
      'Música': translate('subjectMusica'),
      'Educación Física y Salud': translate('subjectEducacionFisica'),
      'Tecnología': translate('subjectTecnologia'),
      'Religión': translate('subjectReligion'),
      'Orientación': translate('subjectOrientacion')
    };
    
    return subjectMap[subject] || subject;
  };

  // Función para traducir nombres de cursos
  const translateCourse = (course: string): string => {
    if (language === 'es') return course; // Sin traducción si está en español
    
    const courseMap: { [key: string]: string } = {
      '1ro Básico': translate('course1roBasico'),
      '2do Básico': translate('course2doBasico'),
      '3ro Básico': translate('course3roBasico'),
      '4to Básico': translate('course4toBasico'),
      '5to Básico': translate('course5toBasico'),
      '6to Básico': translate('course6toBasico'),
      '7mo Básico': translate('course7moBasico'),
      '8vo Básico': translate('course8voBasico'),
      '1ro Medio': translate('course1roMedio'),
      '2do Medio': translate('course2doMedio'),
      '3ro Medio': translate('course3roMedio'),
      '4to Medio': translate('course4toMedio')
    };
    
    return courseMap[course] || course;
  };

  // Group books by course - filtered by user permissions and teacher assignments
  const booksByCourse = useMemo(() => {
    let filteredBooks = [...bookPDFs];

    // 🎓 FILTRAR LIBROS PARA PROFESORES BASADO EN SUS ASIGNACIONES
    if (user.role === 'teacher') {
      const teacherAssignments = getTeacherAssignedSubjects();
      
      if (teacherAssignments) {
        console.log('📚 [Libros] Filtrando libros para profesor:', {
          assignedCourses: teacherAssignments.courses,
          assignedSubjects: teacherAssignments.subjects,
          totalBooks: bookPDFs.length
        });

        filteredBooks = bookPDFs.filter(book => {
          const courseMatch = teacherAssignments.courses.includes(book.course);
          const subjectMatch = teacherAssignments.subjects.some(subject => 
            book.subject.toLowerCase().includes(subject.toLowerCase()) ||
            subject.toLowerCase().includes(book.subject.toLowerCase())
          );
          
          const hasAccess = courseMatch && subjectMatch;
          
          if (hasAccess) {
            console.log(`✅ [Libros] Acceso permitido: ${book.subject} - ${book.course}`);
          }
          
          return hasAccess;
        });

        console.log(`📊 [Libros] Libros filtrados: ${filteredBooks.length}/${bookPDFs.length}`);
      } else {
        console.warn('⚠️ [Libros] No se pudieron obtener asignaciones del profesor');
        // Si no se pueden obtener asignaciones, mostrar solo libros básicos por defecto
        filteredBooks = bookPDFs.filter(book => book.course === '4to Básico' && book.subject === 'Matemáticas');
      }
    } else {
      // Para estudiantes y admin, usar lógica existente
      const accessibleCourses = getAccessibleCourses();
      filteredBooks = bookPDFs.filter(book => 
        hasAccessToCourse(book.course) && accessibleCourses.includes(book.course)
      );
    }
    
    // Agrupar libros filtrados por curso
    const grouped = filteredBooks.reduce((acc, book) => {
      if (!acc[book.course]) {
        acc[book.course] = [];
      }
      acc[book.course].push(book);
      return acc;
    }, {} as Record<string, BookPDF[]>);

    return grouped;
  }, [user.role, getAccessibleCourses, hasAccessToCourse]);

  // 📚 FUNCIÓN PARA VERIFICAR ACCESO A UN LIBRO ESPECÍFICO
  const hasAccessToBook = (book: BookPDF) => {
    if (user.role === 'teacher') {
      const teacherAssignments = getTeacherAssignedSubjects();
      
      if (!teacherAssignments) return false;
      
      const courseMatch = teacherAssignments.courses.includes(book.course);
      const subjectMatch = teacherAssignments.subjects.some(subject => 
        book.subject.toLowerCase().includes(subject.toLowerCase()) ||
        subject.toLowerCase().includes(book.subject.toLowerCase())
      );
      
      return courseMatch && subjectMatch;
    } else {
      // Para estudiantes y admin, usar verificación existente
      return hasAccessToCourse(book.course);
    }
  };

  const handleDownloadPdf = (book: BookPDF) => {
    // 🎓 VERIFICAR ACCESO ESPECÍFICO PARA PROFESORES
    if (user.role === 'teacher') {
      const teacherAssignments = getTeacherAssignedSubjects();
      
      if (teacherAssignments) {
        const courseMatch = teacherAssignments.courses.includes(book.course);
        const subjectMatch = teacherAssignments.subjects.some(subject => 
          book.subject.toLowerCase().includes(subject.toLowerCase()) ||
          subject.toLowerCase().includes(book.subject.toLowerCase())
        );
        
        if (!courseMatch || !subjectMatch) {
          toast({
            title: translate('accessDenied'),
            description: `No tienes asignado el curso "${book.course}" o la asignatura "${book.subject}"`,
            variant: 'destructive'
          });
          return;
        }
      } else {
        toast({
          title: translate('accessDenied'),
          description: translate('couldNotVerifyAssignments'),
          variant: 'destructive'
        });
        return;
      }
    } else {
      // Para estudiantes y admin, usar verificación existente
      if (!hasAccessToCourse(book.course)) {
        toast({
          title: translate('accessDenied'),
          description: translate('noBookPermissions'),
          variant: 'destructive'
        });
        return;
      }
    }

    window.open(book.pdfUrl, '_blank');
    toast({
      title: translate('pdfOpened'),
      description: translate('openingBook', { title: book.title }),
      variant: 'default'
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Library className="w-12 h-12 text-green-500 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {translate('digitalLibraryTitle')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {translate('digitalLibraryDescription')}
        </p>
        
        {/* 🎓 INFORMACIÓN DE ASIGNACIONES PARA PROFESORES */}
        {user.role === 'teacher' && (() => {
          const teacherAssignments = getTeacherAssignedSubjects();
          
          if (teacherAssignments) {
            return (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-slate-600">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                    {translate('teacherAcademicAssignments')}
                  </h3>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  {translate('teacherBooksAccessInfo')}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {/* Mostrar cursos */}
                  {teacherAssignments.courses.map((course, index) => (
                    <Badge key={`course-${index}`} variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      📚 {translateCourse(course)}
                    </Badge>
                  ))}
                  {/* Mostrar asignaturas */}
                  {teacherAssignments.subjects.map((subject, index) => (
                    <Badge key={`subject-${index}`} variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300">
                      🎯 {translateSubject(subject)}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          }
          
          return (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
              <div className="flex items-center justify-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                  {translate('informationNotAvailable')}
                </h3>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {translate('couldNotLoadAssignments')}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Books List */}
      <div className="space-y-8">
        {/* 📊 CONTADOR DE LIBROS PARA PROFESORES */}
        {user.role === 'teacher' && Object.keys(booksByCourse).length > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-700">
              <Book className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {Object.values(booksByCourse).flat().length} {translate('booksAvailableForAssignments')}
              </span>
            </div>
          </div>
        )}
        
        {Object.keys(booksByCourse).length === 0 ? (
          <div className="text-center py-12">
            <Library className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            {user.role === 'teacher' ? (
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {translate('noBooksAvailableForAssignments')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {translate('onlyAccessAssignedBooks')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {translate('contactAdminIfError')}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                  {translate('noAccessToBooks')}
                </h3>
                <p className="text-muted-foreground">
                  {translate('contactAdminForAccess')}
                </p>
              </div>
            )}
          </div>
        ) : (
          Object.entries(booksByCourse).map(([course, books]) => (
            <div key={course} className="space-y-4">
              {/* Course Title */}
              <div className="flex items-center gap-3 mb-6">
                <GraduationCap className="w-6 h-6 text-green-600" />
                <h2 className="text-2xl font-bold text-foreground">{translateCourse(course)}</h2>
                <Badge variant="secondary" className="ml-auto">
                  {books.length} {books.length === 1 ? translate('bookSingular') : translate('bookPlural')}
                </Badge>
              </div>

              {/* Books Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {books.map((book, index) => {
                  const { icon: SubjectIcon, color } = getSubjectIconAndColor(book.subject);
                  return (
                    <Card key={`${book.course}-${book.subject}-${index}`} className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
                      <CardHeader className="pb-3 flex-grow">
                        <div className="flex items-start gap-2">
                          <SubjectIcon className={`w-5 h-5 ${color} mt-1 flex-shrink-0`} />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
                              {translateSubject(book.subject)}
                            </CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 mt-auto">
                        <div className="space-y-3">
                          <Badge variant="outline" className="text-xs">
                            {translateCourse(book.course)}
                          </Badge>
                          <Button
                            variant="outline"
                            onClick={() => handleDownloadPdf(book)}
                            className={cn(
                              "home-card-button home-card-button-green",
                              "hover:shadow-lg hover:scale-105 transition-all duration-200"
                            )}
                            size="sm"
                            disabled={!hasAccessToBook(book)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {translate('downloadPDF')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
