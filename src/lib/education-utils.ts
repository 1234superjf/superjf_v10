/**
 * Utilidades para generar códigos únicos del sistema educativo
 */

import { Course, Section } from '@/types/education';

export class EducationCodeGenerator {
  private static generateCode(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `${prefix}-${timestamp}${random}`.toUpperCase().substring(0, 12);
  }

  static generateCourseCode(): string {
    return this.generateCode('CRS');
  }

  static generateSectionCode(): string {
    return this.generateCode('SEC');
  }

  static generateSubjectCode(): string {
    return this.generateCode('SUB');
  }

  static generateStudentCode(): string {
    return this.generateCode('STU');
  }

  static generateTeacherCode(): string {
    return this.generateCode('TCH');
  }

  static validateCode(code: string, expectedPrefix: string): boolean {
    const regex = new RegExp(`^${expectedPrefix}-[A-Z0-9]{5,8}$`);
    return regex.test(code);
  }
}

/**
 * Utilidades para validación de formularios
 */
export class FormValidation {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 4) {
      errors.push('La contraseña debe tener al menos 4 caracteres');
    }

    // Removed uppercase requirement
    // Removed lowercase requirement  
    // Removed number requirement for more flexible passwords

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateName(name: string): boolean {
    return name.trim().length >= 2 && /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name);
  }
}

/**
 * Utilidades para manejo de datos locales
 */
export class LocalStorageManager {
  private static readonly KEYS = {
    COURSES: 'smart-student-courses',
    SECTIONS: 'smart-student-sections',
    SUBJECTS: 'smart-student-subjects',
    STUDENTS: 'smart-student-students',
    TEACHERS: 'smart-student-teachers',
    ASSIGNMENTS: 'smart-student-assignments',
    CONFIG: 'smart-student-config'
  };

  static getCourses() {
    return JSON.parse(localStorage.getItem(this.KEYS.COURSES) || '[]');
  }

  static setCourses(courses: any[]) {
    localStorage.setItem(this.KEYS.COURSES, JSON.stringify(courses));
  }

  static getSections() {
    return JSON.parse(localStorage.getItem(this.KEYS.SECTIONS) || '[]');
  }

  static setSections(sections: any[]) {
    localStorage.setItem(this.KEYS.SECTIONS, JSON.stringify(sections));
  }

  static getSubjects() {
    return JSON.parse(localStorage.getItem(this.KEYS.SUBJECTS) || '[]');
  }

  static setSubjects(subjects: any[]) {
    localStorage.setItem(this.KEYS.SUBJECTS, JSON.stringify(subjects));
  }

  static getStudents() {
    return JSON.parse(localStorage.getItem(this.KEYS.STUDENTS) || '[]');
  }

  static setStudents(students: any[]) {
    localStorage.setItem(this.KEYS.STUDENTS, JSON.stringify(students));
  }

  static getTeachers() {
    return JSON.parse(localStorage.getItem(this.KEYS.TEACHERS) || '[]');
  }

  static setTeachers(teachers: any[]) {
    localStorage.setItem(this.KEYS.TEACHERS, JSON.stringify(teachers));
  }

  static getAssignments() {
    return JSON.parse(localStorage.getItem(this.KEYS.ASSIGNMENTS) || '[]');
  }

  static setAssignments(assignments: any[]) {
    localStorage.setItem(this.KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  }

  static getConfig() {
    return JSON.parse(localStorage.getItem(this.KEYS.CONFIG) || '{}');
  }

  static setConfig(config: any) {
    localStorage.setItem(this.KEYS.CONFIG, JSON.stringify(config));
  }

  /**
   * Debug: Mostrar contenido del localStorage
   */
  static debugLocalStorage() {
    console.log('=== DEBUG LOCALSTORAGE ===');
    const courses = this.getCourses();
    const sections = this.getSections();
    const subjects = this.getSubjects();
    
    console.log('Raw localStorage courses:', localStorage.getItem(this.KEYS.COURSES));
    console.log('Raw localStorage sections:', localStorage.getItem(this.KEYS.SECTIONS));
    
    console.log('Parsed courses:', courses);
    console.log('Parsed sections:', sections);
    console.log('Parsed subjects:', subjects);
    
    courses.forEach((course: any, index: number) => {
      console.log(`Course ${index}:`, {
        id: course.id,
        name: course.name,
        level: course.level,
        type: typeof course.level
      });
    });
    
    return { courses, sections, subjects };
  }
}

/**
 * Generador de nombres de usuario automáticos
 */
export class UsernameGenerator {
  static generateFromName(name: string, role: 'student' | 'teacher'): string {
    const cleanName = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z\s]/g, '') // Remove special characters
      .trim();

    const parts = cleanName.split(' ');
    let username = '';

