/**
 * FUNCIONES DE INTEGRACIÓN PARA MÓDULO ADMIN
 * Smart Student v8 - Integración completa con interfaz de administración
 * 
 * Este script proporciona las funciones necesarias para integrar la solución
 * de asignaciones dinámicas directamente en el módulo de administración,
 * permitiendo exportar/importar/validar desde la interfaz administrativa.
 * 
 * FUNCIONALIDADES:
 * ✅ Integración directa con botones de exportar/importar
 * ✅ Validación automática desde interfaz admin
 * ✅ Notificaciones integradas con el sistema de toast
 * ✅ Manejo de errores y estados de carga
 * ✅ Interfaz unificada para administradores
 * 
 * RESULTADO: Sistema completamente automatizado y integrado
 */

(function() {
    'use strict';
    
    console.log('🏛️ [INTEGRACIÓN ADMIN] Iniciando integración con módulo administrativo...');
    
    // ==================== CONFIGURACIÓN DE INTEGRACIÓN ====================
    
    const CONFIG_INTEGRACION = {
        mostrarNotificaciones: true,
        validarAntesDeProcesar: true,
        aplicarCorreccionAutomatica: true,
        mostrarProgreso: true,
        timeoutOperaciones: 30000 // 30 segundos
    };
    
    /**
     * Clase principal para la integración con el módulo admin
     */
    class AdminIntegration {
        constructor() {
            this.isProcessing = false;
            this.toastSystem = null;
            this.initializeToastSystem();
        }
        
        /**
         * Inicializa el sistema de notificaciones toast
         */
        initializeToastSystem() {
            // Intentar usar el sistema de toast existente de la aplicación
            if (typeof window.showToast === 'function') {
                this.toastSystem = window.showToast;
            } else if (window.toast) {
                this.toastSystem = window.toast;
            } else {
                // Fallback a console si no hay sistema de toast
                this.toastSystem = (options) => {
                    const prefix = options.variant === 'destructive' ? '❌' : '✅';
                    console.log(`${prefix} [${options.title}] ${options.description}`);
                };
            }
        }
        
        /**
         * Muestra una notificación toast
         */
        showNotification(title, description, variant = 'default') {
            if (CONFIG_INTEGRACION.mostrarNotificaciones) {
                this.toastSystem({
                    title,
                    description,
                    variant
                });
            }
        }
        
        /**
         * Muestra el progreso de una operación
         */
        showProgress(message) {
            if (CONFIG_INTEGRACION.mostrarProgreso) {
                console.log(`⏳ [PROGRESO] ${message}`);
            }
        }
        
        /**
         * Maneja errores de manera centralizada
         */
        handleError(error, operation) {
            console.error(`❌ [ERROR ${operation.toUpperCase()}]`, error);
            this.showNotification(
                `Error en ${operation}`,
                error.message || 'Ha ocurrido un error inesperado',
                'destructive'
            );
        }
    }
    
    // ==================== FUNCIONES PRINCIPALES DE INTEGRACIÓN ====================
    
    /**
     * Función integrada para exportar desde el botón del admin
     */
    async function exportarDesdeAdmin() {
        const admin = new AdminIntegration();
        
        if (admin.isProcessing) {
            admin.showNotification(
                'Operación en progreso',
                'Ya hay una operación ejecutándose. Por favor espera.',
                'destructive'
            );
            return;
        }
        
        admin.isProcessing = true;
        
        try {
            admin.showProgress('Iniciando exportación completa...');
            admin.showNotification(
                'Exportación iniciada',
                'Preparando base de datos con asignaciones incluidas...'
            );
            
            // Paso 1: Validar antes de exportar si está configurado
            if (CONFIG_INTEGRACION.validarAntesDeProcesar) {
                admin.showProgress('Validando sistema antes de exportar...');
                
                const validacion = await validarSistemaCompleto();
                if (!validacion.esValido && validacion.problemasCriticos) {
                    throw new Error('Sistema tiene problemas críticos que deben resolverse antes de exportar');
                }
            }
            
            // Paso 2: Aplicar corrección automática si está configurado
            if (CONFIG_INTEGRACION.aplicarCorreccionAutomatica) {
                admin.showProgress('Aplicando corrección automática antes de exportar...');
                await aplicarCorreccionAntesDeProcesar();
            }
            
            // Paso 3: Ejecutar exportación mejorada
            admin.showProgress('Ejecutando exportación con asignaciones...');
            
            const resultado = await ejecutarExportacionConTimeout();
            
            if (resultado.exito) {
                admin.showNotification(
                    'Exportación exitosa',
                    `Base de datos exportada exitosamente. Archivo: ${resultado.archivo}`,
                    'default'
                );
                
                console.log('📊 [EXPORTACIÓN ADMIN] Estadísticas:', resultado.estadisticas);
            } else {
                throw new Error(resultado.mensaje || 'Error durante la exportación');
            }
            
        } catch (error) {
            admin.handleError(error, 'exportación');
        } finally {
            admin.isProcessing = false;
        }
    }
    
    /**
     * Función integrada para importar desde el input del admin
     */
    async function importarDesdeAdmin(inputElement) {
        const admin = new AdminIntegration();
        
        if (admin.isProcessing) {
            admin.showNotification(
                'Operación en progreso',
                'Ya hay una operación ejecutándose. Por favor espera.',
                'destructive'
            );
            return;
        }
        
        // Validar que hay archivo seleccionado
        if (!inputElement.files || inputElement.files.length === 0) {
            admin.showNotification(
                'Archivo requerido',
                'Por favor selecciona un archivo para importar',
                'destructive'
            );
            return;
        }
        
        admin.isProcessing = true;
        
        try {
            const archivo = inputElement.files[0];
            
            admin.showProgress('Iniciando importación con asignaciones...');
            admin.showNotification(
                'Importación iniciada',
                'Procesando archivo y aplicando configuración...'
            );
            
            // Paso 1: Leer archivo
            admin.showProgress('Leyendo archivo seleccionado...');
            const contenidoArchivo = await leerArchivoAsync(archivo);
            
            // Paso 2: Validar contenido del archivo
            admin.showProgress('Validando contenido del archivo...');
            const validacionArchivo = validarContenidoArchivo(contenidoArchivo);
            if (!validacionArchivo.esValido) {
                throw new Error('Archivo inválido: ' + validacionArchivo.problemas.join(', '));
            }
            
            // Paso 3: Crear respaldo antes de importar
            admin.showProgress('Creando respaldo de seguridad...');
            await crearRespaldoSeguridad();
            
            // Paso 4: Ejecutar importación
            admin.showProgress('Importando datos con asignaciones...');
            const resultado = await ejecutarImportacionConTimeout(contenidoArchivo);
            
            if (resultado.exito) {
                admin.showNotification(
                    'Importación exitosa',
                    'Base de datos importada y asignaciones aplicadas correctamente',
                    'default'
                );
                
                // Paso 5: Validación post-importación
                admin.showProgress('Validando sistema después de la importación...');
                const validacionPost = await validarSistemaCompleto();
                
                if (validacionPost.esValido) {
                    admin.showNotification(
                        'Validación exitosa',
                        'Sistema validado correctamente después de la importación',
                        'default'
                    );
                } else {
                    admin.showNotification(
                        'Validación parcial',
                        'Importación exitosa pero se detectaron algunas inconsistencias menores',
                        'default'
                    );
                }
                
                console.log('📊 [IMPORTACIÓN ADMIN] Estadísticas:', resultado.estadisticas);
                
                // Paso 6: Sugerir recarga de página para aplicar cambios
                admin.showNotification(
                    'Recarga recomendada',
                    'Se recomienda recargar la página para aplicar todos los cambios',
                    'default'
                );
                
            } else {
                throw new Error(resultado.mensaje || 'Error durante la importación');
            }
            
        } catch (error) {
            admin.handleError(error, 'importación');
            
            // Intentar restaurar respaldo en caso de error crítico
            try {
                admin.showProgress('Intentando restaurar respaldo por error...');
                await restaurarRespaldoSeguridad();
            } catch (restoreError) {
                console.error('❌ [ERROR CRÍTICO] No se pudo restaurar respaldo:', restoreError);
            }
            
        } finally {
            admin.isProcessing = false;
            // Limpiar input file
            if (inputElement) {
                inputElement.value = '';
            }
        }
    }
    
    /**
     * Función integrada para validar desde el admin
     */
    async function validarDesdeAdmin() {
        const admin = new AdminIntegration();
        
        try {
            admin.showProgress('Iniciando validación completa del sistema...');
            admin.showNotification(
                'Validación iniciada',
                'Analizando estado del sistema y asignaciones...'
            );
            
            const resultado = await validarSistemaCompleto();
            
            if (resultado.esValido) {
                admin.showNotification(
                    'Sistema válido',
                    'Todas las validaciones han pasado exitosamente',
                    'default'
                );
            } else {
                const problemasTexto = resultado.problemas.map(p => p.tipo).join(', ');
                admin.showNotification(
                    'Problemas detectados',
                    `Se encontraron ${resultado.problemas.length} problemas: ${problemasTexto}`,
                    'destructive'
                );
                
                // Mostrar opción de auto-reparación
                if (CONFIG_INTEGRACION.aplicarCorreccionAutomatica) {
                    admin.showNotification(
                        'Auto-reparación disponible',
                        'Ejecuta aplicarCorreccionAutomatica() para reparar automáticamente',
                        'default'
                    );
                }
            }
            
            // Mostrar estadísticas detalladas en consola
            console.log('📊 [VALIDACIÓN ADMIN] Estadísticas completas:');
            console.table(resultado.estadisticas);
            
            return resultado;
            
        } catch (error) {
            admin.handleError(error, 'validación');
        }
    }
    
    /**
     * Función para aplicar corrección automática desde el admin
     */
    async function aplicarCorreccionAutomatica() {
        const admin = new AdminIntegration();
        
        try {
            admin.showProgress('Iniciando corrección automática...');
            admin.showNotification(
                'Corrección iniciada',
                'Aplicando corrección dinámica de asignaciones...'
            );
            
            // Ejecutar script de corrección dinámica
            if (typeof window.regenerarAsignacionesDinamicas === 'function') {
                const resultado = window.regenerarAsignacionesDinamicas();
                
                if (resultado.exito) {
                    admin.showNotification(
                        'Corrección exitosa',
                        `${resultado.asignacionesCreadas} asignaciones corregidas automáticamente`,
                        'default'
                    );
                } else {
                    throw new Error(resultado.mensaje || 'Error en corrección automática');
                }
            } else {
                throw new Error('Sistema de corrección dinámica no disponible');
            }
            
        } catch (error) {
            admin.handleError(error, 'corrección automática');
        }
    }
    
    // ==================== FUNCIONES DE UTILIDAD ====================
    
    /**
     * Ejecuta exportación con timeout
     */
    async function ejecutarExportacionConTimeout() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout: La exportación tardó demasiado tiempo'));
            }, CONFIG_INTEGRACION.timeoutOperaciones);
            
            try {
                // Usar función de exportación mejorada si está disponible
                if (typeof window.exportarBBDDConAsignaciones === 'function') {
                    const resultado = window.exportarBBDDConAsignaciones();
                    clearTimeout(timeout);
                    resolve(resultado);
                } else {
                    clearTimeout(timeout);
                    reject(new Error('Sistema de exportación mejorada no disponible'));
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    
    /**
     * Ejecuta importación con timeout
     */
    async function ejecutarImportacionConTimeout(contenidoArchivo) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout: La importación tardó demasiado tiempo'));
            }, CONFIG_INTEGRACION.timeoutOperaciones);
            
            try {
                // Usar función de importación mejorada si está disponible
                if (typeof window.importarBBDDConAsignaciones === 'function') {
                    const resultado = window.importarBBDDConAsignaciones(contenidoArchivo);
                    clearTimeout(timeout);
                    resolve(resultado);
                } else {
                    clearTimeout(timeout);
                    reject(new Error('Sistema de importación mejorada no disponible'));
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    
    /**
     * Lee un archivo de forma asíncrona
     */
    function leerArchivoAsync(archivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            
            reader.onerror = function() {
                reject(new Error('Error al leer el archivo'));
            };
            
            reader.readAsText(archivo);
        });
    }
    
    /**
     * Valida el contenido de un archivo de importación
     */
    function validarContenidoArchivo(contenido) {
        try {
            const datos = JSON.parse(contenido);
            const problemas = [];
            
            // Validar estructura básica
            if (!datos['smart-student-users'] || !Array.isArray(datos['smart-student-users'])) {
                problemas.push('Archivo no contiene usuarios válidos');
            }
            
            if (datos['smart-student-users'] && datos['smart-student-users'].length === 0) {
                problemas.push('Archivo no contiene usuarios');
            }
            
            return {
                esValido: problemas.length === 0,
                problemas
            };
        } catch (error) {
            return {
                esValido: false,
                problemas: ['Archivo no es un JSON válido']
            };
        }
    }
    
    /**
     * Crea un respaldo de seguridad antes de importar
     */
    async function crearRespaldoSeguridad() {
        try {
            const datosActuales = {
                timestamp: new Date().toISOString(),
                'smart-student-users': JSON.parse(localStorage.getItem('smart-student-users') || '[]'),
                'smart-student-student-assignments': JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]'),
                'smart-student-teacher-assignments': JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]'),
                // Nuevas colecciones para respaldo
                'smart-student-tasks': JSON.parse(localStorage.getItem('smart-student-tasks') || '[]'),
                'smart-student-task-comments': JSON.parse(localStorage.getItem('smart-student-task-comments') || '[]'),
                'smart-student-task-notifications': JSON.parse(localStorage.getItem('smart-student-task-notifications') || '[]'),
                'smart-student-evaluations': JSON.parse(localStorage.getItem('smart-student-evaluations') || '[]'),
                'smart-student-evaluation-results': JSON.parse(localStorage.getItem('smart-student-evaluation-results') || '[]'),
                'smart-student-attendance': JSON.parse(localStorage.getItem('smart-student-attendance') || '[]')
            };
            
            localStorage.setItem('smart-student-backup-seguridad', JSON.stringify(datosActuales));
            console.log('💾 [RESPALDO] Respaldo de seguridad creado');
        } catch (error) {
            console.warn('⚠️ [RESPALDO] No se pudo crear respaldo de seguridad:', error);
        }
    }
    
    /**
     * Restaura el respaldo de seguridad
     */
    async function restaurarRespaldoSeguridad() {
        try {
            const respaldo = localStorage.getItem('smart-student-backup-seguridad');
            if (respaldo) {
                const datosRespaldo = JSON.parse(respaldo);
                
                localStorage.setItem('smart-student-users', JSON.stringify(datosRespaldo['smart-student-users']));
                localStorage.setItem('smart-student-student-assignments', JSON.stringify(datosRespaldo['smart-student-student-assignments']));
                localStorage.setItem('smart-student-teacher-assignments', JSON.stringify(datosRespaldo['smart-student-teacher-assignments']));
                // Restaurar nuevas colecciones
                localStorage.setItem('smart-student-tasks', JSON.stringify(datosRespaldo['smart-student-tasks'] || []));
                localStorage.setItem('smart-student-task-comments', JSON.stringify(datosRespaldo['smart-student-task-comments'] || []));
                localStorage.setItem('smart-student-task-notifications', JSON.stringify(datosRespaldo['smart-student-task-notifications'] || []));
                localStorage.setItem('smart-student-evaluations', JSON.stringify(datosRespaldo['smart-student-evaluations'] || []));
                localStorage.setItem('smart-student-evaluation-results', JSON.stringify(datosRespaldo['smart-student-evaluation-results'] || []));
                localStorage.setItem('smart-student-attendance', JSON.stringify(datosRespaldo['smart-student-attendance'] || []));
                
                console.log('🔄 [RESTAURACIÓN] Respaldo de seguridad restaurado');
            }
        } catch (error) {
            console.error('❌ [RESTAURACIÓN] Error al restaurar respaldo:', error);
        }
    }
    
    /**
     * Valida el sistema completo
     */
    async function validarSistemaCompleto() {
        if (typeof window.validarAsignacionesManualmente === 'function') {
            return window.validarAsignacionesManualmente();
        } else {
            // Validación básica si no está disponible la función completa
            try {
                const usuarios = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
                const asignaciones = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]');
                
                return {
                    esValido: usuarios.length > 0 && asignaciones.length > 0,
                    problemas: [],
                    estadisticas: {
                        usuarios: usuarios.length,
                        asignaciones: asignaciones.length
                    }
                };
            } catch (error) {
                return {
                    esValido: false,
                    problemas: [{ tipo: 'Error de validación', detalles: error.message }],
                    estadisticas: {}
                };
            }
        }
    }
    
    /**
     * Aplica corrección antes de procesar
     */
    async function aplicarCorreccionAntesDeProcesar() {
        if (typeof window.regenerarAsignacionesDinamicas === 'function') {
            window.regenerarAsignacionesDinamicas();
        }
    }
    
    // ==================== FUNCIONES DE INTEGRACIÓN CON INTERFAZ ====================
    
    /**
     * Integra los botones en el componente de configuración existente
     */
    function integrarBotonesEnAdmin() {
        // Buscar botón de exportar existente
        const botonesExportar = document.querySelectorAll('button');
        let botonExportarEncontrado = null;
        
        for (let boton of botonesExportar) {
            if (boton.textContent.toLowerCase().includes('exportar') || 
                boton.textContent.toLowerCase().includes('export')) {
                botonExportarEncontrado = boton;
                break;
            }
        }
        
        if (botonExportarEncontrado) {
            // Reemplazar evento del botón existente
            const nuevoBoton = botonExportarEncontrado.cloneNode(true);
            botonExportarEncontrado.parentNode.replaceChild(nuevoBoton, botonExportarEncontrado);
            
            nuevoBoton.addEventListener('click', (e) => {
                e.preventDefault();
                exportarDesdeAdmin();
            });
            
            console.log('✅ [INTEGRACIÓN] Botón de exportar integrado');
        }
        
        // Buscar input de importar existente
        const inputsFile = document.querySelectorAll('input[type="file"]');
        
        for (let input of inputsFile) {
            input.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    importarDesdeAdmin(e.target);
                }
            });
        }
        
        if (inputsFile.length > 0) {
            console.log('✅ [INTEGRACIÓN] Inputs de importar integrados');
        }
    }
    
    /**
     * Agrega botones de utilidad adicionales
     */
    function agregarBotonesUtilidad() {
        // Solo si estamos en la página de administración
        if (window.location.pathname.includes('admin') || 
            window.location.pathname.includes('gestion-usuarios')) {
            
            // Crear panel de utilidades
            const panelUtilidades = document.createElement('div');
            panelUtilidades.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px;
                border-radius: 8px;
                z-index: 9999;
                font-size: 12px;
            `;
            
            panelUtilidades.innerHTML = `
                <div style="margin-bottom: 10px; font-weight: bold;">🛠️ Utilidades Admin</div>
                <button id="btn-validar-admin" style="margin: 2px; padding: 4px 8px; font-size: 11px;">Validar Sistema</button><br>
                <button id="btn-corregir-admin" style="margin: 2px; padding: 4px 8px; font-size: 11px;">Auto-Corregir</button><br>
                <button id="btn-estadisticas-admin" style="margin: 2px; padding: 4px 8px; font-size: 11px;">Ver Estadísticas</button>
            `;
            
            document.body.appendChild(panelUtilidades);
            
            // Agregar eventos
            document.getElementById('btn-validar-admin').addEventListener('click', validarDesdeAdmin);
            document.getElementById('btn-corregir-admin').addEventListener('click', aplicarCorreccionAutomatica);
            document.getElementById('btn-estadisticas-admin').addEventListener('click', () => {
                if (typeof window.obtenerEstadisticasAsignaciones === 'function') {
                    window.obtenerEstadisticasAsignaciones();
                }
            });
            
            console.log('✅ [INTEGRACIÓN] Panel de utilidades agregado');
        }
    }
    
    // ==================== FUNCIONES PÚBLICAS ====================
    
    // Exportar funciones principales al scope global
    window.exportarDesdeAdmin = exportarDesdeAdmin;
    window.importarDesdeAdmin = importarDesdeAdmin;
    window.validarDesdeAdmin = validarDesdeAdmin;
    window.aplicarCorreccionAutomatica = aplicarCorreccionAutomatica;
    
    // Función para integrar automáticamente con la interfaz
    window.integrarConAdmin = function() {
        integrarBotonesEnAdmin();
        agregarBotonesUtilidad();
    };
    
    // ==================== INICIALIZACIÓN ====================
    
    console.log('✅ [INTEGRACIÓN ADMIN] Sistema de integración administrativo inicializado');
    console.log('🏛️ [FUNCIONES DISPONIBLES]:');
    console.log('   • exportarDesdeAdmin() - Exportar con interfaz integrada');
    console.log('   • importarDesdeAdmin(inputElement) - Importar con validación');
    console.log('   • validarDesdeAdmin() - Validar con notificaciones');
    console.log('   • aplicarCorreccionAutomatica() - Auto-reparar sistema');
    console.log('   • integrarConAdmin() - Integrar automáticamente con interfaz');
    
    // Intentar integración automática si estamos en página de admin
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.location.pathname.includes('admin') || 
                    window.location.pathname.includes('gestion')) {
                    window.integrarConAdmin();
                }
            }, 2000);
        });
    } else {
        setTimeout(() => {
            if (window.location.pathname.includes('admin') || 
                window.location.pathname.includes('gestion')) {
                window.integrarConAdmin();
            }
        }, 2000);
    }
    
    return {
        exportar: exportarDesdeAdmin,
        importar: importarDesdeAdmin,
        validar: validarDesdeAdmin,
        corregir: aplicarCorreccionAutomatica,
        integrar: window.integrarConAdmin
    };
    
})();
