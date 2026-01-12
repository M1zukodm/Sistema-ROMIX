const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const API_URL = CONFIG.API_URL;

// Variables Globales
let existeRiesgoActivo = false;
let validandoActualmente = false;
let blurTimer;
let cacheColoniasCP = []; // 🧠 Memoria para las colonias del CP actual

checkBackendStatus();

// --- LIMPIEZA AUTOMÁTICA DE ERRORES AL ESCRIBIR ---
// Escucha globalmente: si el usuario escribe en un campo con error, se lo quita.
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('input', function(e) {
        if (e.target.classList.contains('form-control')) {
            e.target.classList.remove('is-invalid'); // Quita el borde rojo
            e.target.classList.remove('shake-error'); // Quita el temblor si sigue ahí
        }
    });
});



async function checkBackendStatus() {
    const toastEl = document.getElementById('backendToast');
    const toastBody = document.getElementById('toastStatusMsg');
    if (!toastEl) return;
    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    try {
        const response = await fetch(API_URL, { method: 'GET' });
        if (response.ok) {
            toastEl.classList.remove('bg-danger');
            toastEl.classList.add('bg-success');
            toastBody.innerHTML = '<i class="bi bi-check-circle-fill me-2 fs-5"></i> Backend Online';
            toast.show();
        }
    } catch (error) {
        toastEl.classList.remove('bg-success');
        toastEl.classList.add('bg-danger');
        toastBody.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i> Backend Offline';
        toast.show();
    }
}

// === FUNCIÓN AUXILIAR PARA PARSEAR UBICACIÓN ===
function extraerUbicacion(subtitulo) {
    let municipio = '';
    let estado = '';

    if (subtitulo && typeof subtitulo === 'string') {
        const partesTipo = subtitulo.split('-'); 
        if (partesTipo.length > 1) {
            const geog = partesTipo[1].trim(); 
            const partesGeo = geog.split(',');
            if (partesGeo.length >= 2) {
                municipio = partesGeo[0].trim();
                estado = partesGeo[1].trim();
            } else {
                municipio = geog; 
            }
        }
    }
    return { municipio, estado };
}

/**
 * Configura los inputs de búsqueda
 */
function configurarBuscador(inputId, listId, categoriaAzure, onSelect = null) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const clearBtn = input.parentElement.querySelector('.clear-icon');
    let debounceTimer;

    // EVENTO 1: DETECTAR ESCRITURA
    input.addEventListener('input', function () {
        const query = this.value;

        if (query.length > 0) clearBtn.classList.add('visible');
        else clearBtn.classList.remove('visible');

        // LOGICA DE LIMPIEZA ESTRICTA PARA CÓDIGO POSTAL
        if (inputId === 'inputCodigoPostal') {
            document.getElementById('inputColonia').value = '';
            document.getElementById('inputMunicipio').value = '';
            document.getElementById('inputEstado').value = '';
            document.getElementById('inputMunicipio').classList.remove('campo-autocompletado');
            document.getElementById('inputEstado').classList.remove('campo-autocompletado');
            cacheColoniasCP = [];
        }

        if (query.length < 1) {
            list.style.display = 'none';
            return;
        }

        // Si es input Colonia y ya tenemos caché, filtramos la caché
        if (inputId === 'inputColonia' && cacheColoniasCP.length > 0) {
             if(query.length === 0) mostrarOpcionesDeColoniaCache();
             const filtrado = cacheColoniasCP.filter(c => c.colonia.toLowerCase().includes(query.toLowerCase()));
             mostrarOpcionesDeCacheFiltradas(filtrado);
            return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: query, categoria: categoriaAzure, limit: 10 })
                });
                const data = await response.json();
                
                if (data.success && data.sugerencias.length > 0) {
                    
                    // === FILTRO ANTI-DUPLICADOS ===
                    // Creamos un Set para recordar qué textos ya vimos en esta búsqueda
                    const vistos = new Set();
                    
                    const sugerenciasUnicas = data.sugerencias.filter(item => {
                        // Normalizamos el texto (minusculas y sin espacios extra) para comparar
                        const textoKey = item.texto.trim().toLowerCase();
                        
                        // Si ya vimos este texto, lo ignoramos (es un duplicado)
                        if (vistos.has(textoKey)) {
                            return false;
                        }
                        
                        // Si es nuevo, lo guardamos y lo dejamos pasar
                        vistos.add(textoKey);
                        return true;
                    });

                    // Mostramos solo las sugerencias únicas
                    mostrarSugerencias(sugerenciasUnicas, list, input, categoriaAzure, onSelect);
                } else { 
                    list.style.display = 'none'; 
                }
            } catch (error) { console.error("Error buscando:", error); }
        }, 300);
    });

    const mostrarCache = () => {
        if (input.value.length > 0) clearBtn.classList.add('visible');
        if (inputId === 'inputColonia' && cacheColoniasCP.length > 0) {
            mostrarOpcionesDeColoniaCache();
        }
    };
    input.addEventListener('focus', mostrarCache);
    input.addEventListener('click', mostrarCache);

    document.addEventListener('click', function (e) {
        if (e.target !== input && e.target !== list && e.target !== clearBtn) { list.style.display = 'none'; }
    });
}

