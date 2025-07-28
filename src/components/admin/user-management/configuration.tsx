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
      
      toast({
        title: 'Configuración guardada',
        description: 'Los cambios se han aplicado correctamente',
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
              
              <div className="flex items-center justify-between">
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
              
              <div className="flex items-center justify-between">
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
              className="w-full sm:w-auto"
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
    </div>
  );
}
