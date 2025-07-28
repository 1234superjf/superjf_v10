"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Users, 
  UserPlus, 
  GraduationCap,
  Mail,
  Key,
  Edit2,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { 
  EducationCodeGenerator, 
  LocalStorageManager, 
  FormValidation,
  UsernameGenerator,
  EducationAutomation
} from '@/lib/education-utils';
import { Student, Teacher, UserFormData } from '@/types/education';
import { getAllAvailableSubjects, getSubjectsForLevel, SubjectColor } from '@/lib/subjects-colors';

export default function UserManagement() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userType, setUserType] = useState<'student' | 'teacher'>('student');
  const [editingUser, setEditingUser] = useState<Student | Teacher | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [autoGenerateCredentials, setAutoGenerateCredentials] = useState(true);

  // Form data
  const [userForm, setUserForm] = useState<UserFormData>({
    username: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    courseId: '',
    sectionId: ''
  });

  // Selected subjects for teachers
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Form validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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

      setStudents(studentsData);
      setTeachers(teachersData);
      setCourses(coursesData);
      setSections(sectionsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive'
      });
    }
  };

  // Auto-generate credentials when name changes
  useEffect(() => {
    if (autoGenerateCredentials && userForm.name.trim()) {
      const username = UsernameGenerator.generateFromName(userForm.name, userForm.role);
      const password = UsernameGenerator.generateRandomPassword();
      
      setUserForm(prev => ({
        ...prev,
        username,
        password,
        confirmPassword: password
      }));
    }
  }, [userForm.name, userForm.role, autoGenerateCredentials]);

  // Get sections for selected course
  const getAvailableSections = () => {
    if (!userForm.courseId) return [];
    return sections.filter(s => s.courseId === userForm.courseId);
  };

  // Get all available subjects for teachers (from all courses)
  const getAvailableSubjects = () => {
    return getAllAvailableSubjects();
  };  // Handle subject selection for teachers
  const handleSubjectToggle = (subjectName: string) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subjectName)) {
        return prev.filter(s => s !== subjectName);
      } else {
        return [...prev, subjectName];
      }
    });
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Name validation
    if (!userForm.name.trim()) {
      errors.name = 'El nombre es requerido';
    } else if (!FormValidation.validateName(userForm.name)) {
      errors.name = 'El nombre debe tener al menos 2 caracteres y solo letras';
    }

    // Username validation
    if (!userForm.username.trim()) {
      errors.username = 'El nombre de usuario es requerido';
    } else if (!FormValidation.validateUsername(userForm.username)) {
      errors.username = 'El usuario debe tener 3-20 caracteres alfanuméricos';
    } else {
      // Check if username exists
      const allUsers = [...students, ...teachers];
      const existingUser = allUsers.find(u => 
        u.username === userForm.username && (!editingUser || u.id !== editingUser.id)
      );
      if (existingUser) {
        errors.username = 'Este nombre de usuario ya existe';
      }
    }

    // Email validation (optional)
    if (userForm.email.trim()) {
      // Only validate format if email is provided
      if (!FormValidation.validateEmail(userForm.email)) {
        errors.email = 'El formato del email no es válido';
      } else {
        // Check if email exists
        const allUsers = [...students, ...teachers];
        const existingUser = allUsers.find(u => 
          u.email === userForm.email && (!editingUser || u.id !== editingUser.id)
        );
        if (existingUser) {
          errors.email = 'Este email ya está registrado';
        }
      }
    }

    // Password validation (only for new users)
    if (!editingUser) {
      if (!userForm.password) {
        errors.password = 'La contraseña es requerida';
      } else {
        const passwordValidation = FormValidation.validatePassword(userForm.password);
        if (!passwordValidation.isValid) {
          errors.password = passwordValidation.errors[0];
        }
      }

      if (userForm.password !== userForm.confirmPassword) {
        errors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }

    // Student-specific validations
    if (userForm.role === 'student') {
      if (!userForm.courseId) {
        errors.courseId = 'El curso es requerido para estudiantes';
      }
      if (!userForm.sectionId) {
        errors.sectionId = 'La sección es requerida para estudiantes';
      }
    }

    // Teacher-specific validations
    if (userForm.role === 'teacher') {
      if (selectedSubjects.length === 0) {
        errors.subjects = 'Selecciona al menos una asignatura para el profesor';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle user creation/update
  const handleSaveUser = async () => {
    if (!validateForm()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor corrige los errores en el formulario',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      if (editingUser) {
        await handleUpdateUser();
      } else {
        await handleCreateUser();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el usuario',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    const baseUser = {
      id: crypto.randomUUID(),
      username: userForm.username.trim(),
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (userForm.role === 'student') {
      const newStudent: Student = {
        ...baseUser,
        uniqueCode: EducationCodeGenerator.generateStudentCode(),
        role: 'student',
        courseId: userForm.courseId,
        sectionId: userForm.sectionId
      };

      const updatedStudents = [...students, newStudent];
      setStudents(updatedStudents);
      LocalStorageManager.setStudents(updatedStudents);

      // Update section student count
      const updatedSections = sections.map(s => 
        s.id === userForm.sectionId 
          ? { ...s, studentCount: s.studentCount + 1 }
          : s
      );
      setSections(updatedSections);
      LocalStorageManager.setSections(updatedSections);

    } else {
      const newTeacher: Teacher = {
        ...baseUser,
        uniqueCode: EducationCodeGenerator.generateTeacherCode(),
        role: 'teacher',
        assignedSections: [],
        selectedSubjects: [...selectedSubjects]
      };

      const updatedTeachers = [...teachers, newTeacher];
      setTeachers(updatedTeachers);
      LocalStorageManager.setTeachers(updatedTeachers);
    }

    // Also save to main users array (for backward compatibility)
    const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
    const newUserForMain = {
      ...baseUser,
      password: userForm.password // In a real app, this should be hashed
    };
    const updatedAllUsers = [...allUsers, newUserForMain];
    localStorage.setItem('smart-student-users', JSON.stringify(updatedAllUsers));

    resetForm();
    setShowUserDialog(false);

    toast({
      title: 'Éxito',
      description: `${userForm.role === 'student' ? 'Estudiante' : 'Profesor'} creado correctamente`,
      variant: 'default'
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const updatedUserData = {
      ...editingUser,
      username: userForm.username.trim(),
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      updatedAt: new Date()
    };

    // Update password if provided
    if (userForm.password) {
      // In a real app, password should be hashed
    }

    if (editingUser.role === 'student') {
      const studentData = updatedUserData as Student;
      
      // Update course/section if changed
      if (userForm.courseId !== studentData.courseId || userForm.sectionId !== studentData.sectionId) {
        // Update student's course and section
        studentData.courseId = userForm.courseId;
        studentData.sectionId = userForm.sectionId;

        // Update student data
        const updatedStudents = students.map(s => 
          s.id === editingUser.id ? studentData : s
        );
        setStudents(updatedStudents);
        LocalStorageManager.setStudents(updatedStudents);

        // Recalculate section counts automatically
        const recalculateResult = EducationAutomation.recalculateSectionCounts();
        if (recalculateResult.success) {
          // Reload sections with updated counts
          const updatedSections = LocalStorageManager.getSections();
          setSections(updatedSections);
        }
      } else {
        // If no section change, just update the student
        const updatedStudents = students.map(s => 
          s.id === editingUser.id ? studentData : s
        );
        setStudents(updatedStudents);
        LocalStorageManager.setStudents(updatedStudents);
      }
    } else {
      // Update teacher data
      const teacherData = updatedUserData as Teacher;
      teacherData.preferredCourseId = userForm.courseId;
      teacherData.selectedSubjects = [...selectedSubjects];
      
      const updatedTeachers = teachers.map(t => 
        t.id === editingUser.id ? teacherData : t
      );
      setTeachers(updatedTeachers);
      LocalStorageManager.setTeachers(updatedTeachers);
    }

    // Update main users array
    const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
    const updatedAllUsers = allUsers.map((u: any) => 
      u.username === editingUser.username 
        ? { ...u, ...updatedUserData }
        : u
    );
    localStorage.setItem('smart-student-users', JSON.stringify(updatedAllUsers));

    resetForm();
    setShowUserDialog(false);

    toast({
      title: 'Éxito',
      description: 'Usuario actualizado correctamente',
      variant: 'default'
    });
  };

  const handleDeleteUser = (user: Student | Teacher) => {
    try {
      if (user.role === 'student') {
        const student = user as Student;
        
        // Decrease section student count
        if (student.sectionId) {
          const updatedSections = sections.map(s => 
            s.id === student.sectionId 
              ? { ...s, studentCount: Math.max(0, s.studentCount - 1) }
              : s
          );
          setSections(updatedSections);
          LocalStorageManager.setSections(updatedSections);
        }

        const updatedStudents = students.filter(s => s.id !== user.id);
        setStudents(updatedStudents);
        LocalStorageManager.setStudents(updatedStudents);
      } else {
        const updatedTeachers = teachers.filter(t => t.id !== user.id);
        setTeachers(updatedTeachers);
        LocalStorageManager.setTeachers(updatedTeachers);
      }

      // Remove from main users array
      const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const updatedAllUsers = allUsers.filter((u: any) => u.username !== user.username);
      localStorage.setItem('smart-student-users', JSON.stringify(updatedAllUsers));

      toast({
        title: 'Éxito',
        description: 'Usuario eliminado correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el usuario',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setUserForm({
      username: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      courseId: '',
      sectionId: ''
    });
    setSelectedSubjects([]);
    setValidationErrors({});
    setEditingUser(null);
    setAutoGenerateCredentials(true);
  };

  const openEditDialog = (user: Student | Teacher) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      name: user.name,
      email: user.email,
      password: '', // Always empty when editing
      confirmPassword: '', // Always empty when editing
      role: user.role,
      courseId: user.role === 'student' ? (user as Student).courseId || '' : '',
      sectionId: user.role === 'student' ? (user as Student).sectionId || '' : ''
    });
    
    // Load selected subjects for teachers
    if (user.role === 'teacher') {
      setSelectedSubjects((user as Teacher).selectedSubjects || []);
    } else {
      setSelectedSubjects([]);
    }
    
    setAutoGenerateCredentials(false); // Never auto-generate when editing
    setShowUserDialog(true);
  };

  const getCourseAndSectionName = (student: Student) => {
    const course = courses.find(c => c.id === student.courseId);
    const section = sections.find(s => s.id === student.sectionId);
    return {
      courseName: course?.name || 'Sin curso',
      sectionName: section?.name || 'Sin sección'
    };
  };

  const getTeacherCourseInfo = (teacher: Teacher) => {
    const course = courses.find(c => c.id === teacher.preferredCourseId);
    return {
      courseName: course?.name || 'Sin curso asignado',
      courseLevel: course?.level || null,
      subjects: teacher.selectedSubjects || []
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Users className="w-6 h-6 mr-2 text-blue-500" />
            Gestión de Usuarios
          </h2>
          <p className="text-muted-foreground">
            Crea y administra estudiantes y profesores
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  resetForm();
                  setUserType('student');
                  setUserForm(prev => ({ ...prev, role: 'student' }));
                }}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* User Type Selection */}
                {!editingUser && (
                  <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="student"
                        name="userType"
                        checked={userForm.role === 'student'}
                        onChange={() => setUserForm(prev => ({ 
                          ...prev, 
                          role: 'student',
                          courseId: '',
                          sectionId: ''
                        }))}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="student" className="flex items-center cursor-pointer">
                        <GraduationCap className="w-4 h-4 mr-1" />
                        Estudiante
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="teacher"
                        name="userType"
                        checked={userForm.role === 'teacher'}
                        onChange={() => setUserForm(prev => ({ 
                          ...prev, 
                          role: 'teacher',
                          courseId: '',
                          sectionId: ''
                        }))}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="teacher" className="flex items-center cursor-pointer">
                        <Users className="w-4 h-4 mr-1" />
                        Profesor
                      </Label>
                    </div>
                  </div>
                )}

                {/* Auto-generate credentials toggle */}
                {!editingUser && (
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <Label htmlFor="autoGenerate" className="text-sm font-medium">
                        Generar credenciales automáticamente
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Se generarán usuario y contraseña basados en el nombre
                      </p>
                    </div>
                    <Switch
                      id="autoGenerate"
                      checked={autoGenerateCredentials}
                      onCheckedChange={setAutoGenerateCredentials}
                    />
                  </div>
                )}

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre Completo *</Label>
                    <Input
                      id="name"
                      value={userForm.name}
                      onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nombre completo del usuario"
                      className={validationErrors.name ? 'border-red-500' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="correo@ejemplo.com (opcional)"
                        className={`pl-10 ${validationErrors.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Nombre de Usuario *</Label>
                    <Input
                      id="username"
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="nombreusuario"
                      disabled={autoGenerateCredentials && !editingUser}
                      className={validationErrors.username ? 'border-red-500' : ''}
                    />
                    {validationErrors.username && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.username}</p>
                    )}
                  </div>

                  {/* Only show password fields when creating new user */}
                  {!editingUser && (
                    <div>
                      <Label htmlFor="password">Contraseña *</Label>
                      <div className="relative">
                        <Key className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={userForm.password}
                          onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Contraseña"
                          disabled={autoGenerateCredentials}
                          className={`pl-10 pr-10 ${validationErrors.password ? 'border-red-500' : ''}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      {validationErrors.password && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                      )}
                      {!autoGenerateCredentials && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Mínimo 4 caracteres
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Only show confirm password when creating new user */}
                {!editingUser && (
                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={userForm.confirmPassword}
                      onChange={(e) => setUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirmar contraseña"
                      disabled={autoGenerateCredentials}
                      className={validationErrors.confirmPassword ? 'border-red-500' : ''}
                    />
                    {validationErrors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
                    )}
                  </div>
                )}

                {/* Student-specific fields */}
                {userForm.role === 'student' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div>
                      <Label htmlFor="courseId">Curso *</Label>
                      <Select
                        value={userForm.courseId}
                        onValueChange={(value) => setUserForm(prev => ({ 
                          ...prev, 
                          courseId: value, 
                          sectionId: '' // Reset section when course changes
                        }))}
                      >
                        <SelectTrigger className={validationErrors.courseId ? 'border-red-500' : ''}>
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
                      {validationErrors.courseId && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.courseId}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sectionId">Sección *</Label>
                      <Select
                        value={userForm.sectionId}
                        onValueChange={(value) => setUserForm(prev => ({ ...prev, sectionId: value }))}
                        disabled={!userForm.courseId}
                      >
                        <SelectTrigger className={validationErrors.sectionId ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Selecciona una sección" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableSections().map(section => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name} ({section.studentCount}/{section.maxStudents || 'Sin límite'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.sectionId && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.sectionId}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Teacher-specific fields */}
                {userForm.role === 'teacher' && (
                  <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div>
                      <Label>Asignaturas que impartirá *</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Selecciona las asignaturas que el profesor podrá impartir (puede enseñar en cualquier curso/sección)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {getAllAvailableSubjects().map((subject: SubjectColor) => (
                          <Badge
                            key={subject.name}
                            className={`text-xs font-bold border-0 cursor-pointer px-2 py-1 transition-all duration-200 ${
                              selectedSubjects.includes(subject.name)
                                ? 'ring-2 ring-blue-500 ring-offset-2'
                                : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                            }`}
                            style={{
                              backgroundColor: subject.bgColor,
                              color: subject.textColor,
                              opacity: selectedSubjects.includes(subject.name) ? 1 : 0.7
                            }}
                            title={subject.name}
                            onClick={() => handleSubjectToggle(subject.name)}
                          >
                            {subject.abbreviation}
                          </Badge>
                        ))}
                      </div>
                      {selectedSubjects.length === 0 && (
                        <p className="text-red-500 text-xs mt-2">Selecciona al menos una asignatura</p>
                      )}
                      {validationErrors.subjects && (
                        <p className="text-red-500 text-xs mt-2">{validationErrors.subjects}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveUser}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowUserDialog(false)}
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <GraduationCap className="w-4 h-4 mr-2" />
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {students.filter(s => s.isActive).length} activos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Profesores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {teachers.filter(t => t.isActive).length} activos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length + teachers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              En el sistema
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cursos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {sections.length} secciones
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GraduationCap className="w-5 h-5 mr-2" />
            Estudiantes ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay estudiantes registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map(student => {
                const { courseName, sectionName } = getCourseAndSectionName(student);
                
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h4 className="font-medium">{student.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>@{student.username}</span>
                            <span>•</span>
                            <span>{student.email}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {student.uniqueCode}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {courseName} - {sectionName}
                            </Badge>
                            {!student.isActive && (
                              <Badge variant="destructive" className="text-xs">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(student)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(student)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Profesores ({teachers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay profesores registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teachers.map(teacher => {
                const teacherInfo = getTeacherCourseInfo(teacher);
                return (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">{teacher.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>@{teacher.username}</span>
                          <span>•</span>
                          <span>{teacher.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {teacher.uniqueCode}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {teacherInfo.courseName}
                          </Badge>
                          {!teacher.isActive && (
                            <Badge variant="destructive" className="text-xs">
                              Inactivo
                            </Badge>
                          )}
                        </div>
                        {/* Subject badges */}
                        {teacherInfo.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {teacherInfo.subjects.map(subjectName => {
                              const subjectColor = getAllAvailableSubjects()
                                .find(s => s.name === subjectName);
                              return (
                                <Badge
                                  key={subjectName}
                                  className="text-xs font-bold border-0 px-2 py-1"
                                  style={{
                                    backgroundColor: subjectColor?.bgColor || '#e5e7eb',
                                    color: subjectColor?.textColor || '#374151'
                                  }}
                                  title={subjectName}
                                >
                                  {subjectColor?.abbreviation || subjectName.substring(0, 3).toUpperCase()}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(teacher)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteUser(teacher)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