window.limpiarInput = function (id) {
    const input = document.getElementById(id);
    input.value = '';
    input.focus();
    const clearBtn = input.parentElement.querySelector('.clear-icon');
    if (clearBtn) clearBtn.classList.remove('visible');
    
    if (id === 'inputCodigoPostal') {
        cacheColoniasCP = [];
        document.getElementById('inputColonia').value = '';
        document.getElementById('inputMunicipio').value = '';
        document.getElementById('inputEstado').value = '';
        document.getElementById('inputMunicipio').classList.remove('campo-autocompletado');
        document.getElementById('inputEstado').classList.remove('campo-autocompletado');
    }

    if (id === 'inputColonia' && cacheColoniasCP.length > 0) {
        mostrarOpcionesDeColoniaCache();
    }

    if (id === 'inputMedicamento') resetearValidacion();
}

function mostrarSugerencias(sugerencias, listElement, inputElement, categoria, onSelect = null) {
    listElement.innerHTML = '';
    listElement.style.display = 'block';

    sugerencias.forEach(sug => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        let tituloPrincipal = sug.texto;
        let badgeHtml = '';

        // Personalización de badges
        if (categoria === 'diagnosticos' && sug.metadata.dato_extra) badgeHtml = `<span class="badge bg-danger badge-suggest">${sug.metadata.dato_extra}</span>`;
        else if (categoria === 'medicamentos' && sug.metadata.dato_extra) badgeHtml = `<span class="badge bg-primary badge-suggest">${sug.metadata.dato_extra}</span>`;
        else if (categoria === 'cif' && sug.metadata.dato_extra) badgeHtml = `<span class="badge bg-dark badge-suggest">${sug.metadata.dato_extra}</span>`;
        else if (categoria === 'clues' && sug.metadata.dato_extra) badgeHtml = `<span class="badge bg-success badge-suggest">${sug.metadata.dato_extra}</span>`;
        
        // CORRECCIÓN VISUAL PARA CP
        if (categoria === 'codigos_postales') {
            const cpReal = sug.metadata.dato_extra || sug.texto; 
            const colNombre = sug.texto; 
            tituloPrincipal = `${cpReal} - ${colNombre}`;
        }
        
        // Limpieza visual de subtítulos (quitar guiones bajos feos)
        let subtituloVisual = sug.metadata.subtitulo || '';
        if (subtituloVisual.includes('_')) {
            subtituloVisual = subtituloVisual.replace(/_/g, ' ');
        }

        item.innerHTML = `<div><strong>${tituloPrincipal}</strong> ${badgeHtml}</div><small class="text-muted">${subtituloVisual}</small>`;

        item.onmousedown = function (e) {
            e.preventDefault(); 
            clearTimeout(blurTimer);

            let valorFinal = sug.texto;
            
            if ((categoria === 'diagnosticos' || categoria === 'cif' || categoria === 'clues') && sug.metadata.dato_extra) {
                valorFinal = `${sug.metadata.dato_extra} - ${sug.texto}`;
            }

            inputElement.value = valorFinal; 
            
            const clearBtn = inputElement.parentElement.querySelector('.clear-icon');
            if (clearBtn) clearBtn.classList.add('visible');

            listElement.style.display = 'none';

            if (inputElement.id === 'inputMedicamento' || inputElement.id === 'inputDiagnostico') {
                verificarInteracciones();
            }

            if (onSelect) {
                onSelect(sug);
            }
        };
        listElement.appendChild(item);
    });
}