    if (parts.length >= 2) {
      // FirstName + LastName
      username = parts[0] + parts[parts.length - 1];
    } else {
      // Single name
      username = parts[0];
    }

    // Add role prefix
    const prefix = role === 'student' ? 'est' : 'prof';
    username = prefix + username;

    // Add random number to ensure uniqueness
    const random = Math.floor(Math.random() * 999) + 1;
    username += random.toString().padStart(3, '0');

    return username.substring(0, 20); // Limit length
  }

  static generateRandomPassword(length: number = 8): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    
    // Ensure at least one uppercase, one lowercase, and one number
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

/**
 * Utilidades para automatización del sistema educativo
 */
export class EducationAutomation {
  /**
   * Crear secciones A y B para TODOS los cursos (versión de corrección)
   */
  static forceCreateSectionsForAllCourses(): { success: boolean; created: number; message: string } {
    try {
      const courses = LocalStorageManager.getCourses();
      const existingSections = LocalStorageManager.getSections();
      const newSections = [];
      let createdCount = 0;

      console.log('FORCE MODE - Total courses found:', courses.length);
      console.log('FORCE MODE - Existing sections:', existingSections.length);

      // Procesar TODOS los cursos sin filtrar por nivel
      for (const course of courses) {
        console.log(`Processing course: ${course.name}, level: ${course.level}`);
        
        // Verificar si ya existen secciones A y B para este curso
        const courseSections = existingSections.filter((section: Section) => section.courseId === course.id);
        const hasASection = courseSections.some((section: Section) => section.name === 'A');
        const hasBSection = courseSections.some((section: Section) => section.name === 'B');

        console.log(`Course ${course.name}: has A=${hasASection}, has B=${hasBSection}`);

        // Crear sección A si no existe
        if (!hasASection) {
          const sectionA = {
            id: crypto.randomUUID(),
            uniqueCode: EducationCodeGenerator.generateSectionCode(),
            name: 'A',
            courseId: course.id,
            studentCount: 0,
            maxStudents: 30,
            subjects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          newSections.push(sectionA);
          createdCount++;
          console.log(`FORCE CREATED section A for ${course.name}`);
        }

        // Crear sección B si no existe
        if (!hasBSection) {
          const sectionB = {
            id: crypto.randomUUID(),
            uniqueCode: EducationCodeGenerator.generateSectionCode(),
            name: 'B',
            courseId: course.id,
            studentCount: 0,
            maxStudents: 30,
            subjects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          newSections.push(sectionB);
          createdCount++;
          console.log(`FORCE CREATED section B for ${course.name}`);
        }
      }

      console.log(`FORCE MODE - Total sections to create: ${newSections.length}`);

      // Guardar las nuevas secciones
      if (newSections.length > 0) {
        const allSections = [...existingSections, ...newSections];
        LocalStorageManager.setSections(allSections);
        console.log('FORCE MODE - Sections saved to localStorage');
      }

      return {
        success: true,
        created: createdCount,
        message: `FORZADO: Se crearon ${createdCount} secciones para ${courses.length} cursos`
      };

    } catch (error: any) {
      console.error('Error in forceCreateSectionsForAllCourses:', error);
      return {
        success: false,
        created: 0,
        message: 'Error en modo forzado'
      };
    }
  }
  static createStandardSections(): { success: boolean; created: number; message: string } {
    try {
      const courses = LocalStorageManager.getCourses();
      const existingSections = LocalStorageManager.getSections();
      const newSections = [];
      let createdCount = 0;

      console.log('Total courses found:', courses.length);
      console.log('Existing sections:', existingSections.length);

      // Filtrar cursos de básica y media
      const basicaMediaCourses = courses.filter((course: Course) => 
        course.level === 'basica' || course.level === 'media'
      );

      console.log('Basica/Media courses:', basicaMediaCourses.length);
      console.log('Courses:', basicaMediaCourses.map((c: Course) => ({ name: c.name, level: c.level })));

      for (const course of basicaMediaCourses) {
        // Verificar si ya existen secciones A y B para este curso
        const courseSections = existingSections.filter((section: Section) => section.courseId === course.id);
        const hasASection = courseSections.some((section: Section) => section.name === 'A');
        const hasBSection = courseSections.some((section: Section) => section.name === 'B');

        console.log(`Course ${course.name}: has A=${hasASection}, has B=${hasBSection}`);

        // Crear sección A si no existe
        if (!hasASection) {
          const sectionA = {
            id: crypto.randomUUID(),
            uniqueCode: EducationCodeGenerator.generateSectionCode(),
            name: 'A',
            courseId: course.id,
            studentCount: 0,
            maxStudents: 30,
            subjects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          newSections.push(sectionA);
          createdCount++;
          console.log(`Created section A for ${course.name}`);
        }

        // Crear sección B si no existe
        if (!hasBSection) {
          const sectionB = {
            id: crypto.randomUUID(),
            uniqueCode: EducationCodeGenerator.generateSectionCode(),
            name: 'B',
            courseId: course.id,
            studentCount: 0,
            maxStudents: 30,
            subjects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          newSections.push(sectionB);
          createdCount++;
          console.log(`Created section B for ${course.name}`);
        }
      }

      console.log(`Total sections to create: ${newSections.length}`);

      // Guardar las nuevas secciones
      if (newSections.length > 0) {
        const allSections = [...existingSections, ...newSections];
        LocalStorageManager.setSections(allSections);
      }

      return {
        success: true,
        created: createdCount,
        message: `Se crearon ${createdCount} secciones para ${basicaMediaCourses.length} cursos`
      };

    } catch (error: any) {
      console.error('Error creating standard sections:', error);
      return {
        success: false,
        created: 0,
        message: 'Error al crear las secciones automáticas'
      };
    }
  }

  /**
   * Obtener estadísticas de secciones por curso
   */
  static getSectionStats(): { courseId: string; courseName: string; sectionsCount: number; hasAB: boolean }[] {
    const courses = LocalStorageManager.getCourses();
    const sections = LocalStorageManager.getSections();

    return courses.map((course: Course) => {
      const courseSections = sections.filter((section: Section) => section.courseId === course.id);
      const hasA = courseSections.some((section: Section) => section.name === 'A');
      const hasB = courseSections.some((section: Section) => section.name === 'B');

      return {
        courseId: course.id,
        courseName: course.name,
        sectionsCount: courseSections.length,
        hasAB: hasA && hasB
      };
    });
  }

  /**
   * Crear cursos estándar del sistema educativo chileno
   */
  static createStandardCourses(): { success: boolean; created: number; message: string } {
    try {
      const existingCourses = LocalStorageManager.getCourses();
      const newCourses = [];

      // Cursos de Educación Básica
      const basicaCourses = [
        '1ro Básico', '2do Básico', '3ro Básico', '4to Básico',
        '5to Básico', '6to Básico', '7mo Básico', '8vo Básico'
      ];

      // Cursos de Educación Media
      const mediaCourses = [
        '1ro Medio', '2do Medio', '3ro Medio', '4to Medio'
      ];

      // Crear cursos de básica
      for (const courseName of basicaCourses) {
        const exists = existingCourses.some((course: Course) => course.name === courseName);
        if (!exists) {
          const newCourse = {
            id: crypto.randomUUID(),
            uniqueCode: EducationCodeGenerator.generateCourseCode(),
            name: courseName,
            level: 'basica' as const,
            description: `Curso de ${courseName} - Educación Básica`,
            sections: [],
            subjects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          newCourses.push(newCourse);
        }
      }

      // Crear cursos de media
      for (const courseName of mediaCourses) {
        const exists = existingCourses.some((course: Course) => course.name === courseName);
        if (!exists) {
          const newCourse = {
            id: crypto.randomUUID(),
            uniqueCode: EducationCodeGenerator.generateCourseCode(),
            name: courseName,
            level: 'media' as const,
            description: `Curso de ${courseName} - Educación Media`,
            sections: [],
            subjects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          newCourses.push(newCourse);
        }
      }

      // Guardar los nuevos cursos
      if (newCourses.length > 0) {
        const allCourses = [...existingCourses, ...newCourses];
        LocalStorageManager.setCourses(allCourses);
      }

      return {
        success: true,
        created: newCourses.length,
        message: `Se crearon ${newCourses.length} cursos estándar`
      };

    } catch (error) {
      console.error('Error creating standard courses:', error);
      return {
        success: false,
        created: 0,
        message: 'Error al crear los cursos estándar'
      };
    }
  }

  /**
   * Recalcula los contadores de estudiantes en todas las secciones
   */
  static recalculateSectionCounts(): { success: boolean; message: string; updated: number } {
    try {
      const students = LocalStorageManager.getStudents();
      const sections = LocalStorageManager.getSections();

      // Resetear todos los contadores a 0
      const updatedSections = sections.map((section: any) => ({
        ...section,
        studentCount: 0
      }));

      // Contar estudiantes por sección
      students.forEach((student: any) => {
        if (student.sectionId) {
          const sectionIndex = updatedSections.findIndex((s: any) => s.id === student.sectionId);
          if (sectionIndex !== -1) {
            updatedSections[sectionIndex].studentCount++;
          }
        }
      });

      // Guardar las secciones actualizadas
      LocalStorageManager.setSections(updatedSections);

      return {
        success: true,
        updated: updatedSections.length,
        message: `Se recalcularon los contadores de ${updatedSections.length} secciones`
      };

    } catch (error) {
      console.error('Error recalculating section counts:', error);
      return {
        success: false,
        updated: 0,
        message: 'Error al recalcular los contadores'
      };
    }
  }
}
