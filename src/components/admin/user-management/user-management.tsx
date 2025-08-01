"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';
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
  EyeOff,
  Shield,
  Crown,
  CheckCircle,
  AlertTriangle
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
  const { translate } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [administrators, setAdministrators] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userType, setUserType] = useState<'student' | 'teacher' | 'admin'>('student');
  const [editingUser, setEditingUser] = useState<Student | Teacher | any | null>(null);
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

  // Listen for changes in teacher assignments to refresh data automatically
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'smart-student-teacher-assignments') {
        // Recargar datos cuando cambien las asignaciones
        loadData();
      }
    };

    // Agregar listener para cambios en localStorage
    window.addEventListener('storage', handleStorageChange);

    // También detectar cambios en el mismo tab usando un custom event
    const handleCustomStorageChange = () => {
      loadData();
    };

    window.addEventListener('teacherAssignmentsChanged', handleCustomStorageChange);
    window.addEventListener('studentAssignmentsChanged', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('teacherAssignmentsChanged', handleCustomStorageChange);
      window.removeEventListener('studentAssignmentsChanged', handleCustomStorageChange);
    };
  }, []);

  const loadData = () => {
    try {
      const studentsData = LocalStorageManager.getStudents();
      const teachersData = LocalStorageManager.getTeachers();
      const coursesData = LocalStorageManager.getCourses();
      const sectionsData = LocalStorageManager.getSections();
      
      // Load administrators from dedicated storage and main users array
      const adminsFromStorage = JSON.parse(localStorage.getItem('smart-student-administrators') || '[]');
      const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const adminsFromUsers = allUsers.filter((user: any) => user.role === 'admin');
      
      // Combine and deduplicate administrators
      const allAdmins = [...adminsFromStorage];
      adminsFromUsers.forEach((admin: any) => {
        if (!allAdmins.find(a => a.id === admin.id)) {
          allAdmins.push(admin);
        }
      });

      // Migrate administrators without uniqueCode
      const migratedAdmins = allAdmins.map(admin => {
        if (!admin.uniqueCode) {
          return {
            ...admin,
            uniqueCode: EducationCodeGenerator.generateAdminCode()
          };
        }
        return admin;
      });

      // Save migrated administrators back to storage
      if (migratedAdmins.some(admin => !allAdmins.find(a => a.id === admin.id && a.uniqueCode === admin.uniqueCode))) {
        localStorage.setItem('smart-student-administrators', JSON.stringify(migratedAdmins));
      }

      setStudents(studentsData);
      setTeachers(teachersData);
      setAdministrators(migratedAdmins);
      setCourses(coursesData);
      setSections(sectionsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: translate('userManagementError') || 'Error',
        description: translate('userManagementCouldNotLoadData') || 'Could not load data',
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
      errors.name = translate('userManagementNameRequired') || 'El nombre es requerido';
    } else if (!FormValidation.validateName(userForm.name)) {
      errors.name = translate('userManagementNameInvalid') || 'El nombre debe tener al menos 2 caracteres y solo letras';
    }

    // Username validation
    if (!userForm.username.trim()) {
      errors.username = translate('userManagementUsernameRequired') || 'El nombre de usuario es requerido';
    } else if (!FormValidation.validateUsername(userForm.username)) {
      errors.username = translate('userManagementUsernameInvalid') || 'El usuario debe tener 3-20 caracteres alfanuméricos';
    } else {
      // Check if username exists
      const allUsers = [...students, ...teachers, ...administrators];
      const existingUser = allUsers.find(u => 
        u.username === userForm.username && (!editingUser || u.id !== editingUser.id)
      );
      if (existingUser) {
        errors.username = translate('userManagementUsernameExists') || 'Este nombre de usuario ya existe';
      }
    }

    // Email validation (optional)
    if (userForm.email.trim()) {
      // Only validate format if email is provided
      if (!FormValidation.validateEmail(userForm.email)) {
        errors.email = translate('userManagementEmailInvalid') || 'El formato del email no es válido';
      } else {
        // Check if email exists
        const allUsers = [...students, ...teachers, ...administrators];
        const existingUser = allUsers.find(u => 
          u.email === userForm.email && (!editingUser || u.id !== editingUser.id)
        );
        if (existingUser) {
          errors.email = translate('userManagementEmailExists') || 'Este email ya está registrado';
        }
      }
    }

    // Password validation (only for new users)
    if (!editingUser) {
      if (!userForm.password) {
        errors.password = translate('userManagementPasswordRequired') || 'La contraseña es requerida';
      } else {
        const passwordValidation = FormValidation.validatePassword(userForm.password);
        if (!passwordValidation.isValid) {
          errors.password = passwordValidation.errors[0];
        }
      }

      if (userForm.password !== userForm.confirmPassword) {
        errors.confirmPassword = translate('userManagementPasswordsNoMatch') || 'Las contraseñas no coinciden';
      }
    }

    // Student-specific validations
    if (userForm.role === 'student') {
      if (!userForm.courseId) {
        errors.courseId = translate('userManagementCourseRequiredForStudents') || 'El curso es requerido para estudiantes';
      }
      if (!userForm.sectionId) {
        errors.sectionId = translate('userManagementSectionRequiredForStudents') || 'La sección es requerida para estudiantes';
      }
    }

    // Teacher-specific validations
    if (userForm.role === 'teacher') {
      if (selectedSubjects.length === 0) {
        errors.subjects = translate('userManagementSelectSubjectForTeacher') || 'Selecciona al menos una asignatura para el profesor';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle user creation/update
  const handleSaveUser = async () => {
    if (!validateForm()) {
      toast({
        title: translate('userManagementValidationError') || 'Validation error',
        description: translate('userManagementFixFormErrors') || 'Please fix the errors in the form',
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
        title: translate('userManagementError') || 'Error',
        description: translate('userManagementCouldNotSaveUser') || 'Could not save user',
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

      // Disparar evento para notificar cambios en estudiantes
      window.dispatchEvent(new CustomEvent('studentAssignmentsChanged'));

      // Update section student count
      const updatedSections = sections.map(s => 
        s.id === userForm.sectionId 
          ? { ...s, studentCount: s.studentCount + 1 }
          : s
      );
      setSections(updatedSections);
      LocalStorageManager.setSections(updatedSections);

    } else if (userForm.role === 'teacher') {
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
    } else if (userForm.role === 'admin') {
      const newAdmin = {
        ...baseUser,
        uniqueCode: EducationCodeGenerator.generateAdminCode(),
        role: 'admin',
        displayName: userForm.name.trim(),
        activeCourses: [], // Admin has access to all courses
        password: userForm.password
      };

      const updatedAdministrators = [...administrators, newAdmin];
      setAdministrators(updatedAdministrators);
      localStorage.setItem('smart-student-administrators', JSON.stringify(updatedAdministrators));
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
      title: translate('userManagementSuccess') || 'Success',
      description: `${
        userForm.role === 'student' ? translate('userManagementStudent') || 'Student' : 
        userForm.role === 'teacher' ? translate('userManagementTeacher') || 'Teacher' : 
        translate('userManagementAdministrator') || 'Administrator'
      } ${translate('userManagementCreatedSuccessfully') || 'created successfully'}`,
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
        const recalculateResult = EducationAutomation.recalculateSectionCounts(translate);
        if (recalculateResult.success) {
          // Reload sections with updated counts
          const updatedSections = LocalStorageManager.getSections();
          setSections(updatedSections);
        }

        // Disparar evento para notificar cambios en estudiantes
        window.dispatchEvent(new CustomEvent('studentAssignmentsChanged'));
      } else {
        // If no section change, just update the student
        const updatedStudents = students.map(s => 
          s.id === editingUser.id ? studentData : s
        );
        setStudents(updatedStudents);
        LocalStorageManager.setStudents(updatedStudents);

        // Disparar evento para notificar cambios en estudiantes
        window.dispatchEvent(new CustomEvent('studentAssignmentsChanged'));
      }
    } else if (editingUser.role === 'teacher') {
      // Update teacher data
      const teacherData = updatedUserData as Teacher;
      teacherData.preferredCourseId = userForm.courseId;
      teacherData.selectedSubjects = [...selectedSubjects];
      
      const updatedTeachers = teachers.map(t => 
        t.id === editingUser.id ? teacherData : t
      );
      setTeachers(updatedTeachers);
      LocalStorageManager.setTeachers(updatedTeachers);
    } else if (editingUser.role === 'admin') {
      // Update administrator data
      const adminData = {
        ...updatedUserData,
        displayName: userForm.name.trim()
      };
      
      const updatedAdministrators = administrators.map(a => 
        a.id === editingUser.id ? adminData : a
      );
      setAdministrators(updatedAdministrators);
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
      title: translate('userManagementSuccess') || 'Success',
      description: translate('userManagementUserUpdatedSuccessfully') || 'User updated successfully',
      variant: 'default'
    });
  };

  const handleDeleteUser = (user: Student | Teacher | any) => {
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

        // Disparar evento para notificar cambios en estudiantes
        window.dispatchEvent(new CustomEvent('studentAssignmentsChanged'));
      } else if (user.role === 'teacher') {
        const updatedTeachers = teachers.filter(t => t.id !== user.id);
        setTeachers(updatedTeachers);
        LocalStorageManager.setTeachers(updatedTeachers);
      } else if (user.role === 'admin') {
        const updatedAdministrators = administrators.filter(a => a.id !== user.id);
        setAdministrators(updatedAdministrators);
      }

      // Remove from main users array
      const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const updatedAllUsers = allUsers.filter((u: any) => u.username !== user.username);
      localStorage.setItem('smart-student-users', JSON.stringify(updatedAllUsers));

      toast({
        title: translate('userManagementSuccess') || 'Success',
        description: translate('userManagementUserDeletedSuccessfully') || 'User deleted successfully',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('userManagementError') || 'Error',
        description: translate('userManagementCouldNotDeleteUser') || 'Could not delete user',
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

  const openEditDialog = (user: Student | Teacher | any) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      name: user.name || user.displayName,
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
    // Obtener asignaciones de la pestaña Asignaciones
    const teacherAssignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
    const teacherAssignmentsList = teacherAssignments.filter((assignment: any) => assignment.teacherId === teacher.id);
    
    if (teacherAssignmentsList.length > 0) {
      // Obtener información de las secciones asignadas agrupadas por sección
      const sectionAssignments = teacherAssignmentsList.reduce((acc: any, assignment: any) => {
        const section = sections.find(s => s.id === assignment.sectionId);
        const course = section ? courses.find(c => c.id === section.courseId) : null;
        
        if (section && course) {
          const sectionKey = `${course.name} - ${section.name}`;
          if (!acc[sectionKey]) {
            acc[sectionKey] = {
              courseName: course.name,
              sectionName: section.name,
              subjects: []
            };
          }
          acc[sectionKey].subjects.push(assignment.subjectName);
        }
        return acc;
      }, {});
      
      const assignedSectionNames = Object.keys(sectionAssignments);
      
      return {
        courseName: assignedSectionNames.length > 0 
          ? assignedSectionNames.join(', ')
          : (translate('userManagementNoSectionAssigned') || 'Sin sección asignada'),
        courseLevel: null,
        subjects: teacher.selectedSubjects || [],
        assignments: sectionAssignments,
        hasAssignments: assignedSectionNames.length > 0
      };
    }
    
    // Fallback a la implementación anterior si no hay asignaciones
    const course = courses.find(c => c.id === teacher.preferredCourseId);
    return {
      courseName: course?.name || (translate('userManagementNoCourseAssigned') || 'Sin curso asignado'),
      courseLevel: course?.level || null,
      subjects: teacher.selectedSubjects || [],
      assignments: {},
      hasAssignments: false
    };
  };

  // Function to get role badge colors (matching configuration)
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'teacher': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'student': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Function to get role icons
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-3 h-3 mr-1" />;
      case 'teacher': return <Shield className="w-3 h-3 mr-1" />;
      case 'student': return <GraduationCap className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Users className="w-6 h-6 mr-2 text-blue-500" />
            {translate('userManagementMainTitle') || 'Gestión de Usuarios'}
          </h2>
          <p className="text-muted-foreground">
            {translate('userManagementCreateAndManage') || 'Crea y administra estudiantes y profesores'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  resetForm();
                  setUserForm(prev => ({ ...prev, role: 'student' })); // Default to student
                }}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {translate('userManagementNewUser') || 'Nuevo Usuario'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 
                    (translate('userManagementEditUser') || 'Editar Usuario') : 
                    (translate('userManagementCreateNewUser') || 'Crear Nuevo Usuario')
                  }
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
                        {translate('userManagementStudent') || 'Estudiante'}
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
                        <Shield className="w-4 h-4 mr-1" />
                        {translate('userManagementTeacher') || 'Profesor'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="admin"
                        name="userType"
                        checked={userForm.role === 'admin'}
                        onChange={() => setUserForm(prev => ({ 
                          ...prev, 
                          role: 'admin',
                          courseId: '',
                          sectionId: ''
                        }))}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="admin" className="flex items-center cursor-pointer">
                        <Crown className="w-4 h-4 mr-1" />
                        {translate('userManagementAdministrator') || 'Administrador'}
                      </Label>
                    </div>
                  </div>
                )}

                {/* Auto-generate credentials toggle */}
                {!editingUser && (
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <Label htmlFor="autoGenerate" className="text-sm font-medium">
                        {translate('userManagementAutoGenerateCredentials') || 'Generar credenciales automáticamente'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {translate('userManagementAutoGenerateCredentialsDesc') || 'Se generarán usuario y contraseña basados en el nombre'}
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
                    <Label htmlFor="name">{translate('userManagementFullName') || 'Nombre Completo'} *</Label>
                    <Input
                      id="name"
                      value={userForm.name}
                      onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={translate('userManagementFullNamePlaceholder') || 'Nombre completo del usuario'}
                      className={validationErrors.name ? 'border-red-500' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">{translate('userManagementEmail') || 'Email'}</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder={translate('userManagementEmailPlaceholder') || 'correo@ejemplo.com (opcional)'}
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
                    <Label htmlFor="username">{translate('userManagementUsername') || 'Nombre de Usuario'} *</Label>
                    <Input
                      id="username"
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder={translate('userManagementUsernamePlaceholder') || 'Ingresa el nombre de usuario'}
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
                      <Label htmlFor="password">{translate('userManagementPassword') || 'Contraseña'} *</Label>
                      <div className="relative">
                        <Key className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={userForm.password}
                          onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                          placeholder={translate('userManagementPasswordPlaceholder') || 'Contraseña'}
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
                          {translate('userManagementPasswordMinChars') || 'Mínimo 4 caracteres'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Only show confirm password when creating new user */}
                {!editingUser && (
                  <div>
                    <Label htmlFor="confirmPassword">{translate('userManagementConfirmPassword') || 'Confirmar Contraseña'} *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={userForm.confirmPassword}
                      onChange={(e) => setUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={translate('userManagementConfirmPasswordPlaceholder') || 'Confirmar contraseña'}
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
                      <Label htmlFor="courseId">{translate('userManagementCourse') || 'Curso'} *</Label>
                      <Select
                        value={userForm.courseId}
                        onValueChange={(value) => setUserForm(prev => ({ 
                          ...prev, 
                          courseId: value, 
                          sectionId: '' // Reset section when course changes
                        }))}
                      >
                        <SelectTrigger className={validationErrors.courseId ? 'border-red-500' : ''}>
                          <SelectValue placeholder={translate('userManagementSelectCourse') || 'Selecciona un curso'} />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map(course => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.courseId && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.courseId}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sectionId">{translate('userManagementSection') || 'Sección'} *</Label>
                      <Select
                        value={userForm.sectionId}
                        onValueChange={(value) => setUserForm(prev => ({ ...prev, sectionId: value }))}
                        disabled={!userForm.courseId}
                      >
                        <SelectTrigger className={validationErrors.sectionId ? 'border-red-500' : ''}>
                          <SelectValue placeholder={translate('userManagementSelectSection') || 'Selecciona una sección'} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableSections().map(section => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name} ({section.studentCount}/{section.maxStudents || translate('userManagementNoLimit') || 'Sin límite'})
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
                      <Label>{translate('userManagementSubjectsTeacherWillTeach') || 'Asignaturas que impartirá *'}</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        {translate('userManagementSelectSubjectsTeacher') || 'Selecciona las asignaturas que el profesor podrá impartir (puede enseñar en cualquier curso/sección)'}
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
                        <p className="text-red-500 text-xs mt-2">{translate('userManagementSelectAtLeastOneSubject') || 'Selecciona al menos una asignatura'}</p>
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
                    {editingUser ? 
                      (translate('userManagementUpdateUser') || 'Actualizar Usuario') : 
                      (translate('userManagementCreateUser') || 'Crear Usuario')
                    }
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
              {translate('userManagementStudents') || 'Estudiantes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {students.filter(s => s.isActive).length} {translate('userManagementActive') || 'activos'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2" />
              {translate('userManagementTeachers') || 'Profesores'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {teachers.filter(t => t.isActive).length} {translate('userManagementActive') || 'activos'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              {translate('userManagementAdministrators') || 'Administradores'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{administrators.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {administrators.filter(a => a.isActive !== false).length} {translate('userManagementActive') || 'activos'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {translate('userManagementTotalUsers') || 'Total Usuarios'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length + teachers.length + administrators.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {translate('userManagementInTheSystem') || 'En el sistema'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GraduationCap className="w-5 h-5 mr-2" />
            {translate('userManagementStudents') || 'Estudiantes'} ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{translate('userManagementNoStudentsRegistered') || 'No hay estudiantes registrados'}</p>
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
                            <Badge className={`text-xs ${getRoleColor('student')}`}>
                              {getRoleIcon('student')}
                              {translate('userManagementStudent') || 'Estudiante'}
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
            {translate('userManagementTeachers') || 'Profesores'} ({teachers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{translate('userManagementNoTeachersRegistered') || 'No hay profesores registrados'}</p>
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
                          <Badge className={`text-xs ${getRoleColor('teacher')}`}>
                            {getRoleIcon('teacher')}
                            {translate('userManagementTeacher') || 'Profesor'}
                          </Badge>
                          {teacherInfo.hasAssignments ? (
                            <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Asignado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              No asignado
                            </Badge>
                          )}
                          {!teacher.isActive && (
                            <Badge variant="destructive" className="text-xs">
                              Inactivo
                            </Badge>
                          )}
                        </div>
                        
                        {/* Mostrar asignaciones específicas si las hay */}
                        {teacherInfo.hasAssignments && (
                          <div className="mt-2 space-y-2">
                            {Object.entries(teacherInfo.assignments).map(([sectionKey, info]: [string, any]) => (
                              <div key={sectionKey} className="flex flex-wrap items-center gap-2">
                                {/* Badge del curso y sección */}
                                <Badge variant="outline" className="text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                                  {info.courseName} - {info.sectionName}
                                </Badge>
                                
                                {/* Badges de las asignaturas */}
                                <div className="flex flex-wrap gap-1">
                                  {info.subjects.map((subjectName: string) => {
                                    const subjectColor = getAllAvailableSubjects()
                                      .find(s => s.name === subjectName);
                                    return (
                                      <Badge
                                        key={`${sectionKey}-${subjectName}`}
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
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Subject badges */}
                        {teacherInfo.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-xs text-muted-foreground mr-1">Capacitado en:</span>
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

      {/* Administrators Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {translate('userManagementAdministrators') || 'Administradores'} ({administrators.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {administrators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{translate('userManagementNoAdministratorsRegistered') || 'No hay administradores registrados'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {administrators.map(admin => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">{admin.name || admin.displayName}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>@{admin.username}</span>
                          <span>•</span>
                          <span>{admin.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {admin.uniqueCode && (
                            <Badge variant="outline" className="text-xs">
                              {admin.uniqueCode}
                            </Badge>
                          )}
                          <Badge className={`text-xs ${getRoleColor('admin')}`}>
                            {getRoleIcon('admin')}
                            {translate('userManagementAdministrator') || 'Administrador'}
                          </Badge>
                          {admin.isActive === false && (
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
                      onClick={() => openEditDialog(admin)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteUser(admin)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