// === LÓGICA DE DIRECCIÓN ===

function mostrarOpcionesDeCacheFiltradas(filtrados) {
    const list = document.getElementById('listaColonia');
    const input = document.getElementById('inputColonia');
    list.innerHTML = '';
    
    if (filtrados.length === 0) {
        list.style.display = 'none';
        return;
    }
    list.style.display = 'block';

    filtrados.forEach(dato => {
        crearItemCache(dato, list, input);
    });
}

function mostrarOpcionesDeColoniaCache() {
    const list = document.getElementById('listaColonia');
    const input = document.getElementById('inputColonia');
    
    if (cacheColoniasCP.length === 0) return;

    list.innerHTML = '';
    list.style.display = 'block';

    cacheColoniasCP.forEach(dato => {
        crearItemCache(dato, list, input);
    });
}

function crearItemCache(dato, list, input) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.style.borderLeft = "4px solid #0d47a1"; 
    item.style.backgroundColor = "#f8fbff";
    
    item.innerHTML = `<div><i class="bi bi-geo-alt-fill me-2 text-primary"></i><strong>${dato.colonia}</strong></div>`;
    
    item.onmousedown = function(e) {
        e.preventDefault();
        input.value = dato.colonia;
        list.style.display = 'none';
        const clearBtn = input.parentElement.querySelector('.clear-icon');
        if(clearBtn) clearBtn.classList.add('visible');

        if(dato.municipio) {
            document.getElementById('inputMunicipio').value = dato.municipio;
            document.getElementById('inputMunicipio').classList.add('campo-autocompletado');
        }
        if(dato.estado) {
            document.getElementById('inputEstado').value = dato.estado;
            document.getElementById('inputEstado').classList.add('campo-autocompletado');
        }
    };
    list.appendChild(item);
}

// CONFIGURACIÓN ESPECIAL CP
configurarBuscador('inputCodigoPostal', 'listaCodigoPostal', 'codigos_postales', async (seleccion) => {
    
    const cpCorrecto = seleccion.metadata.dato_extra || "00000";
    const coloniaNombre = seleccion.texto; 

    const inputCP = document.getElementById('inputCodigoPostal');
    inputCP.value = cpCorrecto;

    const inputColonia = document.getElementById('inputColonia');
    inputColonia.value = coloniaNombre;
    inputColonia.parentElement.querySelector('.clear-icon').classList.add('visible');

    const ubicacion = extraerUbicacion(seleccion.metadata.subtitulo);
    
    if (ubicacion.municipio) {
        const munInput = document.getElementById('inputMunicipio');
        munInput.value = ubicacion.municipio;
        munInput.classList.add('campo-autocompletado');
    }
    if (ubicacion.estado) {
        const edoInput = document.getElementById('inputEstado');
        edoInput.value = ubicacion.estado;
        edoInput.classList.add('campo-autocompletado');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: cpCorrecto, categoria: 'codigos_postales', limit: 50 }) 
        });
        const data = await response.json();
        
        if (data.success && data.sugerencias.length > 0) {
            cacheColoniasCP = data.sugerencias.map(item => {
                const infoGeo = extraerUbicacion(item.metadata.subtitulo);
                return {
                    colonia: item.texto,
                    municipio: infoGeo.municipio,
                    estado: infoGeo.estado
                };
            });
        }
    } catch (error) {
        console.error("Error obteniendo colonias del CP:", error);
    }
});

// Configuración de buscadores
configurarBuscador('inputIdentidad', 'listaIdentidad', 'identidad_de_genero');
configurarBuscador('inputParentesco', 'listaParentesco', 'parentesco');
configurarBuscador('inputCif', 'listaCif', 'cif');
configurarBuscador('inputClues', 'listaClues', 'clues');
configurarBuscador('inputDiagnostico', 'listaDiagnostico', 'diagnosticos');
configurarBuscador('inputMedicamento', 'listaMedicamento', 'medicamentos');
configurarBuscador('inputColonia', 'listaColonia', 'localidades'); 
configurarBuscador('inputMunicipio', 'listaMunicipio', 'municipios');
configurarBuscador('inputEstado', 'listaEstado', 'entidades');
configurarBuscador('inputReligion', 'listaReligion', 'religiones');
configurarBuscador('inputLenguaIndigena', 'listaLenguaIndigena', 'lenguas_indigenas');
configurarBuscador('inputFormacionAcademica', 'listaFormacionAcademica', 'formacion');
configurarBuscador('inputNacionalidad', 'listaNacionalidad', 'nacionalidades');

