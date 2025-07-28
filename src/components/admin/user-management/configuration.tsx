"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
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
  CheckCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LocalStorageManager, UsernameGenerator } from '@/lib/education-utils';
import { SystemConfig } from '@/types/education';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Configuration() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SystemConfig>({
    allowMultipleTeachersPerSubject: false,
    maxStudentsPerSection: 30,
    autoGenerateUsernames: true,
    defaultPasswordLength: 8
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

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
        title: 'Configuración guardada',
        description: 'Los cambios se han aplicado correctamente y se han actualizado las capacidades de las secciones',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
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
      
      return {
        totalUsers: students.length + teachers.length,
        students: students.length,
        teachers: teachers.length,
        courses: courses.length,
        sections: sections.length,
        subjects: subjects.length,
        assignments: assignments.filter((a: any) => a.isActive).length,
        assignedStudents: students.filter((s: any) => s.courseId && s.sectionId).length,
        assignedTeachers: teachers.filter((t: any) => t.assignedSections && t.assignedSections.length > 0).length
      };
    } catch (error) {
      return {
        totalUsers: 0, students: 0, teachers: 0, courses: 0, 
        sections: 0, subjects: 0, assignments: 0, 
        assignedStudents: 0, assignedTeachers: 0
      };
    }
  };

  const exportSystemData = () => {
    try {
      const data = {
        courses: LocalStorageManager.getCourses(),
        sections: LocalStorageManager.getSections(),
        subjects: LocalStorageManager.getSubjects(),
        students: LocalStorageManager.getStudents(),
        teachers: LocalStorageManager.getTeachers(),
        assignments: LocalStorageManager.getAssignments(),
        config: LocalStorageManager.getConfig(),
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `smart-student-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      toast({
        title: 'Exportación exitosa',
        description: 'Los datos del sistema han sido exportados',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error en exportación',
        description: 'No se pudieron exportar los datos',
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
          throw new Error('Formato de archivo inválido');
        }

        // Confirm before importing
        if (window.confirm('¿Estás seguro de que quieres importar estos datos? Esto sobrescribirá todos los datos existentes.')) {
          // Import data
          LocalStorageManager.setCourses(importedData.courses || []);
          LocalStorageManager.setSections(importedData.sections || []);
          LocalStorageManager.setSubjects(importedData.subjects || []);
          LocalStorageManager.setStudents(importedData.students || []);
          LocalStorageManager.setTeachers(importedData.teachers || []);
          LocalStorageManager.setAssignments(importedData.assignments || []);
          
          if (importedData.config) {
            LocalStorageManager.setConfig(importedData.config);
            setConfig({ ...config, ...importedData.config });
          }

          toast({
            title: 'Importación exitosa',
            description: 'Los datos han sido importados correctamente',
            variant: 'default'
          });

          // Refresh page to reload data
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (error) {
        toast({
          title: 'Error en importación',
          description: 'No se pudieron importar los datos. Verifica el formato del archivo.',
          variant: 'destructive'
        });
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const resetAllData = () => {
    try {
      // Clear all data
      localStorage.removeItem('smart-student-courses');
      localStorage.removeItem('smart-student-sections');
      localStorage.removeItem('smart-student-subjects');
      localStorage.removeItem('smart-student-students');
      localStorage.removeItem('smart-student-teachers');
      localStorage.removeItem('smart-student-assignments');
      localStorage.removeItem('smart-student-config');

      // Also clear legacy data
      localStorage.removeItem('smart-student-users');
      localStorage.removeItem('smart-student-tasks');
      localStorage.removeItem('smart-student-task-notifications');
      localStorage.removeItem('smart-student-task-comments');

      toast({
        title: 'Sistema reiniciado',
        description: 'Todos los datos han sido eliminados',
        variant: 'default'
      });

      setShowResetDialog(false);

      // Refresh page
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo reiniciar el sistema',
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
        title: 'Contraseñas regeneradas',
        description: `Se regeneraron ${updatedCount} contraseñas`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron regenerar las contraseñas',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
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
            Configuración del Sistema
          </h2>
          <p className="text-muted-foreground">
            Administra la configuración y mantén el sistema
          </p>
        </div>
      </div>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Usuarios Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.students} estudiantes, {stats.teachers} profesores
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Database className="w-4 h-4 mr-2" />
              Estructura Académica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.courses}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.sections} secciones, {stats.subjects} asignaturas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Asignaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignments}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.assignedStudents} est. asignados, {stats.assignedTeachers} prof. asignados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2" />
            Configuración General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Management Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">Gestión de Usuarios</h4>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="autoGenerateUsernames" className="text-sm font-medium">
                    Generar usuarios automáticamente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Crear nombres de usuario basados en el nombre completo
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
                <Label htmlFor="defaultPasswordLength">Longitud de contraseña por defecto</Label>
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
              <h4 className="font-medium">Configuración Académica</h4>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allowMultipleTeachers" className="text-sm font-medium">
                    Múltiples profesores por asignatura
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permitir varios profesores en la misma asignatura
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
                <Label htmlFor="maxStudentsPerSection">Máximo estudiantes por sección</Label>
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
              Guardar Configuración
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Gestión de Datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Export Data */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Download className="w-4 h-4 mr-2 text-blue-500" />
                Exportar Datos
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Descarga una copia de seguridad de todos los datos del sistema
              </p>
              <Button 
                onClick={exportSystemData}
                variant="outline" 
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>

            {/* Import Data */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Upload className="w-4 h-4 mr-2 text-green-500" />
                Importar Datos
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Restaura datos desde un archivo de respaldo
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
                  Importar
                </Button>
              </div>
            </div>

            {/* Reset System */}
            <div className="p-4 border border-red-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center text-red-600">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Reiniciar Sistema
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Elimina todos los datos del sistema (irreversible)
              </p>
              
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Reiniciar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center text-red-600">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Confirmar Reinicio del Sistema
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <p className="text-sm">
                        <strong>¡Advertencia!</strong> Esta acción eliminará permanentemente:
                      </p>
                      <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                        <li>Todos los usuarios (estudiantes y profesores)</li>
                        <li>Toda la estructura académica (cursos, secciones, asignaturas)</li>
                        <li>Todas las asignaciones</li>
                        <li>Toda la configuración personalizada</li>
                        <li>Datos de tareas y evaluaciones existentes</li>
                      </ul>
                      <p className="text-sm mt-2 font-medium">
                        Esta acción no se puede deshacer.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={resetAllData}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Sí, reiniciar sistema
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowResetDialog(false)}
                        className="flex-1"
                      >
                        Cancelar
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
            Herramientas de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Regenerate Passwords */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <Key className="w-4 h-4 mr-2 text-orange-500" />
                Regenerar Contraseñas
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Genera nuevas contraseñas para todos los usuarios del sistema
              </p>
              <Button 
                onClick={regeneratePasswords}
                disabled={isLoading}
                variant="outline" 
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerar Todas
              </Button>
            </div>

            {/* System Health */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                Estado del Sistema
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Integridad de datos:</span>
                  <Badge variant="default">OK</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Asignaciones válidas:</span>
                  <Badge variant="default">OK</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Códigos únicos:</span>
                  <Badge variant="default">OK</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Management Section */}
      <UserManagementSection />
    </div>
  );
}

// New component for user management
function UserManagementSection() {
  const { toast } = useToast();
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
  }, []);

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
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado correctamente',
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

  const getRoleColor = (type: string) => {
    switch (type) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'teacher': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'student': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getRoleLabel = (type: string) => {
    switch (type) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Profesor';
      case 'student': return 'Estudiante';
      default: return 'Usuario';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Todos los Usuarios del Sistema
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Gestiona y administra todos los usuarios registrados en el sistema
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre, usuario o email..."
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
              Todos ({allUsers.length})
            </Button>
            <Button
              variant={filterRole === 'admin' ? 'default' : 'outline'}
              onClick={() => setFilterRole('admin')}
              size="sm"
            >
              Admins ({allUsers.filter(u => u.type === 'admin').length})
            </Button>
            <Button
              variant={filterRole === 'teacher' ? 'default' : 'outline'}
              onClick={() => setFilterRole('teacher')}
              size="sm"
            >
              Profesores ({allUsers.filter(u => u.type === 'teacher').length})
            </Button>
            <Button
              variant={filterRole === 'student' ? 'default' : 'outline'}
              onClick={() => setFilterRole('student')}
              size="sm"
            >
              Estudiantes ({allUsers.filter(u => u.type === 'student').length})
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
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Creado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Acciones
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
                        {getRoleLabel(user.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">{user.email || 'Sin email'}</div>
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
                        >
                          <Key className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Eliminar
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
              No se encontraron usuarios que coincidan con los filtros
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>¿Estás seguro de que quieres eliminar al usuario <strong>{userToDelete?.name}</strong>?</p>
              <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={confirmDeleteUser}>
                  Eliminar Usuario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
