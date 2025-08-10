/**
 * SISTEMA DE EXPORTACIÓN MEJORADA CON CONFIGURACIÓN DE ASIGNACIONES
 * Smart Student v8 - Solución de persistencia completa
 * 
 * Este script mejora el sistema de exportación/importación para incluir
 * automáticamente la configuración de asignaciones, evitando que el problema
 * se repita tras importar una base de datos.
 * 
 * FUNCIONALIDADES:
 * ✅ Exportación enriquecida con metadatos de asignaciones
 * ✅ Importación con aplicación automática de configuración
 * ✅ Validador post-importación automático
 * ✅ Sistema de versiones para compatibilidad
 * ✅ Auto-reparación en caso de inconsistencias
 * 
 * RESULTADO: El problema no vuelve a ocurrir tras exportar/importar
 */

(function() {
    'use strict';
    
    console.log('📦 [EXPORTACIÓN MEJORADA] Iniciando sistema de exportación con asignaciones...');
    
    // ==================== CONFIGURACIÓN DE VERSIONES ====================
    
    const VERSION_EXPORTACION = '2.2.0';
    const VERSIONES_COMPATIBLES = ['1.0.0', '2.0.0', '2.1.0', '2.2.0'];
    
    /**
     * Genera metadatos completos para la exportación
     */
    function generarMetadatosExportacion() {
        const fechaExportacion = new Date().toISOString();
        const configuracion = obtenerConfiguracionCompleta();
        
        return {
            version: VERSION_EXPORTACION,
            fechaExportacion,
            tipoExportacion: 'completa-con-asignaciones',
            estadisticas: {
                usuarios: configuracion.usuarios.length,
                estudiantes: configuracion.estudiantes.length,
                profesores: configuracion.profesores.length,
                administradores: configuracion.administradores.length,
                cursos: configuracion.cursos.length,
                secciones: configuracion.secciones.length,
                asignacionesEstudiantes: configuracion.asignacionesEstudiantes.length,
                asignacionesProfesores: configuracion.asignacionesProfesores.length,
                comunicaciones: (configuracion.comunicaciones || []).length,
                tareas: configuracion.tareas.length,
                comentariosTarea: configuracion.comentariosTarea.length,
                notificacionesTarea: configuracion.notificacionesTarea.length,
                evaluaciones: configuracion.evaluaciones.length,
                resultadosEvaluacion: configuracion.resultadosEvaluacion.length,
                registrosAsistencia: configuracion.asistencia.length
            },
            configuracionSistema: obtenerConfiguracionSistema(),
            validacionIntegridad: generarHashIntegridad(configuracion)
        };
    }
    
    /**
     * Obtiene toda la configuración del sistema de forma completa
     */
    function obtenerConfiguracionCompleta() {
        try {
            const usuarios = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
            const cursos = JSON.parse(localStorage.getItem('smart-student-courses') || '[]');
            const secciones = JSON.parse(localStorage.getItem('smart-student-sections') || '[]');
            const materias = JSON.parse(localStorage.getItem('smart-student-subjects') || '[]');
            const asignacionesEstudiantes = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
            const asignacionesProfesores = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
            const administradores = JSON.parse(localStorage.getItem('smart-student-administrators') || '[]');
            const configuracionSistema = JSON.parse(localStorage.getItem('smart-student-config') || '{}');
            // Nuevas colecciones
            const comunicaciones = JSON.parse(localStorage.getItem('smart-student-communications') || '[]');
            const tareas = JSON.parse(localStorage.getItem('smart-student-tasks') || '[]');
            const comentariosTarea = JSON.parse(localStorage.getItem('smart-student-task-comments') || '[]');
            const notificacionesTarea = JSON.parse(localStorage.getItem('smart-student-task-notifications') || '[]');
            const evaluaciones = JSON.parse(localStorage.getItem('smart-student-evaluations') || '[]');
            const resultadosEvaluacion = JSON.parse(localStorage.getItem('smart-student-evaluation-results') || '[]');
            const asistencia = JSON.parse(localStorage.getItem('smart-student-attendance') || '[]');

            // NUEVO: Pruebas creadas por profesores (almacenadas por usuario)
            const pruebasPorUsuario = recolectarPruebasPorUsuario();
            const totalPruebas = Object.values(pruebasPorUsuario).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
            
            return {
                usuarios,
                estudiantes: usuarios.filter(u => u.role === 'student' || u.role === 'estudiante'),
                profesores: usuarios.filter(u => u.role === 'teacher' || u.role === 'profesor'),
                administradores,
                cursos,
                secciones,
                materias,
                asignacionesEstudiantes,
                asignacionesProfesores,
                configuracionSistema,
                // Nuevas colecciones
                comunicaciones,
                tareas,
                comentariosTarea,
                notificacionesTarea,
                evaluaciones,
                resultadosEvaluacion,
                asistencia,
                // Nueva colección exportable
                pruebasPorUsuario,
                totalPruebas
            };
        } catch (error) {
            console.error('❌ [ERROR] Error al obtener configuración completa:', error);
            return {};
        }
    }

    /**
     * Recolecta todas las pruebas de profesores guardadas por usuario.
     * Busca en localStorage claves con prefijo 'smart-student-tests' y arma un diccionario { username: TestItem[] }.
     */
    function recolectarPruebasPorUsuario() {
        const PREFIJO = 'smart-student-tests';
        const mapa = {};
        try {
            // 1) Recorremos todas las claves y tomamos las que correspondan
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (key === PREFIJO || key.startsWith(PREFIJO + '_')) {
                    const data = JSON.parse(localStorage.getItem(key) || '[]');
                    // Caso: clave global sin sufijo → intentar inferir username por owner
                    if (key === PREFIJO) {
                        if (Array.isArray(data)) {
                            data.forEach(item => {
                                const userKey = normalizarUsername(item?.ownerUsername) || 'global';
                                if (!mapa[userKey]) mapa[userKey] = [];
                                mapa[userKey].push(item);
                            });
                        }
                    } else {
                        // Clave por usuario: smart-student-tests_username
                        const username = key.substring(PREFIJO.length + 1);
                        const userKey = normalizarUsername(username) || 'global';
                        mapa[userKey] = Array.isArray(data) ? data : [];
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ [EXPORT] No se pudo recolectar pruebas por usuario:', e);
        }
        return mapa;
    }

    function normalizarUsername(u) {
        if (!u) return '';
        try { return String(u).trim().toLowerCase(); } catch { return ''; }
    }
    
    /**
     * Obtiene la configuración del sistema
     */
    function obtenerConfiguracionSistema() {
        try {
            return JSON.parse(localStorage.getItem('smart-student-config') || '{}');
        } catch (error) {
            return {};
        }
    }
    
    /**
     * Genera un hash de integridad para validar la exportación
     */
    function generarHashIntegridad(configuracion) {
        const datosIntegridad = {
            usuariosCount: configuracion.usuarios.length,
            cursosCount: configuracion.cursos.length,
            seccionesCount: configuracion.secciones.length,
            asignacionesCount: configuracion.asignacionesEstudiantes.length,
            pruebasProfesores: configuracion.totalPruebas || 0
        };
        
        // Hash simple basado en counts y timestamp
        const hash = btoa(JSON.stringify(datosIntegridad) + Date.now()).substring(0, 16);
        return hash;
    }
    
    // ==================== FUNCIONES DE EXPORTACIÓN ====================
    
    /**
     * Exporta toda la base de datos con configuración de asignaciones incluida
     */
    function exportarBBDDConAsignaciones() {
        console.log('📤 [EXPORTACIÓN] Iniciando exportación completa con asignaciones...');
        
        try {
            // Paso 1: Obtener configuración completa
            const configuracion = obtenerConfiguracionCompleta();
            
            // Paso 2: Verificar que hay datos para exportar
            if (configuracion.usuarios.length === 0) {
                throw new Error('No hay datos de usuarios para exportar');
            }
            
            // Paso 3: Aplicar corrección dinámica antes de exportar
            console.log('🔄 [PRE-EXPORTACIÓN] Aplicando corrección dinámica antes de exportar...');
            aplicarCorreccionPreExportacion(configuracion);
            
            // Paso 4: Recargar configuración actualizada
            const configuracionActualizada = obtenerConfiguracionCompleta();
            
            // Paso 5: Preparar datos de exportación con enriquecimiento
            const datosExportacion = {
                // Metadatos de la exportación
                metadatos: generarMetadatosExportacion(),
                
                // Datos principales
                'smart-student-users': configuracionActualizada.usuarios,
                'smart-student-courses': configuracionActualizada.cursos,
                'smart-student-sections': configuracionActualizada.secciones,
                'smart-student-subjects': configuracionActualizada.materias,
                'smart-student-administrators': configuracionActualizada.administradores,
                'smart-student-config': configuracionActualizada.configuracionSistema,
                
                // NOVEDAD: Configuración de asignaciones incluida
                'smart-student-student-assignments': configuracionActualizada.asignacionesEstudiantes,
                'smart-student-teacher-assignments': configuracionActualizada.asignacionesProfesores,
                
                // NUEVO: Datos académicos adicionales
                'smart-student-communications': configuracionActualizada.comunicaciones,
                'smart-student-tasks': configuracionActualizada.tareas,
                'smart-student-task-comments': configuracionActualizada.comentariosTarea,
                'smart-student-task-notifications': configuracionActualizada.notificacionesTarea,
                'smart-student-evaluations': configuracionActualizada.evaluaciones,
                'smart-student-evaluation-results': configuracionActualizada.resultadosEvaluacion,
                'smart-student-attendance': configuracionActualizada.asistencia,
                
                // NUEVO: Pruebas por profesor (diccionario username -> TestItem[])
                'smart-student-tests-by-user': configuracionActualizada.pruebasPorUsuario,
                
                // Configuración de mapeo dinámico
                configuracionAsignaciones: {
                    mapeoEstudiantesSeccion: generarMapeoEstudiantesSeccion(configuracionActualizada),
                    mapleoProfesoresSeccion: generarMapeoProfesoresSeccion(configuracionActualizada),
                    reglasAsignacion: obtenerReglasAsignacion()
                }
            };
            
            // Paso 6: Validar integridad de datos
            const validacion = validarIntegridadExportacion(datosExportacion);
            if (!validacion.esValido) {
                console.warn('⚠️ [ADVERTENCIA] Problemas de integridad detectados:', validacion.problemas);
            }
            
            // Paso 7: Crear archivo de exportación
            const nombreArchivo = `smart-student-backup-complete-${new Date().toISOString().split('T')[0]}.json`;
            const blob = new Blob([JSON.stringify(datosExportacion, null, 2)], { type: 'application/json' });
            
            // Paso 8: Descargar archivo
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreArchivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ [EXPORTACIÓN EXITOSA] Base de datos exportada con asignaciones incluidas');
            console.log(`📁 Archivo generado: ${nombreArchivo}`);
            console.log('📊 Estadísticas de exportación:', datosExportacion.metadatos.estadisticas);
            
            return {
                exito: true,
                archivo: nombreArchivo,
                estadisticas: datosExportacion.metadatos.estadisticas,
                mensaje: 'Exportación completa con asignaciones exitosa'
            };
            
        } catch (error) {
            console.error('❌ [ERROR EXPORTACIÓN] Error durante la exportación:', error);
            return {
                exito: false,
                error: error.message,
                mensaje: 'Error durante la exportación'
            };
        }
    }
    
    /**
     * Aplica corrección dinámica antes de exportar para asegurar consistencia
     */
    function aplicarCorreccionPreExportacion(configuracion) {
        console.log('🔧 [PRE-EXPORTACIÓN] Aplicando corrección dinámica...');
        
        // Si existe el script de corrección dinámica, ejecutarlo
        if (typeof window.regenerarAsignacionesDinamicas === 'function') {
            window.regenerarAsignacionesDinamicas();
        } else {
            // Aplicar corrección básica
            aplicarCorreccionBasica(configuracion);
        }
    }
    
    /**
     * Aplica una corrección básica si no está disponible la función dinámica
     */
    function aplicarCorreccionBasica(configuracion) {
        console.log('🔧 [CORRECCIÓN BÁSICA] Aplicando asignaciones básicas...');
        
        const asignacionesEstudiantes = [];
        
        configuracion.estudiantes.forEach(estudiante => {
            if (estudiante.courseId && estudiante.sectionId) {
                asignacionesEstudiantes.push({
                    id: `${estudiante.id}-${estudiante.sectionId}-${Date.now()}`,
                    studentId: estudiante.id,
                    courseId: estudiante.courseId,
                    sectionId: estudiante.sectionId,
                    assignedAt: new Date().toISOString(),
                    isActive: true
                });
            }
        });
        
        localStorage.setItem('smart-student-student-assignments', JSON.stringify(asignacionesEstudiantes));
        console.log(`✅ [CORRECCIÓN BÁSICA] ${asignacionesEstudiantes.length} asignaciones aplicadas`);
    }
    
    /**
     * Genera mapeo de estudiantes a secciones para incluir en la exportación
     */
    function generarMapeoEstudiantesSeccion(configuracion) {
        const mapeo = {};
        
        configuracion.asignacionesEstudiantes.forEach(asignacion => {
            if (!mapeo[asignacion.sectionId]) {
                mapeo[asignacion.sectionId] = [];
            }
            mapeo[asignacion.sectionId].push({
                studentId: asignacion.studentId,
                courseId: asignacion.courseId,
                assignedAt: asignacion.assignedAt
            });
        });
        
        return mapeo;
    }
    
    /**
     * Genera mapeo de profesores a secciones
     */
    function generarMapeoProfesoresSeccion(configuracion) {
        const mapeo = {};
        
        configuracion.asignacionesProfesores.forEach(asignacion => {
            if (!mapeo[asignacion.sectionId]) {
                mapeo[asignacion.sectionId] = [];
            }
            mapeo[asignacion.sectionId].push({
                teacherId: asignacion.teacherId,
                subjectName: asignacion.subjectName,
                assignedAt: asignacion.assignedAt
            });
        });
        
        return mapeo;
    }
    
    /**
     * Obtiene las reglas de asignación configuradas
     */
    function obtenerReglasAsignacion() {
        return {
            maxEstudiantesPorSeccion: 30,
            permitirMultiplesProfesoresPorMateria: false,
            asignacionAutomatica: true,
            validarConsistenciaAlImportar: true
        };
    }
    
    /**
     * Valida la integridad de los datos de exportación
     */
    function validarIntegridadExportacion(datosExportacion) {
        const problemas = [];
        
        // Validar que hay usuarios
        if (!datosExportacion['smart-student-users'] || datosExportacion['smart-student-users'].length === 0) {
            problemas.push('No hay usuarios en la exportación');
        }
        
        // Validar que hay asignaciones
        if (!datosExportacion['smart-student-student-assignments'] || datosExportacion['smart-student-student-assignments'].length === 0) {
            problemas.push('No hay asignaciones de estudiantes en la exportación');
        }
        
        // Validar consistencia de asignaciones
        const usuarios = datosExportacion['smart-student-users'] || [];
        const asignaciones = datosExportacion['smart-student-student-assignments'] || [];
        
        const estudiantesIds = usuarios.filter(u => u.role === 'student' || u.role === 'estudiante').map(u => u.id);
        const estudiantesConAsignacion = asignaciones.map(a => a.studentId);
        
        const estudiantesSinAsignacion = estudiantesIds.filter(id => !estudiantesConAsignacion.includes(id));
        if (estudiantesSinAsignacion.length > 0) {
            problemas.push(`${estudiantesSinAsignacion.length} estudiantes sin asignación`);
        }
        
        return {
            esValido: problemas.length === 0,
            problemas
        };
    }
    
    // ==================== FUNCIONES DE IMPORTACIÓN ====================
    
    /**
     * Importa base de datos con aplicación automática de asignaciones
     */
    function importarBBDDConAsignaciones(archivoContent) {
        console.log('📥 [IMPORTACIÓN] Iniciando importación con aplicación automática de asignaciones...');
        
        try {
            // Paso 1: Parsear datos del archivo
            const datosImportacion = JSON.parse(archivoContent);
            
            // Paso 2: Validar compatibilidad de versión
            const validacionVersion = validarVersionCompatible(datosImportacion);
            if (!validacionVersion.esCompatible) {
                console.warn('⚠️ [VERSIÓN] Problema de compatibilidad:', validacionVersion.mensaje);
            }
            
            // Paso 3: Aplicar datos al localStorage
            aplicarDatosImportacion(datosImportacion);
            
            // Paso 4: Aplicar configuración de asignaciones si está disponible
            if (datosImportacion.configuracionAsignaciones) {
                console.log('🎯 [CONFIGURACIÓN] Aplicando configuración de asignaciones...');
                aplicarConfiguracionAsignaciones(datosImportacion.configuracionAsignaciones);
            }
            
            // Paso 5: Validación post-importación automática
            const validacionPost = validarPostImportacion();
            if (!validacionPost.esValido) {
                console.warn('⚠️ [POST-VALIDACIÓN] Problemas detectados:', validacionPost.problemas);
                
                // Auto-reparación en caso de problemas
                console.log('🔧 [AUTO-REPARACIÓN] Aplicando corrección automática...');
                aplicarAutoReparacion();
            }
            
            console.log('✅ [IMPORTACIÓN EXITOSA] Base de datos importada con asignaciones aplicadas');
            
            return {
                exito: true,
                mensaje: 'Importación completa con asignaciones exitosa',
                estadisticas: obtenerEstadisticasPostImportacion()
            };
            
        } catch (error) {
            console.error('❌ [ERROR IMPORTACIÓN] Error durante la importación:', error);
            return {
                exito: false,
                error: error.message,
                mensaje: 'Error durante la importación'
            };
        }
    }
    
    /**
     * Valida si la versión del archivo es compatible
     */
    function validarVersionCompatible(datosImportacion) {
        if (!datosImportacion.metadatos || !datosImportacion.metadatos.version) {
            return {
                esCompatible: true,
                mensaje: 'Archivo sin metadatos de versión, asumiendo compatibilidad'
            };
        }
        
        const versionArchivo = datosImportacion.metadatos.version;
        if (VERSIONES_COMPATIBLES.includes(versionArchivo)) {
            return {
                esCompatible: true,
                mensaje: `Versión ${versionArchivo} compatible`
            };
        }
        
        return {
            esCompatible: false,
            mensaje: `Versión ${versionArchivo} no compatible. Versiones soportadas: ${VERSIONES_COMPATIBLES.join(', ')}`
        };
    }
    
    /**
     * Aplica los datos de importación al localStorage
     */
    function aplicarDatosImportacion(datosImportacion) {
        console.log('💾 [APLICACIÓN] Aplicando datos importados al localStorage...');
        
    const claves = [
            'smart-student-users',
            'smart-student-courses',
            'smart-student-sections',
            'smart-student-subjects',
            'smart-student-administrators',
            'smart-student-config',
            'smart-student-student-assignments',
            'smart-student-teacher-assignments',
            // Nuevas colecciones
            'smart-student-communications',
            'smart-student-tasks',
            'smart-student-task-comments',
            'smart-student-task-notifications',
            'smart-student-evaluations',
            'smart-student-evaluation-results',
            'smart-student-attendance'
        ];
        
        claves.forEach(clave => {
            if (datosImportacion[clave]) {
                localStorage.setItem(clave, JSON.stringify(datosImportacion[clave]));
                console.log(`   ✅ ${clave}: ${datosImportacion[clave].length || 'aplicado'}`);
            }
        });

        // Restaurar pruebas por usuario
        try {
            const testsByUser = datosImportacion['smart-student-tests-by-user'];
            if (testsByUser && typeof testsByUser === 'object') {
                const PREFIJO = 'smart-student-tests';
                Object.keys(testsByUser).forEach(username => {
                    const userKey = (username && username !== 'global') ? `${PREFIJO}_${username}` : PREFIJO;
                    const arr = Array.isArray(testsByUser[username]) ? testsByUser[username] : [];
                    localStorage.setItem(userKey, JSON.stringify(arr));
                    console.log(`   ✅ ${userKey}: ${arr.length}`);
                });
            }
        } catch (e) {
            console.warn('⚠️ [IMPORT] No se pudieron restaurar las pruebas por usuario:', e);
        }
    }
    
    /**
     * Aplica la configuración específica de asignaciones
     */
    function aplicarConfiguracionAsignaciones(configuracionAsignaciones) {
        // Aplicar reglas de asignación
        if (configuracionAsignaciones.reglasAsignacion) {
            const configActual = JSON.parse(localStorage.getItem('smart-student-config') || '{}');
            const configActualizada = {
                ...configActual,
                ...configuracionAsignaciones.reglasAsignacion
            };
            localStorage.setItem('smart-student-config', JSON.stringify(configActualizada));
        }
        
        console.log('✅ [CONFIGURACIÓN] Configuración de asignaciones aplicada');
    }
    
    /**
     * Valida el estado del sistema después de la importación
     */
    function validarPostImportacion() {
        const problemas = [];
        
        try {
            const usuarios = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
            const asignacionesEstudiantes = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
            const asignacionesProfesores = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
            
            // Validar que hay datos
            if (usuarios.length === 0) {
                problemas.push('No hay usuarios después de la importación');
            }
            
            if (asignacionesEstudiantes.length === 0) {
                problemas.push('No hay asignaciones de estudiantes después de la importación');
            }
            
            // Validar consistencia
            const estudiantes = usuarios.filter(u => u.role === 'student' || u.role === 'estudiante');
            const estudiantesAsignados = asignacionesEstudiantes.map(a => a.studentId);
            const estudiantesSinAsignacion = estudiantes.filter(e => !estudiantesAsignados.includes(e.id));
            
            if (estudiantesSinAsignacion.length > 0) {
                problemas.push(`${estudiantesSinAsignacion.length} estudiantes sin asignación después de importar`);
            }
            
        } catch (error) {
            problemas.push('Error al validar datos después de la importación: ' + error.message);
        }
        
        return {
            esValido: problemas.length === 0,
            problemas
        };
    }
    
    /**
     * Aplica auto-reparación en caso de problemas post-importación
     */
    function aplicarAutoReparacion() {
        console.log('🔧 [AUTO-REPARACIÓN] Iniciando auto-reparación...');
        
        // Si está disponible la función de corrección dinámica, usarla
        if (typeof window.regenerarAsignacionesDinamicas === 'function') {
            window.regenerarAsignacionesDinamicas();
        } else {
            // Aplicar reparación básica
            aplicarReparacionBasica();
        }
        
        console.log('✅ [AUTO-REPARACIÓN] Auto-reparación completada');
    }
    
    /**
     * Aplica una reparación básica del sistema
     */
    function aplicarReparacionBasica() {
        try {
            const usuarios = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
            const estudiantes = usuarios.filter(u => u.role === 'student' || u.role === 'estudiante');
            
            const asignacionesReparacion = estudiantes.map((estudiante, index) => ({
                id: `repair-${estudiante.id}-${Date.now()}-${index}`,
                studentId: estudiante.id,
                courseId: estudiante.courseId || 'default-course',
                sectionId: estudiante.sectionId || 'default-section',
                assignedAt: new Date().toISOString(),
                isActive: true
            })).filter(a => a.courseId !== 'default-course' && a.sectionId !== 'default-section');
            
            if (asignacionesReparacion.length > 0) {
                localStorage.setItem('smart-student-student-assignments', JSON.stringify(asignacionesReparacion));
                console.log(`🔧 [REPARACIÓN] ${asignacionesReparacion.length} asignaciones reparadas`);
            }
        } catch (error) {
            console.error('❌ [ERROR REPARACIÓN] Error en auto-reparación:', error);
        }
    }
    
    /**
     * Obtiene estadísticas después de la importación
     */
    function obtenerEstadisticasPostImportacion() {
        try {
            const usuarios = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
            const asignacionesEstudiantes = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
            const asignacionesProfesores = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
            
            return {
                usuariosImportados: usuarios.length,
                estudiantesAsignados: asignacionesEstudiantes.length,
                profesoresAsignados: asignacionesProfesores.length,
                estadoSistema: 'Operativo'
            };
        } catch (error) {
            return {
                usuariosImportados: 0,
                estudiantesAsignados: 0,
                profesoresAsignados: 0,
                estadoSistema: 'Error'
            };
        }
    }
    
    // ==================== FUNCIONES DE VALIDACIÓN MANUAL ====================
    
    /**
     * Función para validar asignaciones manualmente
     */
    function validarAsignacionesManualmente() {
        console.log('🔍 [VALIDACIÓN MANUAL] Iniciando validación manual del sistema...');
        
        try {
            const configuracion = obtenerConfiguracionCompleta();
            
            console.log('📊 [VALIDACIÓN] Estadísticas del sistema:');
            console.table({
                'Usuarios totales': configuracion.usuarios.length,
                'Estudiantes': configuracion.estudiantes.length,
                'Profesores': configuracion.profesores.length,
                'Administradores': configuracion.administradores.length,
                'Cursos': configuracion.cursos.length,
                'Secciones': configuracion.secciones.length,
                'Asignaciones estudiantes': configuracion.asignacionesEstudiantes.length,
                'Asignaciones profesores': configuracion.asignacionesProfesores.length,
                'Comunicaciones': (configuracion.comunicaciones || []).length
            });
            
            // Validar consistencia de asignaciones
            const problemasDetectados = [];
            
            // Verificar estudiantes sin asignación
            const estudiantesSinAsignacion = configuracion.estudiantes.filter(e => 
                !configuracion.asignacionesEstudiantes.some(a => a.studentId === e.id)
            );
            
            if (estudiantesSinAsignacion.length > 0) {
                problemasDetectados.push({
                    tipo: 'Estudiantes sin asignación',
                    cantidad: estudiantesSinAsignacion.length,
                    detalles: estudiantesSinAsignacion.map(e => e.displayName || e.username)
                });
            }
            
            // Verificar profesores sin asignación
            const profesoresSinAsignacion = configuracion.profesores.filter(p => 
                !configuracion.asignacionesProfesores.some(a => a.teacherId === p.id)
            );
            
            if (profesoresSinAsignacion.length > 0) {
                problemasDetectados.push({
                    tipo: 'Profesores sin asignación',
                    cantidad: profesoresSinAsignacion.length,
                    detalles: profesoresSinAsignacion.map(p => p.displayName || p.username)
                });
            }
            
            // Verificar secciones huérfanas
            const seccionesConEstudiantes = [...new Set(configuracion.asignacionesEstudiantes.map(a => a.sectionId))];
            const seccionesConProfesores = [...new Set(configuracion.asignacionesProfesores.map(a => a.sectionId))];
            const seccionesHuerfanas = seccionesConEstudiantes.filter(s => !seccionesConProfesores.includes(s));
            
            if (seccionesHuerfanas.length > 0) {
                problemasDetectados.push({
                    tipo: 'Secciones con estudiantes pero sin profesor',
                    cantidad: seccionesHuerfanas.length,
                    detalles: seccionesHuerfanas
                });
            }
            
            // Mostrar resultados
            if (problemasDetectados.length === 0) {
                console.log('✅ [VALIDACIÓN EXITOSA] No se detectaron problemas en el sistema');
            } else {
                console.warn('⚠️ [PROBLEMAS DETECTADOS]:');
                problemasDetectados.forEach(problema => {
                    console.warn(`   • ${problema.tipo}: ${problema.cantidad}`);
                    console.warn(`     Detalles:`, problema.detalles);
                });
            }
            
            return {
                esValido: problemasDetectados.length === 0,
                problemas: problemasDetectados,
                estadisticas: configuracion
            };
            
        } catch (error) {
            console.error('❌ [ERROR VALIDACIÓN] Error durante la validación:', error);
            return {
                esValido: false,
                error: error.message
            };
        }
    }
    
    // ==================== FUNCIONES PÚBLICAS ====================
    
    // Exportar funciones al scope global para uso desde la consola y otros componentes
    window.exportarBBDDConAsignaciones = exportarBBDDConAsignaciones;
    window.importarBBDDConAsignaciones = importarBBDDConAsignaciones;
    window.validarAsignacionesManualmente = validarAsignacionesManualmente;
    
    // Función utilitaria para cargar archivo desde input
    window.cargarYProcesarArchivo = function(inputElement) {
        const archivo = inputElement.files[0];
        if (!archivo) {
            console.error('❌ [ERROR] No se seleccionó ningún archivo');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const contenido = e.target.result;
            importarBBDDConAsignaciones(contenido);
        };
        reader.readAsText(archivo);
    };
    
    // ==================== INICIALIZACIÓN ====================
    
    console.log('✅ [SISTEMA EXPORTACIÓN] Sistema de exportación mejorada inicializado');
    console.log('📚 [FUNCIONES DISPONIBLES]:');
    console.log('   • exportarBBDDConAsignaciones() - Exportar con asignaciones');
    console.log('   • importarBBDDConAsignaciones(contenido) - Importar con aplicación automática');
    console.log('   • validarAsignacionesManualmente() - Validar estado del sistema');
    console.log('   • cargarYProcesarArchivo(inputElement) - Cargar desde input file');
    
    return {
        exportar: exportarBBDDConAsignaciones,
        importar: importarBBDDConAsignaciones,
        validar: validarAsignacionesManualmente,
        version: VERSION_EXPORTACION
    };
    
})();