// Manejo de la "X"
['pacienteNombre', 'familiarNombre', 'calle', 'numeroExterior'].forEach(id => {
    const input = document.getElementById(id);
    const clearBtn = input.parentElement.querySelector('.clear-icon');
    if (clearBtn) {
        input.addEventListener('input', () => {
            if (input.value.length > 0) clearBtn.classList.add('visible');
            else clearBtn.classList.remove('visible');
        });
    }
});

const inputNacionalidad = document.getElementById('inputNacionalidad');
if (inputNacionalidad) {
    const clearBtn = inputNacionalidad.parentElement.querySelector('.clear-icon');
    if (clearBtn) {
        inputNacionalidad.addEventListener('input', () => {
            if (inputNacionalidad.value.length > 0) clearBtn.classList.add('visible');
            else clearBtn.classList.remove('visible');
        });
    }
}

// --- LÓGICA DE VALIDACIÓN ---
const inputDiag = document.getElementById('inputDiagnostico');
const inputMed = document.getElementById('inputMedicamento');
const btnGuardar = document.getElementById('btnGuardar');
const msgBloqueo = document.getElementById('msgBloqueo');

const BASE_URL = API_URL.substring(0, API_URL.lastIndexOf('/'));
const VALIDAR_URL = `${BASE_URL}/ValidarInteraccion`;

async function verificarInteracciones() {
    const diag = inputDiag.value.trim();
    const med = inputMed.value.trim();

    if (med.length < 2) {
        resetearValidacion();
        return;
    }
    if (diag.length < 2) return;

    if (validandoActualmente) return;
    validandoActualmente = true;

    const iconContainer = inputMed.parentElement.querySelector('.input-group-text i');
    const originalIconClass = "bi bi-capsule text-primary";

    iconContainer.className = "spinner-border spinner-border-sm text-primary";
    inputMed.disabled = true;
    inputDiag.disabled = true;

    try {
        const response = await fetch(VALIDAR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diagnostico: diag, medicamento: med })
        });

        if (inputMed.value.trim().length < 2) {
            resetearValidacion();
            return;
        }

        const data = await response.json();

        if (data.riesgo === true) {
            existeRiesgoActivo = true;
            bloquearGuardado(true);
            mostrarAlertaClinica(data.mensaje);
            inputMed.style.borderColor = "#dc3545";
            inputMed.classList.add("is-invalid");
            iconContainer.className = "bi bi-exclamation-triangle-fill text-danger";
        } else {
            resetearValidacion(false);
            inputMed.style.borderColor = "#198754";
            iconContainer.className = "bi bi-check-circle-fill text-success";
        }

    } catch (error) {
        console.error("Error validando:", error);
        inputMed.style.borderColor = "#ced4da";
        iconContainer.className = originalIconClass;
    } finally {
        inputMed.disabled = false;
        inputDiag.disabled = false;
        validandoActualmente = false;

        if (!existeRiesgoActivo && inputMed.value.length > 2) {
            setTimeout(() => {
                if (!validandoActualmente && !existeRiesgoActivo) {
                    iconContainer.className = originalIconClass;
                }
            }, 1500);
        }
    }
}

function bloquearGuardado(bloquear) {
    btnGuardar.disabled = bloquear;
    msgBloqueo.style.display = bloquear ? 'block' : 'none';
}

function resetearValidacion(borrarTexto = false) {
    existeRiesgoActivo = false;
    bloquearGuardado(false);
    const iconContainer = inputMed.parentElement.querySelector('.input-group-text i');
    if (borrarTexto) inputMed.value = '';
    inputMed.style.borderColor = "#ced4da";
    inputMed.classList.remove("is-invalid");
    iconContainer.className = "bi bi-capsule text-primary";
    const toastEl = document.getElementById('warningToast');
    const toast = bootstrap.Toast.getInstance(toastEl);
    if (toast) toast.hide();
}

