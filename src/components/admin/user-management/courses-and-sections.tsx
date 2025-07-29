"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';
import { 
  Plus, 
  GraduationCap, 
  Users, 
  BookOpen, 
  Edit2, 
  Trash2, 
  Save,
  X,
  Building
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EducationCodeGenerator, LocalStorageManager, EducationAutomation } from '@/lib/education-utils';
import { Course, Section, Subject } from '@/types/education';
import { getSubjectsForCourseWithColors, getSubjectColor } from '@/lib/subjects-colors';
import { getAllCourses } from '@/lib/books-data';

export default function CoursesAndSections() {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  // Form data
  const [courseForm, setCourseForm] = useState({
    name: '',
    level: 'basica' as 'basica' | 'media',
    description: ''
  });

  const [sectionForm, setSectionForm] = useState({
    name: '',
    courseId: '',
    maxStudents: 30
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const coursesData = LocalStorageManager.getCourses();
      const sectionsData = LocalStorageManager.getSections();
      const subjectsData = LocalStorageManager.getSubjects();

      setCourses(coursesData);
      setSections(sectionsData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive'
      });
    }
  };

  // Función para crear secciones A y B automáticamente
  const handleCreateStandardSections = async () => {
    setIsLoading(true);
    try {
      // Debug: Verificar cursos antes de crear secciones
      console.log('=== DEBUGGING SECTION CREATION ===');
      LocalStorageManager.debugLocalStorage();
      
      const result = EducationAutomation.createStandardSections();
      
      if (result.success) {
        // Recargar datos
        loadData();
        
        toast({
          title: 'Éxito',
          description: result.message,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error in handleCreateStandardSections:', error);
      toast({
        title: 'Error',
        description: 'Error al crear las secciones automáticas',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Función FORZADA para depuración
  const handleForceCreateSections = async () => {
    setIsLoading(true);
    try {
      console.log('=== FORCE MODE DEBUGGING ===');
      LocalStorageManager.debugLocalStorage();
      
      const result = EducationAutomation.forceCreateSectionsForAllCourses();
      
      if (result.success) {
        loadData();
        toast({
          title: 'Éxito (Modo Forzado)',
          description: result.message,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error in handleForceCreateSections:', error);
      toast({
        title: 'Error',
        description: 'Error en modo forzado',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Función para crear cursos estándar
  const handleCreateStandardCourses = async () => {
    setIsLoading(true);
    try {
      const result = EducationAutomation.createStandardCourses();
      
      if (result.success) {
        // Recargar datos
        loadData();
        
        toast({
          title: 'Éxito',
          description: result.message,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al crear los cursos estándar',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Función para recalcular contadores de estudiantes
  const handleRecalculateCounters = async () => {
    setIsLoading(true);
    try {
      const result = EducationAutomation.recalculateSectionCounts();
      
      if (result.success) {
        // Recargar datos
        loadData();
        
        toast({
          title: 'Éxito',
          description: result.message,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al recalcular los contadores',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Course management
  const handleCreateCourse = async () => {
    if (!courseForm.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del curso es requerido',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Crear el curso
      const newCourse: Course = {
        id: crypto.randomUUID(),
        uniqueCode: EducationCodeGenerator.generateCourseCode(),
        name: courseForm.name.trim(),
        level: courseForm.level,
        description: courseForm.description.trim(),
        sections: [],
        subjects: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedCourses = [...courses, newCourse];
      setCourses(updatedCourses);
      LocalStorageManager.setCourses(updatedCourses);

      // Crear automáticamente secciones A y B
      const sectionA: Section = {
        id: crypto.randomUUID(),
        uniqueCode: EducationCodeGenerator.generateSectionCode(),
        name: 'A',
        courseId: newCourse.id,
        studentCount: 0,
        maxStudents: 30,
        subjects: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const sectionB: Section = {
        id: crypto.randomUUID(),
        uniqueCode: EducationCodeGenerator.generateSectionCode(),
        name: 'B',
        courseId: newCourse.id,
        studentCount: 0,
        maxStudents: 30,
        subjects: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newSections = [...sections, sectionA, sectionB];
      setSections(newSections);
      LocalStorageManager.setSections(newSections);

      // Crear asignaturas basadas en los libros disponibles
      const subjectsWithColors = getSubjectsForCourseWithColors(courseForm.name.trim());
      const newSubjects: Subject[] = [];

      subjectsWithColors.forEach(subjectColor => {
        const newSubject: Subject = {
          id: crypto.randomUUID(),
          uniqueCode: EducationCodeGenerator.generateSubjectCode(),
          name: subjectColor.name,
          abbreviation: subjectColor.abbreviation,
          description: `Asignatura de ${subjectColor.name} para ${courseForm.name.trim()}`,
          courseId: newCourse.id,
          color: subjectColor.color,
          bgColor: subjectColor.bgColor,
          textColor: subjectColor.textColor,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        newSubjects.push(newSubject);
      });

      if (newSubjects.length > 0) {
        const updatedSubjects = [...subjects, ...newSubjects];
        setSubjects(updatedSubjects);
        LocalStorageManager.setSubjects(updatedSubjects);
      }

      setCourseForm({ name: '', level: 'basica', description: '' });
      setShowCourseDialog(false);

      toast({
        title: 'Éxito',
        description: `Curso creado con ${newSubjects.length} asignaturas y 2 secciones (A y B)`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear el curso',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse || !courseForm.name.trim()) return;

    setIsLoading(true);
    try {
      const updatedCourse: Course = {
        ...editingCourse,
        name: courseForm.name.trim(),
        level: courseForm.level,
        description: courseForm.description.trim(),
        updatedAt: new Date()
      };

      const updatedCourses = courses.map(c => 
        c.id === editingCourse.id ? updatedCourse : c
      );
      
      setCourses(updatedCourses);
      LocalStorageManager.setCourses(updatedCourses);

      setEditingCourse(null);
      setCourseForm({ name: '', level: 'basica', description: '' });
      setShowCourseDialog(false);

      toast({
        title: 'Éxito',
        description: 'Curso actualizado correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el curso',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    try {
      // Check if course has sections
      const courseSections = sections.filter(s => s.courseId === courseId);
      if (courseSections.length > 0) {
        toast({
          title: 'Error',
          description: 'No se puede eliminar un curso que tiene secciones',
          variant: 'destructive'
        });
        return;
      }

      const updatedCourses = courses.filter(c => c.id !== courseId);
      setCourses(updatedCourses);
      LocalStorageManager.setCourses(updatedCourses);

      // Also remove subjects for this course
      const updatedSubjects = subjects.filter(s => s.courseId !== courseId);
      setSubjects(updatedSubjects);
      LocalStorageManager.setSubjects(updatedSubjects);

      toast({
        title: 'Éxito',
        description: 'Curso eliminado correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el curso',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    try {
      const section = sections.find(s => s.id === sectionId);
      if (!section) {
        toast({
          title: 'Error',
          description: 'Sección no encontrada',
          variant: 'destructive'
        });
        return;
      }

      // Check if section has students
      if (section.studentCount > 0) {
        toast({
          title: 'Error',
          description: 'No se puede eliminar una sección que tiene estudiantes',
          variant: 'destructive'
        });
        return;
      }

      const updatedSections = sections.filter(s => s.id !== sectionId);
      setSections(updatedSections);
      LocalStorageManager.setSections(updatedSections);

      toast({
        title: 'Éxito',
        description: 'Sección eliminada correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la sección',
        variant: 'destructive'
      });
    }
  };

  // Section management
  const handleCreateSection = async () => {
    if (!sectionForm.name.trim() || !sectionForm.courseId) {
      toast({
        title: 'Error',
        description: 'El nombre de la sección y el curso son requeridos',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const newSection: Section = {
        id: crypto.randomUUID(),
        uniqueCode: EducationCodeGenerator.generateSectionCode(),
        name: sectionForm.name.trim(),
        courseId: sectionForm.courseId,
        studentCount: 0,
        maxStudents: sectionForm.maxStudents,
        subjects: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedSections = [...sections, newSection];
      setSections(updatedSections);
      LocalStorageManager.setSections(updatedSections);

      setSectionForm({ name: '', courseId: '', maxStudents: 30 });
      setShowSectionDialog(false);

      toast({
        title: 'Éxito',
        description: 'Sección creada correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear la sección',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSectionsForCourse = (courseId: string) => {
    return sections.filter(s => s.courseId === courseId);
  };

  const getSubjectsForCourse = (courseId: string) => {
    return subjects.filter(s => s.courseId === courseId);
  };

  // Nueva función para obtener asignaturas directamente de los libros
  const getSubjectsFromBooks = (courseName: string) => {
    return getSubjectsForCourseWithColors(courseName);
  };

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Building className="w-6 h-6 mr-2 text-blue-500" />
            {translate('userManagementTabCourses') || 'Cursos y Secciones'}
          </h2>
          <p className="text-muted-foreground">
            {translate('coursesManageAcademicStructure') || 'Gestiona la estructura académica de tu institución'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleCreateStandardCourses}
            disabled={isLoading}
            variant="outline"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            {isLoading ? 
              (translate('coursesCreating') || 'Creando...') : 
              (translate('coursesCreateStandardCourses') || 'Crear Cursos Estándar')
            }
          </Button>

          <Button 
            onClick={handleForceCreateSections}
            disabled={isLoading}
            variant="outline"
          >
            <Building className="w-4 h-4 mr-2" />
            {isLoading ? 
              (translate('coursesCreating') || 'Creando...') : 
              (translate('coursesCreateABSections') || 'Crear Secciones A y B')
            }
          </Button>

          <Button 
            onClick={handleRecalculateCounters}
            disabled={isLoading}
            variant="outline"
          >
            <Users className="w-4 h-4 mr-2" />
            {isLoading ? 
              (translate('coursesRecalculating') || 'Recalculando...') : 
              (translate('coursesRecalculateCounters') || 'Recalcular Contadores')
            }
          </Button>
          
          <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingCourse(null);
                  setCourseForm({ name: '', level: 'basica', description: '' });
                }}
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                {translate('coursesNewCourse') || 'Nuevo Curso'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingCourse ? 
                    (translate('coursesEditCourse') || 'Editar Curso') : 
                    (translate('coursesCreateNewCourse') || 'Crear Nuevo Curso')
                  }
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="courseName">{translate('coursesCourseName') || 'Nombre del Curso'} *</Label>
                  <Input
                    id="courseName"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={translate('coursesCourseNamePlaceholder') || "Ej: Primer Año Básico"}
                  />
                </div>
                
                <div>
                  <Label htmlFor="courseLevel">{translate('coursesEducationalLevel') || 'Nivel Educativo'} *</Label>
                  <Select
                    value={courseForm.level}
                    onValueChange={(value: 'basica' | 'media') => 
                      setCourseForm(prev => ({ ...prev, level: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={translate('coursesSelectLevel') || "Selecciona el nivel"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basica">{translate('coursesBasicEducation') || 'Educación Básica'}</SelectItem>
                      <SelectItem value="media">{translate('coursesSecondaryEducation') || 'Educación Media'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="courseDescription">{translate('coursesDescription') || 'Descripción'}</Label>
                  <Textarea
                    id="courseDescription"
                    value={courseForm.description}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={translate('coursesDescriptionPlaceholder') || "Descripción opcional del curso"}
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={editingCourse ? handleUpdateCourse : handleCreateCourse}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingCourse ? 
                      (translate('coursesUpdate') || 'Actualizar') : 
                      (translate('coursesCreateCourse') || 'Crear Curso')
                    }
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCourseDialog(false)}
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={courses.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                {translate('coursesNewSection') || 'Nueva Sección'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{translate('coursesCreateNewSection') || 'Crear Nueva Sección'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sectionCourse">{translate('coursesCourse') || 'Curso'} *</Label>
                  <Select
                    value={sectionForm.courseId}
                    onValueChange={(value) => setSectionForm(prev => ({ ...prev, courseId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={translate('coursesSelectCourse') || "Selecciona un curso"} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sectionName">{translate('coursesSectionName') || 'Nombre de la Sección'} *</Label>
                  <Input
                    id="sectionName"
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={translate('coursesSectionNamePlaceholder') || "Ej: Sección A"}
                  />
                </div>

                <div>
                  <Label htmlFor="maxStudents">{translate('coursesMaxStudents') || 'Máximo de Estudiantes'}</Label>
                  <Input
                    id="maxStudents"
                    type="number"
                    min="1"
                    max="50"
                    value={sectionForm.maxStudents}
                    onChange={(e) => setSectionForm(prev => ({ 
                      ...prev, 
                      maxStudents: parseInt(e.target.value) || 30 
                    }))}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreateSection}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {translate('coursesCreateSection') || 'Crear Sección'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSectionDialog(false)}
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{translate('coursesNoCoursesCreated') || 'No hay cursos creados'}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {translate('coursesStartCreatingFirstCourse') || 'Comienza creando tu primer curso para organizar la estructura académica'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => {
            const courseSections = getSectionsForCourse(course.id);
            const bookSubjects = getSubjectsFromBooks(course.name);

            return (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center text-lg">
                        <GraduationCap className="w-5 h-5 mr-2 text-blue-500" />
                        {course.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant={course.level === 'basica' ? 'default' : 'secondary'}
                          className={course.level === 'media' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                        >
                          {course.level === 'basica' ? 'Básica' : 'Media'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {course.uniqueCode}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCourse(course);
                          setCourseForm({
                            name: course.name,
                            level: course.level,
                            description: course.description || ''
                          });
                          setShowCourseDialog(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCourse(course.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {course.description}
                    </p>
                  )}
                  
                  {/* Removed: Curso de {course.name} - Educación {course.level} line */}
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {translate('coursesSections') || 'Secciones'} ({courseSections.length})
                      </span>
                    </div>
                    
                    {courseSections.length > 0 ? (
                      <div className="space-y-2">
                        {courseSections.map(section => (
                          <div
                            key={section.id}
                            className="flex items-center justify-between p-2 bg-muted rounded-lg"
                          >
                            <span className="text-sm">{section.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {section.studentCount}/{section.maxStudents}
                              </Badge>
                              {section.studentCount === 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteSection(section.id)}
                                  title="Eliminar sección"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {translate('coursesNoSectionsCreated') || 'No hay secciones creadas'}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium flex items-center">
                        <BookOpen className="w-4 h-4 mr-1" />
                        {translate('coursesSubjects') || 'Asignaturas'} ({bookSubjects.length})
                      </span>
                    </div>
                    
                    {bookSubjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {bookSubjects.map((subject, index) => (
                          <Badge
                            key={`${course.id}-${subject.name}-${index}`}
                            className="text-xs font-bold border-0 cursor-help px-2 py-1"
                            style={{
                              backgroundColor: subject.bgColor,
                              color: subject.textColor
                            }}
                            title={subject.name}
                          >
                            {subject.abbreviation}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No hay asignaturas disponibles para este curso
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
