/**
 * Tipos para el sistema educativo
 */

export interface Course {
  id: string;
  uniqueCode: string;
  name: string;
  level: 'basica' | 'media';
  description?: string;
  sections: Section[];
  subjects: Subject[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Section {
  id: string;
  uniqueCode: string;
  name: string;
  courseId: string;
  studentCount: number;
  maxStudents?: number;
  subjects: SubjectSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Subject {
  id: string;
  uniqueCode: string;
  name: string;
  abbreviation?: string;
  description?: string;
  courseId: string;
  color?: string;
  bgColor?: string;
  textColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectSection {
  subjectId: string;
  sectionId: string;
  teacherId?: string;
  isActive: boolean;
}

export interface Student {
  id: string;
  uniqueCode: string;
  username: string;
  name: string;
  email: string;
  courseId?: string;
  sectionId?: string;
  role: 'student';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Teacher {
  id: string;
  uniqueCode: string;
  username: string;
  name: string;
  email: string;
  role: 'teacher';
  isActive: boolean;
  assignedSections: TeacherAssignment[];
  // Campos adicionales para el formulario
  preferredCourseId?: string; // Para almacenar el curso preferido
  selectedSubjects?: string[]; // Para almacenar las asignaturas seleccionadas
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherAssignment {
  teacherId: string;
  sectionId: string;
  subjectId: string;
  isActive: boolean;
  assignedAt: Date;
}

export interface UserFormData {
  username: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'teacher' | 'admin';
  courseId?: string;
  sectionId?: string;
}

export interface AssignmentData {
  type: 'student' | 'teacher';
  userId: string;
  courseId?: string;
  sectionId?: string;
  subjectIds?: string[];
}

export interface SystemConfig {
  allowMultipleTeachersPerSubject: boolean;
  maxStudentsPerSection: number;
  autoGenerateUsernames: boolean;
  defaultPasswordLength: number;
}