window.corregirMedicamento = function () {
    validandoActualmente = false;
    limpiarInput('inputMedicamento');
    resetearValidacion(true);
}

function mostrarAlertaClinica(mensaje) {
    const toastEl = document.getElementById('warningToast');
    const msgEl = document.getElementById('warningMsg');
    if (toastEl) {
        const toast = new bootstrap.Toast(toastEl, { autohide: false });
        msgEl.innerHTML = mensaje;
        toast.show();
    }
}

function agendarValidacionBlur() {
    if (validandoActualmente) return;
    blurTimer = setTimeout(() => {
        if (inputMed.value.length > 2) verificarInteracciones();
    }, 200);
}

inputMed.addEventListener('blur', agendarValidacionBlur);
inputDiag.addEventListener('blur', () => {
    setTimeout(() => {
        if (inputMed.value.length > 2 && !validandoActualmente) verificarInteracciones();
    }, 200);
});

// 4. GUARDAR EN SUPABASE (CON ALERTA ROJA NUEVA)
document.getElementById('expedienteForm').addEventListener('submit', async function (e) {
    e.preventDefault();
   

    // 1. DEFINIR CAMPOS OBLIGATORIOS
    const camposCriticos = [
        { id: 'pacienteNombre', msg: 'Falta el nombre del paciente' },
        { id: 'pacienteEdad', msg: 'Falta la edad del paciente' },
        { id: 'inputDiagnostico', msg: 'Falta diagnóstico' },
        { id: 'inputMedicamento', msg: 'Falta medicamento' },
        { id: 'inputCodigoPostal', msg: 'Falta Codigo Postal del paciente' },
        { id: 'inputColonia', msg: 'Falta colonia del paciente' },
        { id: 'inputMunicipio', msg: 'Falta municipio del paciente' },
        { id: 'inputEstado', msg: 'Falta estado del paciente' },
        { id: 'inputClues', msg: 'Falta ingresar CLUES del paciente' },
        { id: 'inputParentesco', msg: 'Falta parentesco con el paciente' },
        { id: 'familiarNombre', msg: 'Falta nombre del familiar' }
       
    ];

    let primerError = null;
    let hayErrores = false;

    // 2. LIMPIEZA PREVIA
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));

    // 3. VERIFICACIÓN
    // 3. VERIFICACIÓN (Dentro del evento submit)
    camposCriticos.forEach(campo => {
        const input = document.getElementById(campo.id);
        
        // Verificamos que el input exista y esté vacío
        if (input && !input.value.trim()) {
            // 1. Aplicar estilo de error (Rojo y Temblor)
            input.classList.add('is-invalid', 'shake-error'); 
            
            // 2. Quitar animación de temblor rápido (0.5s) para que pueda vibrar de nuevo si le das click
            setTimeout(() => input.classList.remove('shake-error'), 500);
            
            // 3. === TEMPORIZADOR DE 2.5 SEGUNDOS ===
            // Quita el borde rojo automáticamente después de 2500ms
            setTimeout(() => input.classList.remove('is-invalid'), 2500);
            
            if (!primerError) primerError = input;
            hayErrores = true;
        } else if (input) {
            // Si está correcto, ponemos verde
            input.classList.add('is-valid'); 
            // Opcional: Quitar el verde también a los 2.5s para limpiar
            setTimeout(() => input.classList.remove('is-valid'), 2500);
        }
    });

    // 4. SI HAY ERRORES, MOSTRAR LA NUEVA ALERTA ROJA (ARRIBA)
    if (hayErrores) {
        if (primerError) {
            primerError.focus();
            primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Usamos el NUEVO TOAST de validación (no el de riesgo médico)
        const toastEl = document.getElementById('validationToast');
        const msgEl = document.getElementById('validationMsg');
        if (toastEl && msgEl) {
            msgEl.innerText = "Por favor, completa los campos marcados en rojo.";
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
        }
        return; // DETIENE EL PROCESO
    }

    // 5. CHEQUEO DE RIESGO MÉDICO (INTERACCIONES)
    if (existeRiesgoActivo) {
        // Usamos el TOAST CENTRAL (el grande con botón)
        const toastEl = document.getElementById('warningToast');
        const msgEl = document.getElementById('warningMsg');
        if (toastEl) {
            msgEl.innerText = "Existe una interacción médica activa. Revisa el medicamento.";
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
        }
        return;
    }

    // 6. GUARDAR DATOS (Si pasó todo lo anterior)
    const btn = document.getElementById('btnGuardar');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    const datos = {
        paciente_nombre: document.getElementById('pacienteNombre').value,
        paciente_edad: parseInt(document.getElementById('pacienteEdad').value) || 0,
        nacionalidad: document.getElementById('inputNacionalidad') ? document.getElementById('inputNacionalidad').value : '',
        identidad_genero: document.getElementById('inputIdentidad').value,
        familiar_nombre: document.getElementById('familiarNombre').value,
        familiar_parentesco: document.getElementById('inputParentesco').value,
        hospital_cif: document.getElementById('inputCif').value,
        hospital_clues: document.getElementById('inputClues').value,
        diagnostico: document.getElementById('inputDiagnostico').value,
        medicamento: document.getElementById('inputMedicamento').value,
        calle: document.getElementById('calle').value,
        numero_exterior: document.getElementById('numeroExterior').value,
        codigo_postal: document.getElementById('inputCodigoPostal').value,
        colonia: document.getElementById('inputColonia').value,
        municipio: document.getElementById('inputMunicipio').value,
        estado: document.getElementById('inputEstado').value,
        religion: document.getElementById('inputReligion').value,
        lengua_indigena: document.getElementById('inputLenguaIndigena').value,
        formacion_academica: document.getElementById('inputFormacionAcademica').value,
        notas_adicionales: document.getElementById('notasAdicionales').value,
        created_at: new Date()
    };

    try {
        const { error } = await supabaseClient.from('expedientes').insert([datos]);
        if (error) throw error;
        
        // ÉXITO
        const toast = new bootstrap.Toast(document.getElementById('liveToast'));
        document.getElementById('toastMsg').innerText = "Expediente guardado correctamente.";
        toast.show();
        
        // RESET
        document.getElementById('expedienteForm').reset();
        document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
        document.querySelectorAll('.clear-icon').forEach(el => el.classList.remove('visible'));
        document.querySelectorAll('.campo-autocompletado').forEach(el => el.classList.remove('campo-autocompletado'));
        cacheColoniasCP = [];
        resetearValidacion();
    } catch (err) {
        console.error(err);
        alert("Error al guardar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// --- PANEL DE CONSULTA ---
let expedientesCache = [];
configurarBuscadorPacientes('filtroGeneral', 'listaFiltroGeneral');
configurarBuscador('filtroDiagnostico', 'listaFiltroDiag', 'diagnosticos');
configurarBuscador('filtroMedicamento', 'listaFiltroMed', 'medicamentos');

const inputFiltroGen = document.getElementById('filtroGeneral');
const clearBtnFiltro = inputFiltroGen.parentElement.querySelector('.clear-icon');
inputFiltroGen.addEventListener('input', () => {
    if (inputFiltroGen.value.length > 0) clearBtnFiltro.classList.add('visible');
    else clearBtnFiltro.classList.remove('visible');
});

async function cargarExpedientes() {
    const tbody = document.getElementById('tablaExpedientes');
    const msgVacio = document.getElementById('mensajeVacio');

    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div> Cargando datos...</td></tr>';
    msgVacio.style.display = 'none';

    const valGeneral = document.getElementById('filtroGeneral').value.trim();
    const valDiag = document.getElementById('filtroDiagnostico').value.trim();
    const valMed = document.getElementById('filtroMedicamento').value.trim();

    let query = supabaseClient.from('expedientes').select('*').order('created_at', { ascending: false });

    if (valGeneral) query = query.ilike('paciente_nombre', `%${valGeneral}%`);
    if (valDiag) query = query.ilike('diagnostico', `%${valDiag}%`);
    if (valMed) query = query.ilike('medicamento', `%${valMed}%`);

    const { data, error } = await query;

    if (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar datos.</td></tr>';
        return;
    }

    expedientesCache = data || [];
    tbody.innerHTML = '';

    if (!expedientesCache || expedientesCache.length === 0) {
        msgVacio.style.display = 'block';
        return;
    }

    expedientesCache.forEach((exp, index) => {
        const fecha = new Date(exp.created_at).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const row = `<tr>
            <td class="small text-muted">${fecha.split(',')[0]}</td>
            <td class="fw-bold">${exp.paciente_nombre}</td>
            <td class="text-truncate" style="max-width: 150px;"><span class="badge bg-light text-dark border">${exp.diagnostico ? exp.diagnostico.split('-')[0] : 'N/A'}</span></td>
            <td class="text-truncate" style="max-width: 150px;">${exp.medicamento ? exp.medicamento.substring(0, 15) : 'N/A'}...</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="verDetalle(${index})"><i class="bi bi-eye-fill"></i> Ver</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function limpiarFiltros() {
    limpiarInput('filtroGeneral');
    limpiarInput('filtroDiagnostico');
    limpiarInput('filtroMedicamento');
    document.getElementById('listaFiltroGeneral').style.display = 'none';
    document.getElementById('listaFiltroDiag').style.display = 'none';
    document.getElementById('listaFiltroMed').style.display = 'none';
    document.getElementById('tablaExpedientes').innerHTML = '';
    document.getElementById('mensajeVacio').style.display = 'none';
    expedientesCache = [];
}

function verDetalle(index) {
    const exp = expedientesCache[index];
    if (!exp) return;
    document.getElementById('mdlNombre').innerText = exp.paciente_nombre;
    document.getElementById('mdlFecha').innerText = new Date(exp.created_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    document.getElementById('mdlEdad').innerText = `${exp.paciente_edad} años`;
    document.getElementById('mdlFamiliar').innerHTML = `${exp.familiar_nombre} <br><small class='text-muted'>(${exp.familiar_parentesco})</small>`;
    document.getElementById('mdlDiagnostico').innerText = exp.diagnostico || 'No especificado';
    document.getElementById('mdlMedicamento').innerText = exp.medicamento || 'No especificado';
    document.getElementById('mdlCif').innerText = exp.hospital_cif || 'No especificado | No anexado';
    document.getElementById('mdlClues').innerText = exp.hospital_clues || 'No especificado';
    document.getElementById('mdlDireccion').innerText = `${exp.calle || ''} ${exp.numero_exterior || ''}, ${exp.colonia || ''}, ${exp.municipio || ''}, ${exp.estado || ''} C.P. ${exp.codigo_postal || ''}`;
    document.getElementById('mdlReligion').innerText = exp.religion || 'No especificada';
    document.getElementById('mdlLenguaIndigena').innerText = exp.lengua_indigena || 'No especificada';
    document.getElementById('mdlNacionalidad').innerText = exp.nacionalidad || 'No especificada';
     document.getElementById('mdlIdentidadGenero').innerText = exp.identidad_genero || 'No especificada';
    document.getElementById('mdlFormacionAcademica').innerText = exp.formacion_academica || 'No especificada';
    document.getElementById('mdlNotasAdicionales').innerText = exp.notas_adicionales || 'Sin notas adicionales';
    const modal = new bootstrap.Modal(document.getElementById('modalDetalles'));
    modal.show();
}

function configurarBuscadorPacientes(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const clearBtn = input.parentElement.querySelector('.clear-icon');
    let debounceTimer;

    input.addEventListener('input', function () {
        if (this.value.length > 0) clearBtn.classList.add('visible');
        else clearBtn.classList.remove('visible');

        const query = this.value.trim();
        if (query.length < 1) { list.style.display = 'none'; return; }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const { data, error } = await supabaseClient.from('expedientes').select('paciente_nombre').ilike('paciente_nombre', `%${query}%`).limit(10);
            if (error) { console.error("Error buscando:", error); return; }
            const nombresUnicos = [...new Set(data.map(item => item.paciente_nombre))];
            list.innerHTML = '';
            list.style.display = 'block';
            if (nombresUnicos.length > 0) {
                nombresUnicos.forEach(nombre => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.innerHTML = `<div><i class="bi bi-person me-2 text-muted"></i><strong>${nombre}</strong></div>`;
                    item.onclick = function () { input.value = nombre; list.style.display = 'none'; cargarExpedientes(); };
                    list.appendChild(item);
                });
            } else { list.innerHTML = '<div class="p-3 text-muted small text-center">Sin registro de ese paciente</div>'; }
        }, 300);
    });

    document.addEventListener('click', function (e) { if (e.target !== input && e.target !== list) list.style.display = 'none'; });
}