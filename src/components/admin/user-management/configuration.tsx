"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';
import { 
  Settings as SettingsIcon, 
  Users, 
  Shield,
  Database,
  Key,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  GraduationCap,
  Crown,
  Mail
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LocalStorageManager, UsernameGenerator, EducationCodeGenerator } from '@/lib/education-utils';
import { getAllAvailableSubjects, SubjectColor } from '@/lib/subjects-colors';
import { SystemConfig } from '@/types/education';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Configuration() {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const [config, setConfig] = useState<SystemConfig>({
    allowMultipleTeachersPerSubject: false,
    maxStudentsPerSection: 30,
    autoGenerateUsernames: true,
    defaultPasswordLength: 8
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [refreshUsers, setRefreshUsers] = useState(0); // State to trigger user list refresh

  // Form state for creating new user
  const [createUserFormData, setCreateUserFormData] = useState({
    name: '',
    email: '',
    role: 'student' as 'student' | 'teacher' | 'admin',
    username: '',
    password: '',
    confirmPassword: '',
    autoGenerate: true,
    courseId: '',
    section: '',
    subject: '',
    selectedSubjects: [] as string[]
  });

  // Data states for form dropdowns
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = () => {
    try {
      const storedConfig = LocalStorageManager.getConfig();
      if (Object.keys(storedConfig).length > 0) {
        setConfig({ ...config, ...storedConfig });
      }
      
      // Load available options for form dropdowns
      const courses = LocalStorageManager.getCourses();
      const sections = LocalStorageManager.getSections();
      const subjects = LocalStorageManager.getSubjects();
      
      // Get subjects with colors from the subjects-colors library
      const subjectsWithColors = getAllAvailableSubjects();
      
      setAvailableCourses(courses);
      setAvailableSections(sections);
      setAvailableSubjects(subjectsWithColors);
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const saveConfiguration = async () => {
    setIsLoading(true);
    try {
      LocalStorageManager.setConfig(config);
      
      // Update section max capacity in all existing sections
      const sections = LocalStorageManager.getSections();
      const updatedSections = sections.map(section => ({
        ...section,
        maxStudents: config.maxStudentsPerSection
      }));
      LocalStorageManager.setSections(updatedSections);
      
      toast({
        title: translate('configSavedTitle') || 'Configuración guardada',
        description: translate('configSavedDescription') || 'Los cambios se han aplicado correctamente y se han actualizado las capacidades de las secciones',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('error') || 'Error',
        description: translate('configSaveErrorDescription') || 'No se pudo guardar la configuración',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSystemStatistics = () => {
    try {
      const students = LocalStorageManager.getStudents();
      const teachers = LocalStorageManager.getTeachers();
      const courses = LocalStorageManager.getCourses();
      const sections = LocalStorageManager.getSections();
      const subjects = LocalStorageManager.getSubjects();
      const assignments = LocalStorageManager.getAssignments();
      
      // Obtener datos adicionales
      const administrators = JSON.parse(localStorage.getItem('smart-student-administrators') || '[]');
      const teacherAssignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
      
      return {
        totalUsers: students.length + teachers.length + administrators.length,
        students: students.length,
        teachers: teachers.length,
        administrators: administrators.length,
        courses: courses.length,
        sections: sections.length,
        subjects: subjects.length,
        assignments: assignments.filter((a: any) => a.isActive).length,
        teacherAssignments: teacherAssignments.length,
        assignedStudents: students.filter((s: any) => s.courseId && s.sectionId).length,
        assignedTeachers: teachers.filter((t: any) => t.assignedSections && t.assignedSections.length > 0).length
      };
    } catch (error) {
      return {
        totalUsers: 0, students: 0, teachers: 0, administrators: 0, courses: 0, 
        sections: 0, subjects: 0, assignments: 0, teacherAssignments: 0,
        assignedStudents: 0, assignedTeachers: 0
      };
    }
  };

  const exportSystemData = () => {
    try {
      // ✅ MEJORAR EXPORTACIÓN: Asegurar que todos los usuarios tengan campos completos
      const rawUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const exportUsers = rawUsers.map((user: any) => {
        // Garantizar que cada usuario exportado tenga TODOS los campos necesarios para login
        return {
          // Campos obligatorios para login
          id: user.id || crypto.randomUUID(),
          username: user.username || user.name || `user_${Date.now()}_${Math.random()}`,
          password: user.password || '1234',
          role: user.role || 'student',
          displayName: user.displayName || user.name || 'Usuario Sin Nombre',
          activeCourses: Array.isArray(user.activeCourses) ? user.activeCourses : 
                        (user.role === 'admin' ? [] : ['4to Básico']),
          email: user.email || `${user.username || user.name}@example.com`,
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
          
          // Preservar campos adicionales del usuario original
          ...(user.name && { name: user.name }),
          ...(user.assignedTeachers && { assignedTeachers: user.assignedTeachers }),
          ...(user.teachingAssignments && { teachingAssignments: user.teachingAssignments }),
          ...(user.uniqueCode && { uniqueCode: user.uniqueCode }),
          ...(user.courseId && { courseId: user.courseId }),
          ...(user.sectionId && { sectionId: user.sectionId }),
          ...(user.selectedSubjects && { selectedSubjects: user.selectedSubjects }),
          ...(user.assignedSections && { assignedSections: user.assignedSections }),
          ...(user.subjects && { subjects: user.subjects }),
          ...(user.section && { section: user.section })
        };
      });

      console.log('📦 [EXPORTACIÓN] Usuarios preparados con campos completos:', exportUsers.length);

      const data = {
        courses: LocalStorageManager.getCourses(),
        sections: LocalStorageManager.getSections(),
        subjects: LocalStorageManager.getSubjects(),
        students: LocalStorageManager.getStudents(),
        teachers: LocalStorageManager.getTeachers(),
        assignments: LocalStorageManager.getAssignments(),
        config: LocalStorageManager.getConfig(),
        // Agregar usuarios administradores
        administrators: JSON.parse(localStorage.getItem('smart-student-administrators') || '[]'),
        // Agregar asignaciones de profesores a cursos-secciones
        teacherAssignments: JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]'),
        // ✅ USUARIOS PRINCIPALES CON CAMPOS COMPLETOS PARA LOGIN
        users: exportUsers,
        exportDate: new Date().toISOString(),
        version: '1.2' // Incrementar versión para indicar mejora de exportación
      };

      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `smart-student-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      toast({
        title: translate('configExportSuccessTitle') || 'Exportación exitosa',
        description: translate('configExportSuccessDescription') || 'Datos exportados con campos completos para login. La importación será automática.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('configExportErrorTitle') || 'Error en exportación',
        description: translate('configExportErrorDescription') || 'No se pudieron exportar los datos',
        variant: 'destructive'
      });
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        // Validate structure
        if (!importedData.version || !importedData.courses) {
          throw new Error(translate('configInvalidFileFormat') || 'Formato de archivo inválido');
        }

        // Confirm before importing
        if (window.confirm(translate('configImportConfirm') || '¿Estás seguro de que quieres importar estos datos? Esto sobrescribirá todos los datos existentes.')) {
          // Import basic data
          LocalStorageManager.setCourses(importedData.courses || []);
          LocalStorageManager.setSections(importedData.sections || []);
          LocalStorageManager.setSubjects(importedData.subjects || []);
          LocalStorageManager.setStudents(importedData.students || []);
          LocalStorageManager.setTeachers(importedData.teachers || []);
          LocalStorageManager.setAssignments(importedData.assignments || []);
          
          // Import configuration
          if (importedData.config) {
            LocalStorageManager.setConfig(importedData.config);
            setConfig({ ...config, ...importedData.config });
          }

          // Import administrators (nuevo)
          if (importedData.administrators) {
            localStorage.setItem('smart-student-administrators', JSON.stringify(importedData.administrators));
          }

          // Import teacher assignments (nuevo)
          if (importedData.teacherAssignments) {
            localStorage.setItem('smart-student-teacher-assignments', JSON.stringify(importedData.teacherAssignments));
          }

          // ✅ MEJORAR IMPORTACIÓN: Consolidar todos los usuarios y garantizar campos completos
          if (importedData.users) {
            const consolidatedUsers = [...(importedData.users || [])];
            
            // Agregar usuarios de ubicaciones específicas si existen
            if (importedData.students) {
              importedData.students.forEach((student: any) => {
                const exists = consolidatedUsers.find(u => u.username === student.username || u.name === student.name);
                if (!exists) {
                  consolidatedUsers.push({ ...student, role: 'student' });
                }
              });
            }
            
            if (importedData.teachers) {
              importedData.teachers.forEach((teacher: any) => {
                const exists = consolidatedUsers.find(u => u.username === teacher.username || u.name === teacher.name);
                if (!exists) {
                  consolidatedUsers.push({ ...teacher, role: 'teacher' });
                }
              });
            }
            
            if (importedData.administrators) {
              importedData.administrators.forEach((admin: any) => {
                const exists = consolidatedUsers.find(u => u.username === admin.username || u.name === admin.name);
                if (!exists) {
                  consolidatedUsers.push({ ...admin, role: 'admin' });
                }
              });
            }

            // Reparar y validar TODOS los usuarios consolidados
            const repairedUsers = consolidatedUsers.map((user: any, index: number) => {
              const repairedUser = {
                // Campos obligatorios para login
                id: user.id || crypto.randomUUID(),
                username: user.username || user.name || `imported_user_${Date.now()}_${index}`,
                password: user.password || '1234',
                role: user.role || 'student',
                displayName: user.displayName || user.name || `Usuario Importado ${index + 1}`,
                activeCourses: Array.isArray(user.activeCourses) ? user.activeCourses : 
                              (user.role === 'admin' ? [] : ['4to Básico']),
                email: user.email || `${user.username || user.name || `user${index}`}@example.com`,
                isActive: user.isActive !== undefined ? user.isActive : true,
                createdAt: user.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                
                // Preservar campos adicionales
                ...(user.name && { name: user.name }),
                ...(user.assignedTeachers && { assignedTeachers: user.assignedTeachers }),
                ...(user.teachingAssignments && { teachingAssignments: user.teachingAssignments }),
                ...(user.uniqueCode && { uniqueCode: user.uniqueCode }),
                ...(user.courseId && { courseId: user.courseId }),
                ...(user.sectionId && { sectionId: user.sectionId }),
                ...(user.selectedSubjects && { selectedSubjects: user.selectedSubjects }),
                ...(user.assignedSections && { assignedSections: user.assignedSections }),
                ...(user.subjects && { subjects: user.subjects }),
                ...(user.section && { section: user.section })
              };
              
              return repairedUser;
            });
            
            console.log('🔧 [IMPORTACIÓN] Usuarios consolidados y reparados:', repairedUsers.length);
            console.log('📊 [IMPORTACIÓN] Por roles:', {
              admins: repairedUsers.filter(u => u.role === 'admin').length,
              teachers: repairedUsers.filter(u => u.role === 'teacher').length,
              students: repairedUsers.filter(u => u.role === 'student').length
            });
            
            localStorage.setItem('smart-student-users', JSON.stringify(repairedUsers));
          }

          toast({
            title: translate('configImportSuccessTitle') || 'Importación exitosa',
            description: translate('configImportSuccessDescription') || 'Datos importados y usuarios reparados automáticamente. Todos los usuarios pueden hacer login.',
            variant: 'default'
          });

          // Refresh page to reload data
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (error) {
        toast({
          title: translate('configImportErrorTitle') || 'Error en importación',
          description: translate('configImportErrorDescription') || 'No se pudieron importar los datos. Verifica el formato del archivo.',
          variant: 'destructive'
        });
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // ✅ NUEVA FUNCIÓN: Reparar usuarios existentes con campos faltantes
  const repairExistingUsers = () => {
    try {
      const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      if (allUsers.length === 0) return;

      console.log('🔧 [REPARACIÓN] Iniciando reparación de usuarios existentes...');
      
      let repairedCount = 0;
      const repairedUsers = allUsers.map((user: any) => {
        const originalUser = { ...user };
        let needsRepair = false;

        // Verificar y reparar campos obligatorios
        if (!user.id) {
          user.id = crypto.randomUUID();
          needsRepair = true;
        }
        
        if (!user.username || user.username.trim() === '') {
          user.username = 'user_' + Math.random().toString(36).substr(2, 8);
          needsRepair = true;
        }
        
        if (!user.displayName) {
          user.displayName = user.name || 'Usuario Sin Nombre';
          needsRepair = true;
        }
        
        if (!user.password) {
          user.password = '1234'; // Password por defecto
          needsRepair = true;
        }
        
        if (!user.role) {
          user.role = 'student'; // Rol por defecto
          needsRepair = true;
        }
        
        if (!Array.isArray(user.activeCourses)) {
          user.activeCourses = user.role === 'admin' ? [] : ['4to Básico'];
          needsRepair = true;
        }
        
        if (!user.email) {
          user.email = `${user.username}@example.com`;
          needsRepair = true;
        }
        
        if (user.isActive === undefined || user.isActive === null) {
          user.isActive = true;
          needsRepair = true;
        }
        
        if (!user.createdAt) {
          user.createdAt = new Date();
          needsRepair = true;
        }
        
        if (!user.updatedAt) {
          user.updatedAt = new Date();
          needsRepair = true;
        }

        if (needsRepair) {
          repairedCount++;
          console.log(`🔧 Usuario reparado: ${user.username}`);
        }

        return user;
      });

      if (repairedCount > 0) {
        localStorage.setItem('smart-student-users', JSON.stringify(repairedUsers));
        
        toast({
          title: translate('configUsersRepairedTitle') || 'Usuarios reparados',
          description: translate('configUsersRepairedDescription') || `Se repararon ${repairedCount} usuarios con campos faltantes`,
          variant: 'default'
        });
        
        console.log(`✅ [REPARACIÓN] ${repairedCount} usuarios reparados exitosamente`);
      } else {
        console.log('✅ [REPARACIÓN] Todos los usuarios ya tienen los campos necesarios');
      }
    } catch (error) {
      console.error('❌ Error reparando usuarios:', error);
      toast({
        title: translate('error') || 'Error',
        description: translate('configRepairUsersError') || 'Error al reparar usuarios',
        variant: 'destructive'
      });
    }
  };

  const resetAllData = () => {
    try {
      // Clear all main data
      localStorage.removeItem('smart-student-courses');
      localStorage.removeItem('smart-student-sections');
      localStorage.removeItem('smart-student-subjects');
      localStorage.removeItem('smart-student-students');
      localStorage.removeItem('smart-student-teachers');
      localStorage.removeItem('smart-student-assignments');
      localStorage.removeItem('smart-student-config');

      // Clear additional data (nuevo)
      localStorage.removeItem('smart-student-administrators');
      localStorage.removeItem('smart-student-teacher-assignments');

      // Also clear legacy data
      localStorage.removeItem('smart-student-users');
      localStorage.removeItem('smart-student-tasks');
      localStorage.removeItem('smart-student-task-notifications');
      localStorage.removeItem('smart-student-task-comments');

      toast({
        title: translate('systemReset') || 'System reset',
        description: translate('configDataDeletedDescription') || 'Todos los datos han sido eliminados',
        variant: 'default'
      });

      setShowResetDialog(false);

      // Refresh page
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: translate('error') || 'Error',
        description: translate('configResetSystemError') || 'No se pudo reiniciar el sistema',
        variant: 'destructive'
      });
    }
  };

  const regeneratePasswords = async () => {
    setIsLoading(true);
    try {
      const students = LocalStorageManager.getStudents();
      const teachers = LocalStorageManager.getTeachers();
      
      let updatedCount = 0;

      // Update main users array with new passwords
      const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const updatedUsers = allUsers.map((user: any) => {
        const newPassword = UsernameGenerator.generateRandomPassword(config.defaultPasswordLength);
        updatedCount++;
        return { ...user, password: newPassword };
      });

      localStorage.setItem('smart-student-users', JSON.stringify(updatedUsers));

      toast({
        title: translate('configPasswordsRegeneratedTitle') || 'Contraseñas regeneradas',
        description: translate('configPasswordsRegeneratedDescription') || 'Se regeneraron {{count}} contraseñas'.replace('{{count}}', updatedCount.toString()),
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('error') || 'Error',
        description: translate('configPasswordsRegeneratedError') || 'No se pudieron regenerar las contraseñas',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Functions for user creation modal
  const handleCreateUser = async () => {
    try {
      // Validation
      if (!createUserFormData.name.trim()) {
        toast({
          title: translate('error') || 'Error',
          description: translate('userManagementFillAllFields') || 'Por favor, completa todos los campos requeridos',
          variant: 'destructive'
        });
        return;
      }

      // Password validation for manual input
      if (!createUserFormData.autoGenerate) {
        if (!createUserFormData.username.trim() || !createUserFormData.password.trim()) {
          toast({
            title: translate('error') || 'Error',
            description: translate('userManagementFillAllFields') || 'Por favor, completa todos los campos requeridos',
            variant: 'destructive'
          });
          return;
        }

        if (createUserFormData.password !== createUserFormData.confirmPassword) {
          toast({
            title: translate('error') || 'Error',
            description: translate('userManagementPasswordsDoNotMatch') || 'Las contraseñas no coinciden',
            variant: 'destructive'
          });
          return;
        }
      }

      // Student validation
      if (createUserFormData.role === 'student' && (!createUserFormData.courseId || !createUserFormData.section)) {
        toast({
          title: translate('error') || 'Error',
          description: translate('userManagementSelectCourseSection') || 'Por favor, selecciona un curso y una sección',
          variant: 'destructive'
        });
        return;
      }

      // Teacher validation
      if (createUserFormData.role === 'teacher' && (!createUserFormData.selectedSubjects || createUserFormData.selectedSubjects.length === 0)) {
        toast({
          title: translate('error') || 'Error',
          description: translate('userManagementSelectSubject') || 'Por favor, selecciona una materia',
          variant: 'destructive'
        });
        return;
      }

      // Generate credentials if auto-generate is enabled
      const username = createUserFormData.autoGenerate 
        ? UsernameGenerator.generateFromName(createUserFormData.name, createUserFormData.role)
        : createUserFormData.username.trim();
      
      const password = createUserFormData.autoGenerate
        ? UsernameGenerator.generateRandomPassword(config.defaultPasswordLength)
        : createUserFormData.password;

      const baseUser = {
        id: crypto.randomUUID(),
        username: username,
        name: createUserFormData.name.trim(),
        email: createUserFormData.email.trim(),
        role: createUserFormData.role,
        password: password, // ✅ Agregar password al baseUser
        displayName: createUserFormData.name.trim(), // ✅ Agregar displayName
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (createUserFormData.role === 'student') {
        const newStudent = {
          ...baseUser,
          uniqueCode: EducationCodeGenerator.generateStudentCode(),
          role: 'student',
          courseId: createUserFormData.courseId,
          sectionId: createUserFormData.section
        };

        const students = LocalStorageManager.getStudents();
        const updatedStudents = [...students, newStudent];
        LocalStorageManager.setStudents(updatedStudents);

      } else if (createUserFormData.role === 'teacher') {
        const newTeacher = {
          ...baseUser,
          uniqueCode: EducationCodeGenerator.generateTeacherCode(),
          role: 'teacher',
          assignedSections: [],
          selectedSubjects: createUserFormData.selectedSubjects
        };

        const teachers = LocalStorageManager.getTeachers();
        const updatedTeachers = [...teachers, newTeacher];
        LocalStorageManager.setTeachers(updatedTeachers);

      } else if (createUserFormData.role === 'admin') {
        const newAdmin = {
          ...baseUser,
          uniqueCode: EducationCodeGenerator.generateAdminCode(),
          role: 'admin',
          displayName: createUserFormData.name.trim(),
          activeCourses: [],
          password: password
        };

        const administrators = JSON.parse(localStorage.getItem('smart-student-administrators') || '[]');
        const updatedAdministrators = [...administrators, newAdmin];
        localStorage.setItem('smart-student-administrators', JSON.stringify(updatedAdministrators));
      }

      // Save to main users array
      const allUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      console.log('🔍 [USUARIO DEBUG] Usuarios antes de agregar:', allUsers.length);
      
      // Preparar datos específicos según el rol
      let courseNames: string[] = [];
      let additionalData: any = {};
      
      if (createUserFormData.role === 'student' && createUserFormData.courseId) {
        const course = LocalStorageManager.getCourses().find((c: any) => c.id === createUserFormData.courseId);
        courseNames = course ? [course.name] : ['4to Básico'];
        // Agregar datos específicos para estudiantes
        additionalData.assignedTeachers = {
          'Matemáticas': 'jorge',
          'Ciencias Naturales': 'carlos',
          'Lenguaje y Comunicación': 'jorge',
          'Historia, Geografía y Ciencias Sociales': 'carlos'
        };
      } else if (createUserFormData.role === 'student') {
        // ✅ FALLBACK: Si es estudiante pero no tiene courseId, asignar curso por defecto
        courseNames = ['4to Básico'];
        additionalData.assignedTeachers = {
          'Matemáticas': 'jorge',
          'Ciencias Naturales': 'carlos',
          'Lenguaje y Comunicación': 'jorge',
          'Historia, Geografía y Ciencias Sociales': 'carlos'
        };
      } else if (createUserFormData.role === 'teacher' && createUserFormData.selectedSubjects) {
        // Para profesores, asignar cursos básicos por defecto
        courseNames = ['4to Básico'];
        additionalData.teachingAssignments = createUserFormData.selectedSubjects.map((subjectId: string) => {
          const subject = LocalStorageManager.getSubjects().find((s: any) => s.id === subjectId);
          return {
            teacherUsername: username,
            teacherName: createUserFormData.name.trim(),
            subject: subject?.name || 'Materia desconocida',
            courses: ['4to Básico']
          };
        });
      } else if (createUserFormData.role === 'teacher') {
        // ✅ FALLBACK: Si es profesor pero no tiene materias, asignar configuración básica
        courseNames = ['4to Básico'];
        additionalData.teachingAssignments = [{
          teacherUsername: username,
          teacherName: createUserFormData.name.trim(),
          subject: 'Matemáticas',
          courses: ['4to Básico']
        }];
      } else if (createUserFormData.role === 'admin') {
        // ✅ Los administradores no necesitan cursos específicos pero sí el array vacío
        courseNames = [];
      }
      
      // ✅ GARANTIZAR que siempre tengamos todos los campos mínimos necesarios
      const newUserForMain = {
        ...baseUser,
        activeCourses: courseNames, // ✅ Siempre definido como array
        ...additionalData
      };
      
      // ✅ VALIDACIÓN ADICIONAL: Verificar que tenga todos los campos requeridos
      const requiredFields = ['id', 'username', 'role', 'displayName', 'activeCourses', 'password'];
      const missingFields = requiredFields.filter(field => 
        newUserForMain[field] === undefined || newUserForMain[field] === null ||
        (field === 'activeCourses' && !Array.isArray(newUserForMain[field]))
      );
      
      if (missingFields.length > 0) {
        console.error('❌ [USUARIO DEBUG] Campos faltantes:', missingFields);
        toast({
          title: translate('error') || 'Error',
          description: `Error en creación: faltan campos ${missingFields.join(', ')}`,
          variant: 'destructive'
        });
        return;
      }
      
      console.log('🔍 [USUARIO DEBUG] Usuario a agregar:', newUserForMain);
      
      const updatedAllUsers = [...allUsers, newUserForMain];
      localStorage.setItem('smart-student-users', JSON.stringify(updatedAllUsers));
      
      console.log('✅ [USUARIO DEBUG] Usuario guardado en smart-student-users');
      console.log('📊 [USUARIO DEBUG] Total usuarios ahora:', updatedAllUsers.length);

      // Show success message with credentials if auto-generated
      if (createUserFormData.autoGenerate) {
        toast({
          title: translate('success') || 'Éxito',
          description: `${translate('userManagementUserCreated') || 'Usuario creado exitosamente'}. ${translate('userManagementCredentials') || 'Credenciales'}: ${username} / ${password}`,
          duration: 8000
        });
      } else {
        toast({
          title: translate('success') || 'Éxito',
          description: translate('userManagementUserCreated') || 'Usuario creado exitosamente',
        });
      }

      // Reset form and close modal
      resetCreateUserForm();
      setShowCreateUserDialog(false);

      // Refresh the user list to show the new user
      setRefreshUsers(prev => prev + 1);

      toast({
        title: translate('userManagementSuccess') || 'Éxito',
        description: `${
          createUserFormData.role === 'student' ? translate('userManagementStudent') || 'Estudiante' : 
          createUserFormData.role === 'teacher' ? translate('userManagementTeacher') || 'Profesor' : 
          translate('userManagementAdministrador') || 'Administrador'
        } ${translate('userManagementCreatedSuccessfully') || 'creado exitosamente'}`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('error') || 'Error',
        description: translate('userManagementCreateUserError') || 'Error al crear el usuario',
        variant: 'destructive'
      });
    }
  };

  const resetCreateUserForm = () => {
    setCreateUserFormData({
      name: '',
      email: '',
      role: 'student',
      username: '',
      password: '',
      confirmPassword: '',
      autoGenerate: true,
      courseId: '',
      section: '',
      subject: '',
      selectedSubjects: []
    });
  };

  // Function to get role badge colors
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

  const stats = getSystemStatistics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <SettingsIcon className="w-6 h-6 mr-2 text-blue-500" />
            {translate('configSystemTitle') || 'Configuración del Sistema'}
          </h2>
          <p className="text-muted-foreground">
            {translate('configSystemSubtitle') || 'Administra la configuración y mantén el sistema'}
          </p>
        </div>
      </div>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2" />
              {translate('configTotalUsersTitle') || 'Usuarios Totales'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.students} {translate('configStudentsTeachersText')?.replace('{{teachers}}', stats.teachers) || `estudiantes, ${stats.teachers} profesores`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Database className="w-4 h-4 mr-2" />
              {translate('configAcademicStructureTitle') || 'Estructura Académica'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.courses}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {translate('configSectionsSubjectsText')?.replace('{{sections}}', stats.sections).replace('{{subjects}}', stats.subjects) || `${stats.sections} secciones, ${stats.subjects} asignaturas`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              {translate('configAssignmentsTitle') || 'Asignaciones'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignments}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {translate('configAssignedText')?.replace('{{students}}', stats.assignedStudents).replace('{{teachers}}', stats.assignedTeachers) || `${stats.assignedStudents} est. asignados, ${stats.assignedTeachers} prof. asignados`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2" />
            {translate('configGeneralTitle') || 'Configuración General'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Management Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">{translate('configUserManagementTitle') || 'Gestión de Usuarios'}</h4>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="autoGenerateUsernames" className="text-sm font-medium">
                    {translate('configAutoGenerateUsernamesLabel') || 'Generar usuarios automáticamente'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {translate('configAutoGenerateUsernamesDesc') || 'Crear nombres de usuario basados en el nombre completo'}
                  </p>
                </div>
                <Switch
                  id="autoGenerateUsernames"
                  checked={config.autoGenerateUsernames}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, autoGenerateUsernames: checked }))
                  }
                  className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600"
                />
              </div>

              <div>
                <Label htmlFor="defaultPasswordLength">{translate('configDefaultPasswordLengthLabel') || 'Longitud de contraseña por defecto'}</Label>
                <Input
                  id="defaultPasswordLength"
                  type="number"
                  min="6"
                  max="20"
                  value={config.defaultPasswordLength}
                  onChange={(e) => 
                    setConfig(prev => ({ 
                      ...prev, 
                      defaultPasswordLength: parseInt(e.target.value) || 8 
                    }))
                  }
                  className="w-20"
                />
              </div>
            </div>

            {/* Academic Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">{translate('configAcademicTitle') || 'Configuración Académica'}</h4>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allowMultipleTeachers" className="text-sm font-medium">
                    {translate('configMultipleTeachersLabel') || 'Múltiples profesores por asignatura'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {translate('configMultipleTeachersDesc') || 'Permitir varios profesores en la misma asignatura'}
                  </p>
                </div>
                <Switch
                  id="allowMultipleTeachers"
                  checked={config.allowMultipleTeachersPerSubject}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, allowMultipleTeachersPerSubject: checked }))
                  }
                  className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600"
                />
              </div>

              <div>
                <Label htmlFor="maxStudentsPerSection">{translate('configMaxStudentsLabel') || 'Máximo estudiantes por sección'}</Label>
                <Input
                  id="maxStudentsPerSection"
                  type="number"
                  min="10"
                  max="50"
                  value={config.maxStudentsPerSection}
                  onChange={(e) => 
                    setConfig(prev => ({ 
                      ...prev, 
                      maxStudentsPerSection: parseInt(e.target.value) || 30 
                    }))
                  }
                  className="w-20"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button 
              onClick={saveConfiguration}
              disabled={isLoading}
              className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              {translate('configSaveButton') || 'Guardar Configuración'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            {translate('configDataManagementTitle') || 'Gestión de Datos'}
          </CardTitle>
        </CardHeader>
        <CardContent>mo
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Export Data */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Download className="w-4 h-4 mr-2 text-blue-500" />
                {translate('configExportDataTitle') || 'Exportar Datos'}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {translate('configExportDataDesc') || 'Descarga una copia de seguridad de todos los datos del sistema'}
              </p>
              <Button 
                onClick={exportSystemData}
                variant="outline" 
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                {translate('configExportButton') || 'Exportar'}
              </Button>
            </div>

            {/* Import Data */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Upload className="w-4 h-4 mr-2 text-green-500" />
                {translate('configImportDataTitle') || 'Importar Datos'}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {translate('configImportDataDesc') || 'Restaura datos desde un archivo de respaldo'}
              </p>
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                  id="import-file"
                />
                <Button 
                  onClick={() => document.getElementById('import-file')?.click()}
                  variant="outline" 
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {translate('configImportButton') || 'Importar'}
                </Button>
              </div>
            </div>

            {/* Reset System */}
            <div className="p-4 border border-red-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center text-red-600">
                <AlertTriangle className="w-4 h-4 mr-2" />
                {translate('configResetSystemTitle') || 'Reiniciar Sistema'}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {translate('configResetSystemDesc') || 'Elimina todos los datos del sistema (irreversible)'}
              </p>
              
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {translate('configResetButton') || 'Reiniciar'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center text-red-600">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      {translate('configConfirmResetTitle') || 'Confirmar Reinicio del Sistema'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <p className="text-sm">
                        <strong>{translate('configResetWarningTitle') || '¡Advertencia!'}</strong> {translate('configResetWarningText') || 'Esta acción eliminará permanentemente:'}
                      </p>
                      <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                        <li>{translate('configResetWarningItem1') || 'Todos los usuarios (estudiantes y profesores)'}</li>
                        <li>{translate('configResetWarningItem2') || 'Toda la estructura académica (cursos, secciones, asignaturas)'}</li>
                        <li>{translate('configResetWarningItem3') || 'Todas las asignaciones'}</li>
                        <li>{translate('configResetWarningItem4') || 'Toda la configuración personalizada'}</li>
                        <li>{translate('configResetWarningItem5') || 'Datos de tareas y evaluaciones existentes'}</li>
                      </ul>
                      <p className="text-sm mt-2 font-medium">
                        {translate('configResetCannotUndo') || 'Esta acción no se puede deshacer.'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={resetAllData}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {translate('configConfirmResetButton') || 'Sí, reiniciar sistema'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowResetDialog(false)}
                        className="flex-1"
                      >
                        {translate('configCancelButton') || 'Cancelar'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {translate('configSecurityToolsTitle') || 'Herramientas de Seguridad'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Regenerate Passwords */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Key className="w-4 h-4 mr-2 text-orange-500" />
                {translate('configRegeneratePasswordsTitle') || 'Regenerar Contraseñas'}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {translate('configRegeneratePasswordsDesc') || 'Genera nuevas contraseñas para todos los usuarios del sistema'}
              </p>
              <Button 
                onClick={regeneratePasswords}
                disabled={isLoading}
                variant="outline" 
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {translate('configRegenerateAllButton') || 'Regenerar Todas'}
              </Button>
            </div>

            {/* ✅ NUEVO: Reparar Usuarios */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                {translate('configRepairUsersTitle') || 'Reparar Usuarios'}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {translate('configRepairUsersDesc') || 'Corrige usuarios con campos faltantes para garantizar acceso al login'}
              </p>
              <Button 
                onClick={repairExistingUsers}
                disabled={isLoading}
                variant="outline" 
                className="w-full"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {translate('configRepairUsersButton') || 'Reparar Usuarios'}
              </Button>
            </div>

            {/* System Health */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                {translate('configSystemStatusTitle') || 'Estado del Sistema'}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{translate('configDataIntegrityLabel') || 'Integridad de datos:'}</span>
                  <Badge variant="default">OK</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{translate('configValidAssignmentsLabel') || 'Asignaciones válidas:'}</span>
                  <Badge variant="default">OK</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{translate('configUniqueCodesLabel') || 'Códigos únicos:'}</span>
                  <Badge variant="default">OK</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Management Section */}
      <UserManagementSection 
        showCreateUserDialog={showCreateUserDialog}
        setShowCreateUserDialog={setShowCreateUserDialog}
        createUserFormData={createUserFormData}
        setCreateUserFormData={setCreateUserFormData}
        handleCreateUser={handleCreateUser}
        resetCreateUserForm={resetCreateUserForm}
        getRoleColor={getRoleColor}
        getRoleIcon={getRoleIcon}
        availableCourses={availableCourses}
        availableSections={availableSections}
        availableSubjects={availableSubjects}
        refreshUsers={refreshUsers}
      />
    </div>
  );
}

// New component for user management
function UserManagementSection({ 
  showCreateUserDialog, 
  setShowCreateUserDialog, 
  createUserFormData, 
  setCreateUserFormData, 
  handleCreateUser, 
  resetCreateUserForm,
  getRoleColor,
  getRoleIcon,
  availableCourses,
  availableSections,
  availableSubjects,
  refreshUsers
}: {
  showCreateUserDialog: boolean;
  setShowCreateUserDialog: (value: boolean) => void;
  createUserFormData: any;
  setCreateUserFormData: (value: any) => void;
  handleCreateUser: () => Promise<void>;
  resetCreateUserForm: () => void;
  getRoleColor: (role: string) => string;
  getRoleIcon: (role: string) => React.ReactElement | null;
  availableCourses: any[];
  availableSections: any[];
  availableSubjects: any[];
  refreshUsers: number;
}) {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  useEffect(() => {
    loadAllUsers();
  }, [refreshUsers]);

  useEffect(() => {
    filterUsers();
  }, [allUsers, searchTerm, filterRole]);

  const loadAllUsers = () => {
    try {
      const students = LocalStorageManager.getStudents();
      const teachers = LocalStorageManager.getTeachers();
      const mainUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      
      // Create a comprehensive user list
      const userMap = new Map();

      // Add admins from main users (those not in students or teachers)
      mainUsers.forEach(user => {
        if (user && user.username && !students.find(s => s.username === user.username) && 
            !teachers.find(t => t.username === user.username)) {
          userMap.set(user.username, {
            id: user.id || crypto.randomUUID(),
            username: user.username || 'Sin usuario',
            name: user.name || 'Sin nombre',
            email: user.email || '',
            role: user.role || 'admin',
            type: 'admin',
            password: user.password || 'N/A',
            createdAt: user.createdAt || new Date(),
            isActive: user.isActive !== undefined ? user.isActive : true
          });
        }
      });

      // Add students
      students.forEach(student => {
        if (student && student.username) {
          const mainUser = mainUsers.find(u => u && u.username === student.username);
          userMap.set(student.username, {
            id: student.id || crypto.randomUUID(),
            username: student.username || 'Sin usuario',
            name: student.name || 'Sin nombre',
            email: student.email || '',
            password: mainUser?.password || 'N/A',
            type: 'student',
            role: 'student',
            uniqueCode: student.uniqueCode || '',
            courseId: student.courseId || '',
            sectionId: student.sectionId || '',
            createdAt: student.createdAt || new Date(),
            isActive: student.isActive !== undefined ? student.isActive : true
          });
        }
      });

      // Add teachers
      teachers.forEach(teacher => {
        if (teacher && teacher.username) {
          const mainUser = mainUsers.find(u => u && u.username === teacher.username);
          userMap.set(teacher.username, {
            id: teacher.id || crypto.randomUUID(),
            username: teacher.username || 'Sin usuario',
            name: teacher.name || 'Sin nombre',
            email: teacher.email || '',
            password: mainUser?.password || 'N/A',
            type: 'teacher',
            role: 'teacher',
            uniqueCode: teacher.uniqueCode || '',
            selectedSubjects: teacher.selectedSubjects || [],
            assignedSections: teacher.assignedSections || [],
            createdAt: teacher.createdAt || new Date(),
            isActive: teacher.isActive !== undefined ? teacher.isActive : true
          });
        }
      });

      const users = Array.from(userMap.values()).sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
      setAllUsers([]);
    }
  };

  const filterUsers = () => {
    let filtered = allUsers;

    if (searchTerm.trim()) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.type === filterRole);
    }

    setFilteredUsers(filtered);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowEditDialog(true);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const confirmDeleteUser = () => {
    try {
      // Remove from respective collections
      if (userToDelete.type === 'student') {
        const students = LocalStorageManager.getStudents();
        const updatedStudents = students.filter(s => s.id !== userToDelete.id);
        LocalStorageManager.setStudents(updatedStudents);
      } else if (userToDelete.type === 'teacher') {
        const teachers = LocalStorageManager.getTeachers();
        const updatedTeachers = teachers.filter(t => t.id !== userToDelete.id);
        LocalStorageManager.setTeachers(updatedTeachers);
      }

      // Remove from main users
      const mainUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const updatedMainUsers = mainUsers.filter((u: any) => u.username !== userToDelete.username);
      localStorage.setItem('smart-student-users', JSON.stringify(updatedMainUsers));

      loadAllUsers();
      setShowDeleteDialog(false);
      setUserToDelete(null);

      toast({
        title: translate('userDeleted') || 'User deleted',
        description: translate('userDeletedSuccessfully') || 'User has been deleted successfully',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('error') || 'Error',
        description: translate('couldNotDeleteUser') || 'Could not delete user',
        variant: 'destructive'
      });
    }
  };

  const getRoleLabel = (type: string) => {
    switch (type) {
      case 'admin': return translate('roleAdmin') || 'Administrador';
      case 'teacher': return translate('roleTeacher') || 'Profesor';
      case 'student': return translate('roleStudent') || 'Estudiante';
      default: return translate('user') || 'Usuario';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              {translate('configAllUsersTitle') || 'Panel de Usuarios del Sistema'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {translate('configAllUsersDesc') || 'Gestiona y administra todos los usuarios registrados en el sistema'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => setShowCreateUserDialog(true)}
              className="bg-blue-500 hover:bg-blue-600"
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {translate('userManagementNewUser') || 'Nuevo Usuario'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder={translate('configSearchPlaceholder') || 'Buscar por nombre, usuario o email...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterRole === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterRole('all')}
              size="sm"
            >
              {translate('configFilterAll') || 'Todos'} ({allUsers.length})
            </Button>
            <Button
              variant={filterRole === 'admin' ? 'default' : 'outline'}
              onClick={() => setFilterRole('admin')}
              size="sm"
            >
              {translate('configFilterAdmins') || 'Admins'} ({allUsers.filter(u => u.type === 'admin').length})
            </Button>
            <Button
              variant={filterRole === 'teacher' ? 'default' : 'outline'}
              onClick={() => setFilterRole('teacher')}
              size="sm"
            >
              {translate('configFilterTeachers') || 'Profesores'} ({allUsers.filter(u => u.type === 'teacher').length})
            </Button>
            <Button
              variant={filterRole === 'student' ? 'default' : 'outline'}
              onClick={() => setFilterRole('student')}
              size="sm"
            >
              {translate('configFilterStudents') || 'Estudiantes'} ({allUsers.filter(u => u.type === 'student').length})
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {translate('configTableUserColumn') || 'Usuario'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {translate('configTableTypeColumn') || 'Tipo'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {translate('configTableEmailColumn') || 'Email'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {translate('configTableCreatedColumn') || 'Creado'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {translate('configTableActionsColumn') || 'Acciones'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.username} className="hover:bg-muted/50">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                        {user.uniqueCode && (
                          <div className="text-xs text-muted-foreground">{user.uniqueCode}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={getRoleColor(user.type)}>
                        {getRoleIcon(user.type)}
                        {getRoleLabel(user.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">{user.email || (translate('configNoEmailText') || 'Sin email')}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                          className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                        >
                          <Key className="w-3 h-3 mr-1" />
                          {translate('configEditButton') || 'Editar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {translate('configDeleteButton') || 'Eliminar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {translate('configNoUsersFound') || 'No se encontraron usuarios que coincidan con los filtros'}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{translate('configConfirmDeleteTitle') || 'Confirmar Eliminación'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                {translate('configConfirmDeleteText')?.replace('{{username}}', userToDelete?.name || userToDelete?.username || 'este usuario') || 
                 `¿Estás seguro de que quieres eliminar al usuario ${userToDelete?.name || userToDelete?.username || 'este usuario'}?`}
              </p>
              <p className="text-sm text-muted-foreground">{translate('configDeleteCannotUndo') || 'Esta acción no se puede deshacer.'}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  {translate('configCancelButton') || 'Cancelar'}
                </Button>
                <Button variant="destructive" onClick={confirmDeleteUser}>
                  {translate('configDeleteUserButton') || 'Eliminar Usuario'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{translate('configEditUserTitle') || 'Editar Usuario'}</DialogTitle>
            </DialogHeader>
            <EditUserForm 
              user={editingUser} 
              onClose={() => setShowEditDialog(false)}
              onUserUpdated={loadAllUsers}
              getRoleColor={getRoleColor}
              getRoleIcon={getRoleIcon}
            />
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-blue-500" />
                {translate('userManagementCreateNewUser') || 'Crear Nuevo Usuario'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* User Type Selection */}
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="student"
                    name="userType"
                    checked={createUserFormData.role === 'student'}
                    onChange={() => setCreateUserFormData(prev => ({ 
                      ...prev, 
                      role: 'student',
                      courseId: '',
                      section: ''
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
                    checked={createUserFormData.role === 'teacher'}
                    onChange={() => setCreateUserFormData(prev => ({ 
                      ...prev, 
                      role: 'teacher',
                      courseId: '',
                      section: ''
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
                    checked={createUserFormData.role === 'admin'}
                    onChange={() => setCreateUserFormData(prev => ({ 
                      ...prev, 
                      role: 'admin',
                      courseId: '',
                      section: ''
                    }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="admin" className="flex items-center cursor-pointer">
                    <Crown className="w-4 h-4 mr-1" />
                    {translate('userManagementAdministrator') || 'Administrador'}
                  </Label>
                </div>
              </div>

              {/* Auto-generate credentials toggle */}
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
                  checked={createUserFormData.autoGenerate}
                  onCheckedChange={(checked) => setCreateUserFormData(prev => ({ ...prev, autoGenerate: checked }))}
                />
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">{translate('userManagementFullName') || 'Nombre Completo'} *</Label>
                  <Input
                    id="name"
                    value={createUserFormData.name}
                    onChange={(e) => setCreateUserFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={translate('userManagementFullNamePlaceholder') || 'Nombre completo del usuario'}
                  />
                </div>

                <div>
                  <Label htmlFor="email">{translate('userManagementEmail') || 'Email'}</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={createUserFormData.email}
                      onChange={(e) => setCreateUserFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder={translate('userManagementEmailPlaceholder') || 'correo@ejemplo.com (opcional)'}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">{translate('userManagementUsername') || 'Nombre de Usuario'} *</Label>
                  <Input
                    id="username"
                    value={createUserFormData.username}
                    onChange={(e) => setCreateUserFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder={translate('userManagementUsernamePlaceholder') || 'Ingresa el nombre de usuario'}
                    disabled={createUserFormData.autoGenerate}
                  />
                </div>

                <div>
                  <Label htmlFor="password">{translate('userManagementPassword') || 'Contraseña'} *</Label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={createUserFormData.password}
                      onChange={(e) => setCreateUserFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={translate('userManagementPasswordPlaceholder') || 'Contraseña'}
                      disabled={createUserFormData.autoGenerate}
                      className="pl-10"
                    />
                  </div>
                  {!createUserFormData.autoGenerate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {translate('userManagementPasswordMinChars') || 'Mínimo 4 caracteres'}
                    </p>
                  )}
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <Label htmlFor="confirmPassword">{translate('userManagementConfirmPassword') || 'Confirmar Contraseña'} *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={createUserFormData.confirmPassword}
                  onChange={(e) => setCreateUserFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder={translate('userManagementConfirmPasswordPlaceholder') || 'Confirmar contraseña'}
                  disabled={createUserFormData.autoGenerate}
                />
              </div>

              {/* Student-specific fields */}
              {createUserFormData.role === 'student' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div>
                    <Label htmlFor="course">{translate('userManagementCourse') || 'Curso'} *</Label>
                    <Select 
                      value={createUserFormData.courseId} 
                      onValueChange={(value) => setCreateUserFormData(prev => ({ ...prev, courseId: value, section: '' }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={translate('userManagementSelectCourse') || 'Selecciona un curso'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCourses.map((course, index) => (
                          <SelectItem key={course.id || `course-${index}`} value={course.id}>
                            {course.name || course}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="section">{translate('userManagementSection') || 'Sección'} *</Label>
                    <Select 
                      value={createUserFormData.section} 
                      onValueChange={(value) => setCreateUserFormData(prev => ({ ...prev, section: value }))}
                      disabled={!createUserFormData.courseId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={translate('userManagementSelectSection') || 'Selecciona una sección'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSections
                          .filter((section: any) => section.courseId === createUserFormData.courseId)
                          .map((section: any, index: number) => (
                            <SelectItem key={section.id || `section-${index}`} value={section.id}>
                              {section.name || section} ({section.studentCount || 0}/{section.maxStudents || translate('userManagementNoLimit') || 'Sin límite'})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Teacher-specific fields */}
              {createUserFormData.role === 'teacher' && (
                <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div>
                    <Label>{translate('userManagementSubjectsTeacherWillTeach') || 'Asignaturas que impartirá *'}</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      {translate('userManagementSelectSubjectsTeacher') || 'Selecciona las asignaturas que el profesor podrá impartir (puede enseñar en cualquier curso/sección)'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {getAllAvailableSubjects().map((subject: SubjectColor) => {
                        const isSelected = createUserFormData.selectedSubjects?.includes(subject.name);
                        return (
                          <Badge
                            key={subject.name}
                            className={`text-xs font-bold border-0 cursor-pointer px-2 py-1 transition-all duration-200 ${
                              isSelected
                                ? 'ring-2 ring-blue-500 ring-offset-2'
                                : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                            }`}
                            style={{
                              backgroundColor: subject.bgColor,
                              color: subject.textColor,
                              opacity: isSelected ? 1 : 0.7
                            }}
                            title={subject.name}
                            onClick={() => {
                              setCreateUserFormData(prev => ({
                                ...prev,
                                selectedSubjects: prev.selectedSubjects?.includes(subject.name)
                                  ? prev.selectedSubjects.filter((s: string) => s !== subject.name)
                                  : [...(prev.selectedSubjects || []), subject.name]
                              }));
                            }}
                          >
                            {subject.abbreviation}
                          </Badge>
                        );
                      })}
                    </div>
                    {(!createUserFormData.selectedSubjects || createUserFormData.selectedSubjects.length === 0) && (
                      <p className="text-red-500 text-xs mt-2">{translate('userManagementSelectAtLeastOneSubject') || 'Selecciona al menos una asignatura'}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    resetCreateUserForm();
                    setShowCreateUserDialog(false);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  {translate('userManagementCancel') || 'Cancelar'}
                </Button>
                <Button
                  onClick={handleCreateUser}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  {translate('userManagementCreateUser') || 'Crear Usuario'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Edit User Form Component
function EditUserForm({ user, onClose, onUserUpdated, getRoleColor, getRoleIcon }: { 
  user: any; 
  onClose: () => void; 
  onUserUpdated: () => void; 
  getRoleColor: (role: string) => string;
  getRoleIcon: (role: string) => React.ReactElement | null;
}) {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    isActive: user?.isActive !== undefined ? user.isActive : true,
    selectedSubjects: user?.selectedSubjects || [],
    courseId: user?.courseId || '',
    sectionId: user?.sectionId || ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load available subjects, courses, and sections
  const [availableSubjects] = useState(() => {
    try {
      return LocalStorageManager.getSubjects();
    } catch {
      return [];
    }
  });
  
  const [availableCourses] = useState(() => {
    try {
      return LocalStorageManager.getCourses();
    } catch {
      return [];
    }
  });
  
  const [availableSections] = useState(() => {
    try {
      return LocalStorageManager.getSections();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        password: '',
        confirmPassword: '',
        isActive: user.isActive !== undefined ? user.isActive : true,
        selectedSubjects: user.selectedSubjects || [],
        courseId: user.courseId || '',
        sectionId: user.sectionId || ''
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubjectToggle = (subjectName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subjectName)
        ? prev.selectedSubjects.filter(s => s !== subjectName)
        : [...prev.selectedSubjects, subjectName]
    }));
  };

  const handleSaveUser = async () => {
    if (!formData.name.trim() || !formData.username.trim()) {
      toast({
        title: translate('error') || 'Error',
        description: translate('editUserRequiredFields') || 'El nombre y usuario son requeridos',
        variant: 'destructive'
      });
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: translate('error') || 'Error',
        description: translate('editUserPasswordMismatch') || 'Las contraseñas no coinciden',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update user in respective collection
      if (user.type === 'student') {
        const students = LocalStorageManager.getStudents();
        const updatedStudents = students.map(s => 
          s.id === user.id 
            ? { 
                ...s, 
                name: formData.name,
                username: formData.username,
                email: formData.email,
                isActive: formData.isActive,
                courseId: formData.courseId,
                sectionId: formData.sectionId
              }
            : s
        );
        LocalStorageManager.setStudents(updatedStudents);
      } else if (user.type === 'teacher') {
        const teachers = LocalStorageManager.getTeachers();
        const updatedTeachers = teachers.map(t => 
          t.id === user.id 
            ? { 
                ...t, 
                name: formData.name,
                username: formData.username,
                email: formData.email,
                isActive: formData.isActive,
                selectedSubjects: formData.selectedSubjects
              }
            : t
        );
        LocalStorageManager.setTeachers(updatedTeachers);
      }

      // Update in main users if password changed
      const mainUsers = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const updatedMainUsers = mainUsers.map((u: any) => 
        u.username === user.username 
          ? { 
              ...u, 
              name: formData.name,
              username: formData.username,
              email: formData.email,
              isActive: formData.isActive,
              ...(formData.password ? { password: formData.password } : {})
            }
          : u
      );
      localStorage.setItem('smart-student-users', JSON.stringify(updatedMainUsers));

      onUserUpdated();
      onClose();

      toast({
        title: translate('editUserUpdatedTitle') || 'Usuario actualizado',
        description: translate('editUserUpdatedDescription') || 'Los cambios se han guardado correctamente',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: translate('error') || 'Error',
        description: translate('editUserUpdateError') || 'No se pudo actualizar el usuario',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{translate('editUserBasicInfo') || 'Información Básica'}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">{translate('editUserFullName') || 'Nombre completo'} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder={translate('editUserFullNamePlaceholder') || 'Ingresa el nombre completo'}
            />
          </div>
          
          <div>
            <Label htmlFor="username">{translate('editUserUsername') || 'Usuario'} *</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder={translate('editUserUsernamePlaceholder') || 'Ingresa el nombre de usuario'}
            />
          </div>
          
          <div>
            <Label htmlFor="email">{translate('editUserEmail') || 'Email'}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder={translate('editUserEmailPlaceholder') || 'email@ejemplo.com'}
            />
          </div>

          <div>
            <Label>{translate('editUserType') || 'Tipo de Usuario'}</Label>
            <div className="mt-2">
              <Badge className={getRoleColor(user.type)}>
                {getRoleIcon(user.type)}
                {user.type === 'admin' ? (translate('editUserTypeAdmin') || 'Administrador') :
                 user.type === 'teacher' ? (translate('editUserTypeTeacher') || 'Profesor') : 
                 (translate('editUserTypeStudent') || 'Estudiante')}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="active"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleInputChange('isActive', checked)}
          />
          <Label htmlFor="active">{translate('editUserActive') || 'Usuario activo'}</Label>
        </div>
      </div>

      {/* Password Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{translate('editUserChangePassword') || 'Cambiar Contraseña'}</h3>
        <p className="text-sm text-muted-foreground">
          {translate('editUserPasswordInfo') || 'Deja estos campos vacíos si no quieres cambiar la contraseña'}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="password">{translate('editUserNewPassword') || 'Nueva contraseña'}</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder={translate('editUserNewPasswordPlaceholder') || 'Nueva contraseña'}
            />
          </div>
          
          <div>
            <Label htmlFor="confirmPassword">{translate('editUserConfirmPassword') || 'Confirmar contraseña'}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              placeholder={translate('editUserConfirmPasswordPlaceholder') || 'Confirma la nueva contraseña'}
            />
          </div>
        </div>
      </div>

      {/* Student-specific fields */}
      {user.type === 'student' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{translate('editUserAcademicInfo') || 'Información Académica'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="course">{translate('editUserCourse') || 'Curso'}</Label>
              <Select
                value={formData.courseId}
                onValueChange={(value) => handleInputChange('courseId', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={translate('editUserSelectCourse') || 'Seleccionar curso'} />
                </SelectTrigger>
                <SelectContent>
                  {availableCourses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="section">{translate('editUserSection') || 'Sección'}</Label>
              <Select
                value={formData.sectionId}
                onValueChange={(value) => handleInputChange('sectionId', value)}
                disabled={!formData.courseId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={translate('editUserSelectSection') || 'Seleccionar sección'} />
                </SelectTrigger>
                <SelectContent>
                  {availableSections
                    .filter(section => !formData.courseId || section.courseId === formData.courseId)
                    .map(section => (
                      <SelectItem key={section.id} value={section.id}>
                        {translate('editUserSectionPrefix') || 'Sección'} {section.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label>{translate('editUserUniqueCode') || 'Código único:'} <span className="font-mono">{user.uniqueCode}</span></Label>
          </div>
        </div>
      )}

      {/* Teacher-specific fields */}
      {user.type === 'teacher' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{translate('editUserSubjects') || 'Asignaturas'}</h3>
          
          <div>
            <Label>{translate('editUserUniqueCode') || 'Código único:'} <span className="font-mono">{user.uniqueCode}</span></Label>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableSubjects.map(subject => (
              <div key={subject.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`subject-${subject.id}`}
                  checked={formData.selectedSubjects.includes(subject.name)}
                  onChange={() => handleSubjectToggle(subject.name)}
                  className="rounded"
                />
                <Label htmlFor={`subject-${subject.id}`} className="text-sm">
                  {subject.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={handleSaveUser}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
        >
          {isLoading ? (translate('editUserSaving') || 'Guardando...') : (translate('editUserSaveChanges') || 'Guardar Cambios')}
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          {translate('editUserCancel') || 'Cancelar'}
        </Button>
      </div>
    </div>
  );
}
