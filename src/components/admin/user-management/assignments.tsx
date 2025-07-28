"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  UserCheck, 
  Users, 
  GraduationCap,
  BookOpen,
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LocalStorageManager } from '@/lib/education-utils';
import { Student, Teacher, TeacherAssignment, Course, Section, Subject } from '@/types/education';

interface AssignmentFormData {
  type: 'student' | 'teacher';
  userId: string;
  courseId?: string;
  sectionId?: string;
  subjectIds?: string[];
}

export default function Assignments() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormData>({
    type: 'student',
    userId: '',
    courseId: '',
    sectionId: '',
    subjectIds: []
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const studentsData = LocalStorageManager.getStudents();
      const teachersData = LocalStorageManager.getTeachers();
      const coursesData = LocalStorageManager.getCourses();
      const sectionsData = LocalStorageManager.getSections();
      const subjectsData = LocalStorageManager.getSubjects();
      const assignmentsData = LocalStorageManager.getAssignments();

      setStudents(studentsData);
      setTeachers(teachersData);
      setCourses(coursesData);
      setSections(sectionsData);
      setSubjects(subjectsData);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive'
      });
    }
  };

  // Get unassigned students
  const getUnassignedStudents = () => {
    return students.filter(student => !student.courseId || !student.sectionId);
  };

  // Get available sections for a course
  const getAvailableSections = (courseId: string) => {
    return sections.filter(s => s.courseId === courseId);
  };

  // Get subjects for a course
  const getSubjectsForCourse = (courseId: string) => {
    return subjects.filter(s => s.courseId === courseId);
  };

  // Get teacher assignments info
  const getTeacherAssignments = (teacherId: string) => {
    return assignments.filter(a => a.teacherId === teacherId && a.isActive);
  };

  // Handle student assignment
  const handleAssignStudent = async () => {
    if (!assignmentForm.userId || !assignmentForm.courseId || !assignmentForm.sectionId) {
      toast({
        title: 'Error',
        description: 'Todos los campos son requeridos',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update student
      const updatedStudents = students.map(student => 
        student.id === assignmentForm.userId
          ? {
              ...student,
              courseId: assignmentForm.courseId,
              sectionId: assignmentForm.sectionId,
              updatedAt: new Date()
            }
          : student
      );
      
      setStudents(updatedStudents);
      LocalStorageManager.setStudents(updatedStudents);

      // Update section student count
      const updatedSections = sections.map(section => 
        section.id === assignmentForm.sectionId
          ? { ...section, studentCount: section.studentCount + 1 }
          : section
      );
      
      setSections(updatedSections);
      LocalStorageManager.setSections(updatedSections);

      resetForm();
      setShowAssignmentDialog(false);

      toast({
        title: 'Éxito',
        description: 'Estudiante asignado correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo asignar el estudiante',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle teacher assignment
  const handleAssignTeacher = async () => {
    if (!assignmentForm.userId || !assignmentForm.sectionId || !assignmentForm.subjectIds?.length) {
      toast({
        title: 'Error',
        description: 'Todos los campos son requeridos',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create new assignments for each subject
      const newAssignments: TeacherAssignment[] = assignmentForm.subjectIds.map(subjectId => ({
        teacherId: assignmentForm.userId,
        sectionId: assignmentForm.sectionId!,
        subjectId,
        isActive: true,
        assignedAt: new Date()
      }));

      const updatedAssignments = [...assignments, ...newAssignments];
      setAssignments(updatedAssignments);
      LocalStorageManager.setAssignments(updatedAssignments);

      // Update teacher's assigned sections
      const updatedTeachers = teachers.map(teacher => 
        teacher.id === assignmentForm.userId
          ? {
              ...teacher,
              assignedSections: [...(teacher.assignedSections || []), ...newAssignments],
              updatedAt: new Date()
            }
          : teacher
      );
      
      setTeachers(updatedTeachers);
      LocalStorageManager.setTeachers(updatedTeachers);

      resetForm();
      setShowAssignmentDialog(false);

      toast({
        title: 'Éxito',
        description: 'Profesor asignado correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo asignar el profesor',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Remove student assignment
  const handleRemoveStudentAssignment = (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      // Update student
      const updatedStudents = students.map(s => 
        s.id === studentId
          ? { ...s, courseId: undefined, sectionId: undefined, updatedAt: new Date() }
          : s
      );
      
      setStudents(updatedStudents);
      LocalStorageManager.setStudents(updatedStudents);

      // Update section student count
      if (student.sectionId) {
        const updatedSections = sections.map(section => 
          section.id === student.sectionId
            ? { ...section, studentCount: Math.max(0, section.studentCount - 1) }
            : section
        );
        
        setSections(updatedSections);
        LocalStorageManager.setSections(updatedSections);
      }

      toast({
        title: 'Éxito',
        description: 'Asignación de estudiante removida',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo remover la asignación',
        variant: 'destructive'
      });
    }
  };

  // Remove teacher assignment
  const handleRemoveTeacherAssignment = (assignmentId: string) => {
    try {
      const assignment = assignments.find(a => 
        a.teacherId === assignmentId // This is actually the teacher ID for simplicity
      );
      
      if (!assignment) return;

      // Remove assignments
      const updatedAssignments = assignments.filter(a => a.teacherId !== assignmentId);
      setAssignments(updatedAssignments);
      LocalStorageManager.setAssignments(updatedAssignments);

      // Update teacher
      const updatedTeachers = teachers.map(teacher => 
        teacher.id === assignmentId
          ? { ...teacher, assignedSections: [], updatedAt: new Date() }
          : teacher
      );
      
      setTeachers(updatedTeachers);
      LocalStorageManager.setTeachers(updatedTeachers);

      toast({
        title: 'Éxito',
        description: 'Asignación de profesor removida',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo remover la asignación',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setAssignmentForm({
      type: 'student',
      userId: '',
      courseId: '',
      sectionId: '',
      subjectIds: []
    });
  };

  // Get course and section names
  const getCourseAndSectionName = (courseId?: string, sectionId?: string) => {
    const course = courses.find(c => c.id === courseId);
    const section = sections.find(s => s.id === sectionId);
    return {
      courseName: course?.name || 'Sin curso',
      sectionName: section?.name || 'Sin sección'
    };
  };

  // Get subject name
  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || 'Asignatura desconocida';
  };

  // Get assignment details for teacher
  const getTeacherAssignmentDetails = (teacherId: string) => {
    const teacherAssignments = getTeacherAssignments(teacherId);
    const details = teacherAssignments.map(assignment => {
      const section = sections.find(s => s.id === assignment.sectionId);
      const course = courses.find(c => c.id === section?.courseId);
      const subject = subjects.find(s => s.id === assignment.subjectId);
      
      return {
        courseName: course?.name || 'Sin curso',
        sectionName: section?.name || 'Sin sección',
        subjectName: subject?.name || 'Sin asignatura',
        subjectColor: subject?.color || '#gray'
      };
    });

    return details;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <UserCheck className="w-6 h-6 mr-2 text-blue-500" />
            Asignaciones
          </h2>
          <p className="text-muted-foreground">
            Asigna estudiantes a cursos y profesores a materias
          </p>
        </div>
        
        <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
          <DialogTrigger asChild>
            <Button 
              onClick={resetForm}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nueva Asignación</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Assignment Type */}
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="assignStudent"
                    name="assignmentType"
                    checked={assignmentForm.type === 'student'}
                    onChange={() => setAssignmentForm(prev => ({ 
                      ...prev, 
                      type: 'student',
                      userId: '',
                      courseId: '',
                      sectionId: '',
                      subjectIds: []
                    }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="assignStudent" className="flex items-center cursor-pointer">
                    <GraduationCap className="w-4 h-4 mr-1" />
                    Estudiante
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="assignTeacher"
                    name="assignmentType"
                    checked={assignmentForm.type === 'teacher'}
                    onChange={() => setAssignmentForm(prev => ({ 
                      ...prev, 
                      type: 'teacher',
                      userId: '',
                      courseId: '',
                      sectionId: '',
                      subjectIds: []
                    }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="assignTeacher" className="flex items-center cursor-pointer">
                    <Users className="w-4 h-4 mr-1" />
                    Profesor
                  </Label>
                </div>
              </div>

              {/* User Selection */}
              <div>
                <Label htmlFor="userId">
                  {assignmentForm.type === 'student' ? 'Estudiante *' : 'Profesor *'}
                </Label>
                <Select
                  value={assignmentForm.userId}
                  onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, userId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Selecciona un ${assignmentForm.type === 'student' ? 'estudiante' : 'profesor'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentForm.type === 'student' 
                      ? getUnassignedStudents().map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} (@{student.username})
                          </SelectItem>
                        ))
                      : teachers.map(teacher => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name} (@{teacher.username})
                          </SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Course Selection */}
              <div>
                <Label htmlFor="courseId">Curso *</Label>
                <Select
                  value={assignmentForm.courseId}
                  onValueChange={(value) => setAssignmentForm(prev => ({ 
                    ...prev, 
                    courseId: value, 
                    sectionId: '',
                    subjectIds: []
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name} ({course.level === 'basica' ? 'Básica' : 'Media'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section Selection */}
              <div>
                <Label htmlFor="sectionId">Sección *</Label>
                <Select
                  value={assignmentForm.sectionId}
                  onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, sectionId: value }))}
                  disabled={!assignmentForm.courseId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sección" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableSections(assignmentForm.courseId || '').map(section => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name} ({section.studentCount}/{section.maxStudents || 'Sin límite'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Selection (only for teachers) */}
              {assignmentForm.type === 'teacher' && (
                <div>
                  <Label>Asignaturas *</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {getSubjectsForCourse(assignmentForm.courseId || '').map(subject => (
                      <div key={subject.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`subject-${subject.id}`}
                          checked={assignmentForm.subjectIds?.includes(subject.id) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignmentForm(prev => ({
                                ...prev,
                                subjectIds: [...(prev.subjectIds || []), subject.id]
                              }));
                            } else {
                              setAssignmentForm(prev => ({
                                ...prev,
                                subjectIds: prev.subjectIds?.filter(id => id !== subject.id) || []
                              }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <Label 
                          htmlFor={`subject-${subject.id}`} 
                          className="flex items-center cursor-pointer flex-1"
                        >
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: subject.color }}
                          />
                          {subject.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={assignmentForm.type === 'student' ? handleAssignStudent : handleAssignTeacher}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Crear Asignación
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAssignmentDialog(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
              Estudiantes Asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => s.courseId && s.sectionId).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              de {students.length} total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <XCircle className="w-4 h-4 mr-2 text-red-500" />
              Estudiantes Sin Asignar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {getUnassignedStudents().length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              requieren asignación
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2 text-blue-500" />
              Profesores Asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teachers.filter(t => t.assignedSections && t.assignedSections.length > 0).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              de {teachers.length} total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <BookOpen className="w-4 h-4 mr-2" />
              Asignaciones Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.filter(a => a.isActive).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              profesor-materia
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GraduationCap className="w-5 h-5 mr-2" />
            Asignaciones de Estudiantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Unassigned Students */}
            {getUnassignedStudents().length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2 flex items-center">
                  <XCircle className="w-4 h-4 mr-1" />
                  Estudiantes Sin Asignar ({getUnassignedStudents().length})
                </h4>
                <div className="space-y-2">
                  {getUnassignedStudents().map(student => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950"
                    >
                      <div>
                        <span className="font-medium">{student.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">@{student.username}</span>
                      </div>
                      <Badge variant="destructive">Sin asignar</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Students */}
            <div>
              <h4 className="font-medium text-green-600 mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                Estudiantes Asignados ({students.filter(s => s.courseId && s.sectionId).length})
              </h4>
              <div className="space-y-2">
                {students
                  .filter(student => student.courseId && student.sectionId)
                  .map(student => {
                    const { courseName, sectionName } = getCourseAndSectionName(
                      student.courseId, 
                      student.sectionId
                    );

                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center space-x-3">
                          <div>
                            <span className="font-medium">{student.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">@{student.username}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{courseName}</Badge>
                            <Badge variant="secondary">{sectionName}</Badge>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveStudentAssignment(student.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Asignaciones de Profesores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teachers.map(teacher => {
              const assignmentDetails = getTeacherAssignmentDetails(teacher.id);
              const hasAssignments = assignmentDetails.length > 0;

              return (
                <div
                  key={teacher.id}
                  className={`p-4 border rounded-lg ${
                    hasAssignments ? 'bg-green-50 dark:bg-green-950 border-green-200' : 'bg-gray-50 dark:bg-gray-950'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div>
                        <span className="font-medium">{teacher.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">@{teacher.username}</span>
                      </div>
                      {hasAssignments ? (
                        <Badge variant="default" className="bg-green-500">
                          {assignmentDetails.length} asignaciones
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin asignaciones</Badge>
                      )}
                    </div>
                    
                    {hasAssignments && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveTeacherAssignment(teacher.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {hasAssignments && (
                    <div className="space-y-2">
                      {assignmentDetails.map((detail, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Badge variant="outline">{detail.courseName}</Badge>
                          <Badge variant="secondary">{detail.sectionName}</Badge>
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: detail.subjectColor,
                              color: detail.subjectColor 
                            }}
                          >
                            {detail.subjectName}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
