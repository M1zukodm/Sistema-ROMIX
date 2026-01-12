const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const API_URL = CONFIG.API_URL;

let existeRiesgoActivo = false;
let validandoActualmente = false;
let blurTimer;
let cacheColoniasCP = [];
let expedientesCache = [];
let editModeId = null;
let idParaBorrar = null; // Variable temporal para el modal de borrado

checkBackendStatus();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Quitar errores visuales al escribir
    document.body.addEventListener('input', function (e) {
        if (e.target.classList.contains('form-control') || e.target.classList.contains('form-input')) {
            e.target.classList.remove('is-invalid');
            e.target.classList.remove('shake-error');
        }
    });

    // 2. Si estamos en Consultas (Tabla), mostrar estado inicial
    if (document.getElementById('tablaExpedientes')) {
        setTimeout(() => {
            if (typeof mostrarEstadoInicial === 'function') mostrarEstadoInicial();
        }, 500);
    }

    // 3. Si estamos en Formulario, revisar si es EDICIÓN
    const urlParams = new URLSearchParams(window.location.search);
    const idEdicion = urlParams.get('id');
    if (document.getElementById('expedienteForm') && idEdicion) {
        cargarDatosParaEdicion(idEdicion);
    }

    // 4. Configurar Botón Cancelar Inteligente
    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            if (editModeId) {
                window.location.href = 'consultas.html';
            } else {
                document.getElementById('expedienteForm').reset();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
});

// === LÓGICA DE ESTADO DEL BACKEND ===
async function checkBackendStatus() {
    const toastEl = document.getElementById('backendToast');
    const toastBody = document.getElementById('toastStatusMsg') || document.getElementById('toastMessage');
    
    if (!toastEl || !toastBody) return;

    try {
        const response = await fetch(API_URL, { method: 'GET' });
        if (response.ok) {
            toastEl.classList.remove('hidden');
            toastBody.innerHTML = '<span class="flex items-center gap-2"><span class="w-2 h-2 bg-green-400 rounded-full"></span> Backend Online</span>';
            setTimeout(() => toastEl.classList.add('hidden'), 2500);
        }
    } catch (error) {
        toastEl.classList.remove('hidden');
        toastBody.innerHTML = '<span class="flex items-center gap-2"><span class="w-2 h-2 bg-red-500 rounded-full"></span> Backend Offline</span>';
    }
}

// === LÓGICA DE EDICIÓN (CARGA DE DATOS) ===
async function cargarDatosParaEdicion(id) {
    const btn = document.getElementById('btnGuardar');
    if(btn) {
        btn.innerHTML = 'Cargando datos...';
        btn.disabled = true;
    }

    try {
        const { data, error } = await supabaseClient
            .from('expedientes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (data) {
            editModeId = data.id;
            
            // Título
            const titulo = document.querySelector('h2'); // Busca el h2 del título
            if (titulo) titulo.innerText = "Editando Expediente";
            
            if(btn) {
                btn.innerHTML = 'Actualizar Expediente';
                btn.classList.remove('bg-primary');
                btn.classList.add('bg-orange-600', 'hover:bg-orange-700');
                btn.disabled = false;
            }

            // Llenar campos
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

            setVal('pacienteNombre', data.paciente_nombre);
            setVal('pacienteEdad', data.paciente_edad);
            setVal('pacienteTelefono', data.paciente_telefono);
            setVal('pacienteCorreo', data.paciente_correo);
            setVal('inputNacionalidad', data.nacionalidad);
            setVal('inputIdentidad', data.identidad_genero);
            setVal('calle', data.calle);
            setVal('numeroExterior', data.numero_exterior);
            setVal('inputCodigoPostal', data.codigo_postal);
            setVal('inputColonia', data.colonia);
            setVal('inputMunicipio', data.municipio);
            setVal('inputEstado', data.estado);
            setVal('familiarNombre', data.familiar_nombre);
            setVal('inputParentesco', data.familiar_parentesco);
            setVal('familiarTelefono', data.familiar_telefono);
            setVal('familiarCorreo', data.familiar_correo);
            setVal('inputReligion', data.religion);
            setVal('inputLenguaIndigena', data.lengua_indigena);
            setVal('inputFormacionAcademica', data.formacion_academica);
            setVal('notasAdicionales', data.notas_adicionales);
            setVal('inputCif', data.hospital_cif);
            setVal('inputClues', data.hospital_clues);
            setVal('inputDiagnostico', data.diagnostico);
            setVal('inputMedicamento', data.medicamento);

            document.querySelectorAll('.clear-icon').forEach(icon => {
                const input = icon.previousElementSibling;
                if(input && input.value) icon.classList.add('visible');
            });
        }
    } catch (err) {
        console.error("Error cargando edición:", err);
        alert("No se pudo cargar el expediente.");
        window.location.href = 'consultas.html';
    }
}

// === LÓGICA DE BORRADO (MODAL) ===
window.abrirModalBorrar = function(id) {
    idParaBorrar = id;
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) modal.classList.remove('hidden');
}

window.cerrarModalBorrar = function() {
    idParaBorrar = null;
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) modal.classList.add('hidden');
}

window.confirmarBorrado = async function() {
    if (!idParaBorrar) return;
    
    // UI Loading en botón
    const btnConfirm = document.getElementById('btnConfirmDelete');
    const originalText = btnConfirm.innerHTML;
    btnConfirm.innerHTML = 'Borrando...';
    btnConfirm.disabled = true;

    try {
        const { error } = await supabaseClient.from('expedientes').delete().eq('id', idParaBorrar);
        if (error) throw error;
        
        cerrarModalBorrar();
        cargarExpedientes(); // Recargar tabla
        
        // Toast simple
        /* Puedes agregar un toast aquí si quieres */
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btnConfirm.innerHTML = originalText;
        btnConfirm.disabled = false;
    }
}

window.irAEditar = function(id) {
    window.location.href = `index.html?id=${id}`;
}

// === TABLA Y CONSULTAS ===
function mostrarEstadoInicial() {
    const tbody = document.getElementById('tablaExpedientes');
    const msgVacio = document.getElementById('mensajeVacio');
    
    if (msgVacio) msgVacio.style.display = 'none';
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-12 text-gray-400">
                    <div class="flex flex-col items-center">
                        <span class="material-symbols-outlined text-5xl mb-3 text-gray-300">search</span>
                        <p class="text-lg font-medium">Comienza tu búsqueda</p>
                        <p class="text-sm">Usa los filtros superiores para encontrar pacientes.</p>
                    </div>
                </td>
            </tr>`;
    }
}

window.cargarExpedientes = async function () {
    const tbody = document.getElementById('tablaExpedientes');
    const msgVacio = document.getElementById('mensajeVacio');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Cargando...</td></tr>';
    if (msgVacio) msgVacio.style.display = 'none';

    const valGeneral = document.getElementById('filtroGeneral') ? document.getElementById('filtroGeneral').value.trim() : '';
    const valDiag = document.getElementById('filtroDiagnostico') ? document.getElementById('filtroDiagnostico').value.trim() : '';
    const valMed = document.getElementById('filtroMedicamento') ? document.getElementById('filtroMedicamento').value.trim() : '';

    let query = supabaseClient.from('expedientes').select('*').order('created_at', { ascending: false });

    if (valGeneral) query = query.ilike('paciente_nombre', `%${valGeneral}%`);
    if (valDiag) query = query.ilike('diagnostico', `%${valDiag}%`);
    if (valMed) query = query.ilike('medicamento', `%${valMed}%`);

    const { data, error } = await query;

    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500">Error al cargar datos.</td></tr>';
        return;
    }

    expedientesCache = data || [];
    tbody.innerHTML = '';

    if (!expedientesCache || expedientesCache.length === 0) {
        if (msgVacio) msgVacio.style.display = 'block';
        return;
    }

    expedientesCache.forEach((exp, index) => {
        const fecha = new Date(exp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        
        const row = `
        <tr class="hover:bg-gray-50 border-b border-gray-100 group transition-colors">
            <td class="px-6 py-4 text-sm text-gray-600">${fecha}</td>
            <td class="px-6 py-4 font-bold text-primary group-hover:text-blue-700 cursor-pointer" onclick="verDetalle(${index})">
                ${exp.paciente_nombre}
            </td>
            <td class="px-6 py-4">
                <span class="bg-red-50 text-red-700 px-2 py-1 rounded text-xs border border-red-100 font-medium">
                    ${exp.diagnostico ? exp.diagnostico.split(' ')[0] : 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 truncate max-w-[150px]">
                ${exp.medicamento ? exp.medicamento : 'N/A'}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex justify-center gap-2">
                    <button class="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Ver" onclick="verDetalle(${index})">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                    <button class="text-gray-400 hover:text-orange-500 transition-colors p-1" title="Editar" onclick="irAEditar('${exp.id}')">
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button class="text-gray-400 hover:text-red-600 transition-colors p-1" title="Borrar" onclick="abrirModalBorrar('${exp.id}')">
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

window.limpiarFiltros = function () {
    limpiarInput('filtroGeneral');
    limpiarInput('filtroDiagnostico');
    limpiarInput('filtroMedicamento');
    const msg = document.getElementById('mensajeVacio');
    if (msg) msg.style.display = 'none';
    expedientesCache = [];
    mostrarEstadoInicial();
}

window.verDetalle = function (index) {
    const exp = expedientesCache[index];
    if (!exp) return;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val || '---'; };

    setTxt('mdlNombre', exp.paciente_nombre);
    setTxt('mdlEdad', `${exp.paciente_edad} años`);
    setTxt('mdlFecha', new Date(exp.created_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    setTxt('mdlFamiliar', `${exp.familiar_nombre} (${exp.familiar_parentesco})`);
    setTxt('mdlDiagnostico', exp.diagnostico);
    setTxt('mdlMedicamento', exp.medicamento);
    setTxt('mdlDireccion', `${exp.calle} ${exp.numero_exterior}, ${exp.colonia}, ${exp.municipio}`);
    setTxt('mdlNotasAdicionales', exp.notas_adicionales);
    
    setTxt('mdlNacionalidad', exp.nacionalidad);
    setTxt('mdlIdentidadGenero', exp.identidad_genero);
    setTxt('mdlCif', exp.hospital_cif);
    setTxt('mdlClues', exp.hospital_clues);
    setTxt('mdlReligion', exp.religion);
    setTxt('mdlLenguaIndigena', exp.lengua_indigena);
    setTxt('mdlFormacionAcademica', exp.formacion_academica);

    const tailwindModal = document.getElementById('tailwindModal');
    const bootstrapModalEl = document.getElementById('modalDetalles');

    if (tailwindModal) {
        tailwindModal.classList.remove('hidden');
    } else if (bootstrapModalEl) {
        const modal = new bootstrap.Modal(bootstrapModalEl);
        modal.show();
    }
}

window.cerrarModal = function () {
    const m = document.getElementById('tailwindModal');
    if (m) m.classList.add('hidden');
}

// === FUNCIONES COMPARTIDAS ===
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

function configurarBuscador(inputId, listId, categoriaAzure, onSelect = null) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const list = document.getElementById(listId);
    const clearBtn = input.parentElement.querySelector('.clear-icon');
    let debounceTimer;

    input.addEventListener('input', function () {
        const query = this.value;
        if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

        if (inputId === 'inputCodigoPostal') limpiarCamposDireccion();

        if (query.length < 1) {
            if (list) list.style.display = 'none';
            return;
        }

        if (inputId === 'inputColonia' && cacheColoniasCP.length > 0) {
            if (query.length === 0) mostrarOpcionesDeColoniaCache();
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
                    const vistos = new Set();
                    const sugerenciasUnicas = data.sugerencias.filter(item => {
                        const textoKey = item.texto.trim().toLowerCase();
                        if (vistos.has(textoKey)) return false;
                        vistos.add(textoKey);
                        return true;
                    });
                    if (list) mostrarSugerencias(sugerenciasUnicas, list, input, categoriaAzure, onSelect);
                } else {
                    if (list) list.style.display = 'none';
                }
            } catch (error) { console.error(error); }
        }, 300);
    });

    const mostrarCache = () => {
        if (clearBtn && input.value.length > 0) clearBtn.classList.add('visible');
        if (inputId === 'inputColonia' && cacheColoniasCP.length > 0) mostrarOpcionesDeColoniaCache();
    };
    input.addEventListener('focus', mostrarCache);
    input.addEventListener('click', mostrarCache);

    document.addEventListener('click', function (e) {
        if (list && e.target !== input && e.target !== list && e.target !== clearBtn) { list.style.display = 'none'; }
    });
}

window.limpiarInput = function (id) {
    const input = document.getElementById(id);
    if (!input) return;

    input.value = '';
    input.focus();
    const clearBtn = input.parentElement.querySelector('.clear-icon');
    if (clearBtn) clearBtn.classList.remove('visible');

    input.classList.remove('is-invalid');
    input.classList.remove('shake-error');

    if (id === 'inputCodigoPostal') limpiarCamposDireccion();
    if (id === 'inputMedicamento' && typeof resetearValidacion === 'function') resetearValidacion();

    if (id.includes('filtro')) {
        const listName = 'lista' + id.charAt(0).toUpperCase() + id.slice(1);
        const list = document.getElementById(listName) || document.getElementById(listName.replace('Filtro', 'FiltroDiag')) || document.getElementById(listName.replace('Filtro', 'FiltroMed'));
        if (list) list.style.display = 'none';
    }
}

function limpiarCamposDireccion() {
    cacheColoniasCP = [];
    const ids = ['inputColonia', 'inputMunicipio', 'inputEstado'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.classList.remove('campo-autocompletado');
        }
    });
}

function mostrarSugerencias(sugerencias, listElement, inputElement, categoria, onSelect = null) {
    listElement.innerHTML = '';
    listElement.style.display = 'block';

    sugerencias.forEach(sug => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';

        let tituloPrincipal = sug.texto;
        let badgeHtml = '';

        if (sug.metadata.dato_extra) {
            let colorClases = 'bg-gray-100 text-gray-600';
            if (categoria === 'diagnosticos') colorClases = 'bg-red-50 text-red-600 border border-red-100';
            else if (categoria === 'medicamentos') colorClases = 'bg-blue-50 text-blue-600 border border-blue-100';
            else if (categoria === 'cif') colorClases = 'bg-gray-100 text-gray-700 border border-gray-200';
            else if (categoria === 'clues') colorClases = 'bg-teal-50 text-teal-600 border border-teal-100';
            
            badgeHtml = `<span class="${colorClases} text-[10px] font-bold px-2 py-0.5 rounded ml-2 whitespace-nowrap">${sug.metadata.dato_extra}</span>`;
        }

        if (categoria === 'codigos_postales') {
            const cpReal = sug.metadata.dato_extra || sug.texto;
            const colNombre = sug.texto;
            tituloPrincipal = `${cpReal} - ${colNombre}`;
            badgeHtml = ''; 
        }

        let subtituloVisual = sug.metadata.subtitulo || '';
        if (subtituloVisual.includes('_')) {
            subtituloVisual = subtituloVisual.replace(/_/g, ' ');
        }

        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-gray-800 text-sm">${tituloPrincipal}</div>
                    <div class="text-xs text-gray-500">${subtituloVisual}</div>
                </div>
                ${badgeHtml}
            </div>
        `;

        item.onmousedown = function (e) {
            e.preventDefault();
            let valorFinal = sug.texto;

            if ((categoria === 'diagnosticos' || categoria === 'cif' || categoria === 'clues') && sug.metadata.dato_extra) {
                valorFinal = `${sug.metadata.dato_extra} - ${sug.texto}`;
            }

            inputElement.value = valorFinal;
            inputElement.classList.remove('is-invalid');

            const clearBtn = inputElement.parentElement.querySelector('.clear-icon');
            if (clearBtn) clearBtn.classList.add('visible');

            listElement.style.display = 'none';

            if (document.getElementById('expedienteForm') && (inputElement.id === 'inputMedicamento' || inputElement.id === 'inputDiagnostico')) {
                verificarInteracciones();
            }

            if (inputElement.id.includes('filtro')) {
                cargarExpedientes();
            }

            if (onSelect) onSelect(sug);
        };
        listElement.appendChild(item);
    });
}

function mostrarOpcionesDeCacheFiltradas(filtrados) {
    const list = document.getElementById('listaColonia');
    const input = document.getElementById('inputColonia');
    list.innerHTML = '';
    if (filtrados.length === 0) { list.style.display = 'none'; return; }
    list.style.display = 'block';
    filtrados.forEach(dato => crearItemCache(dato, list, input));
}

function mostrarOpcionesDeColoniaCache() {
    const list = document.getElementById('listaColonia');
    const input = document.getElementById('inputColonia');
    if (cacheColoniasCP.length === 0) return;
    list.innerHTML = '';
    list.style.display = 'block';
    cacheColoniasCP.forEach(dato => crearItemCache(dato, list, input));
}

function crearItemCache(dato, list, input) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `<div><i class="bi bi-geo-alt-fill me-2 text-primary"></i><strong>${dato.colonia}</strong></div>`;
    item.onmousedown = function (e) {
        e.preventDefault();
        input.value = dato.colonia;
        input.classList.remove('is-invalid');
        list.style.display = 'none';
        const clearBtn = input.parentElement.querySelector('.clear-icon');
        if (clearBtn) clearBtn.classList.add('visible');

        const munInput = document.getElementById('inputMunicipio');
        if (munInput && dato.municipio) {
            munInput.value = dato.municipio;
            munInput.classList.add('campo-autocompletado');
        }
        const edoInput = document.getElementById('inputEstado');
        if (edoInput && dato.estado) {
            edoInput.value = dato.estado;
            edoInput.classList.add('campo-autocompletado');
        }
    };
    list.appendChild(item);
}

// ==========================================
// VALIDACIONES Y LOGICA DE NEGOCIO
// ==========================================

async function verificarInteracciones() {
    const inputDiag = document.getElementById('inputDiagnostico');
    const inputMed = document.getElementById('inputMedicamento');
    const BASE_URL = API_URL.substring(0, API_URL.lastIndexOf('/'));
    const VALIDAR_URL = `${BASE_URL}/ValidarInteraccion`;

    const diag = inputDiag.value.trim();
    const med = inputMed.value.trim();

    if (med.length < 2) { resetearValidacion(); return; }
    if (diag.length < 2) return;
    if (validandoActualmente) return;
    validandoActualmente = true;

    const iconContainer = inputMed.parentElement.querySelector('.input-group-text i');
    
    try {
        const response = await fetch(VALIDAR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diagnostico: diag, medicamento: med })
        });

        if (inputMed.value.trim().length < 2) { resetearValidacion(); return; }

        const data = await response.json();

        if (data.riesgo === true) {
            existeRiesgoActivo = true;
            bloquearGuardado(true);
            mostrarAlertaClinica(data.mensaje);
            inputMed.classList.add("is-invalid");
            if(iconContainer) iconContainer.className = "bi bi-exclamation-triangle-fill text-danger";
        } else {
            resetearValidacion(false);
            if(iconContainer) iconContainer.className = "bi bi-check-circle-fill text-success";
        }
    } catch (error) { console.error(error); } 
    finally { validandoActualmente = false; }
}

function bloquearGuardado(bloquear) {
    const btnGuardar = document.getElementById('btnGuardar');
    const msgBloqueo = document.getElementById('msgBloqueo');
    if (btnGuardar) btnGuardar.disabled = bloquear;
    if (msgBloqueo) {
        msgBloqueo.style.display = bloquear ? 'block' : 'none';
        if(bloquear) msgBloqueo.classList.remove('hidden');
        else msgBloqueo.classList.add('hidden');
    }
}

function resetearValidacion(borrarTexto = false) {
    existeRiesgoActivo = false;
    bloquearGuardado(false);
    const inputMed = document.getElementById('inputMedicamento');
    if (!inputMed) return;

    if (borrarTexto) inputMed.value = '';
    inputMed.classList.remove("is-invalid");
    
    const iconContainer = inputMed.parentElement.querySelector('.input-group-text i');
    if(iconContainer) iconContainer.className = "bi bi-capsule text-primary";

    const toastEl = document.getElementById('warningToast');
    if (toastEl) {
        toastEl.classList.add('hidden');
        toastEl.classList.remove('show');
        if (typeof bootstrap !== 'undefined') {
            const toast = bootstrap.Toast.getInstance(toastEl);
            if (toast) toast.hide();
        }
    }
}

window.corregirMedicamento = function () {
    validandoActualmente = false;
    limpiarInput('inputMedicamento');
    resetearValidacion(true);
}

function mostrarAlertaClinica(mensaje) {
    const toastEl = document.getElementById('warningToast');
    const msgEl = document.getElementById('warningMsg');
    if (toastEl && msgEl) {
        msgEl.innerHTML = mensaje;
        if (typeof bootstrap !== 'undefined' && toastEl.classList.contains('custom-toast')) {
            const toast = new bootstrap.Toast(toastEl, { autohide: false });
            toast.show();
        } else {
            toastEl.classList.remove('hidden');
            toastEl.style.display = 'block';
        }
    }
}

function agendarValidacionBlur() {
    const inputMed = document.getElementById('inputMedicamento');
    if (!inputMed) return;
    if (validandoActualmente) return;
    blurTimer = setTimeout(() => {
        if (inputMed.value.length > 2) verificarInteracciones();
    }, 200);
}

// ==========================================
// INICIALIZACIÓN DEL FORMULARIO
// ==========================================
const formExpediente = document.getElementById('expedienteForm');

if (formExpediente) {
    // Configuración CP
    configurarBuscador('inputCodigoPostal', 'listaCodigoPostal', 'codigos_postales', async (seleccion) => {
        const cpCorrecto = seleccion.metadata.dato_extra || "00000";
        document.getElementById('inputCodigoPostal').value = cpCorrecto;
        document.getElementById('inputColonia').value = seleccion.texto;
        const ubicacion = extraerUbicacion(seleccion.metadata.subtitulo);
        if (ubicacion.municipio) {
            const el = document.getElementById('inputMunicipio');
            el.value = ubicacion.municipio; el.classList.add('campo-autocompletado');
        }
        if (ubicacion.estado) {
            const el = document.getElementById('inputEstado');
            el.value = ubicacion.estado; el.classList.add('campo-autocompletado');
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
                    return { colonia: item.texto, municipio: infoGeo.municipio, estado: infoGeo.estado };
                });
            }
        } catch (error) { console.error(error); }
    });

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

    const inputMed = document.getElementById('inputMedicamento');
    const inputDiag = document.getElementById('inputDiagnostico');
    if (inputMed) inputMed.addEventListener('blur', agendarValidacionBlur);
    if (inputDiag) inputDiag.addEventListener('blur', () => {
        setTimeout(() => { if (inputMed && inputMed.value.length > 2 && !validandoActualmente) verificarInteracciones(); }, 200);
    });

    formExpediente.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const camposCriticos = [
            { id: 'pacienteNombre', msg: 'Falta nombre' },
            { id: 'pacienteEdad', msg: 'Falta edad' },
            { id: 'inputDiagnostico', msg: 'Falta diagnóstico' },
            { id: 'inputMedicamento', msg: 'Falta medicamento' },
            { id: 'inputCodigoPostal', msg: 'Falta CP' },
            { id: 'familiarNombre', msg: 'Falta nombre familiar' },
            { id: 'inputParentesco', msg: 'Falta parentesco' },
            { id: 'familiarTelefono', msg: 'Falta teléfono familiar' }
        ];

        let primerError = null;
        let hayErrores = false;

        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));

        const edadInput = document.getElementById('pacienteEdad');
        if (edadInput && (parseInt(edadInput.value) <= 0 || !edadInput.value)) {
            edadInput.classList.add('is-invalid', 'shake-error');
            setTimeout(() => edadInput.classList.remove('shake-error'), 500);
            if (!primerError) primerError = edadInput;
            hayErrores = true;
        }

        camposCriticos.forEach(campo => {
            const input = document.getElementById(campo.id);
            if (input && !input.value.trim()) {
                input.classList.add('is-invalid', 'shake-error');
                setTimeout(() => input.classList.remove('shake-error'), 500);
                setTimeout(() => input.classList.remove('is-invalid'), 2500);
                if (!primerError) primerError = input;
                hayErrores = true;
            } else if (input && input !== edadInput) {
                input.classList.add('is-valid');
                setTimeout(() => input.classList.remove('is-valid'), 2500);
            }
        });

        if (hayErrores) {
            if (primerError) primerError.focus();
            const toastEl = document.getElementById('validationToast');
            if (toastEl) {
                if (typeof bootstrap !== 'undefined') new bootstrap.Toast(toastEl).show();
                else { toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'), 3000); }
            }
            return;
        }

        if (existeRiesgoActivo) {
            mostrarAlertaClinica("Existe una interacción médica activa.");
            return;
        }

        // --- AQUÍ ESTÁ EL CAMBIO: SI ES EDICIÓN, CONFIRMAR ANTES ---
        if(editModeId) {
            abrirModalConfirmarEdicion();
            return;
        }

        // Si es nuevo, guardamos directo
        ejecutarGuardado();
    });
}

window.abrirModalConfirmarEdicion = function() {
    const modal = document.getElementById('confirmUpdateModal');
    if (modal) modal.classList.remove('hidden');
}

window.cerrarModalConfirmarEdicion = function() {
    const modal = document.getElementById('confirmUpdateModal');
    if (modal) modal.classList.add('hidden');
}

window.ejecutarGuardado = async function() {
    const btn = document.getElementById('btnGuardar');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = editModeId ? 'Actualizando...' : 'Guardando...';

    // Cerrar modal si estaba abierto
    cerrarModalConfirmarEdicion();

    const payload = {
        paciente_nombre: document.getElementById('pacienteNombre').value,
        paciente_edad: parseInt(document.getElementById('pacienteEdad').value),
        paciente_telefono: document.getElementById('pacienteTelefono').value,
        paciente_correo: document.getElementById('pacienteCorreo').value,
        nacionalidad: document.getElementById('inputNacionalidad').value,
        identidad_genero: document.getElementById('inputIdentidad').value,
        familiar_nombre: document.getElementById('familiarNombre').value,
        familiar_parentesco: document.getElementById('inputParentesco').value,
        familiar_telefono: document.getElementById('familiarTelefono').value,
        familiar_correo: document.getElementById('familiarCorreo').value,
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
    };

    if(!editModeId) {
        payload.created_at = new Date();
    }

    try {
        let result;
        if (editModeId) {
            result = await supabaseClient.from('expedientes').update(payload).eq('id', editModeId);
        } else {
            result = await supabaseClient.from('expedientes').insert([payload]);
        }

        if (result.error) throw result.error;
        
        const toastSuccess = document.getElementById('liveToast');
        if(toastSuccess) {
                const toastMsg = toastSuccess.querySelector('#toastMsg');
                if (toastMsg) {
                    toastMsg.innerText = editModeId ? "Expediente actualizado correctamente." : "Expediente guardado correctamente.";
                }
                if (typeof bootstrap !== 'undefined') new bootstrap.Toast(toastSuccess).show();
                else { toastSuccess.classList.remove('hidden'); setTimeout(()=>toastSuccess.classList.add('hidden'), 3000); }
        }
        
        if(editModeId) {
            setTimeout(() => window.location.href = 'consultas.html', 1500);
        } else {
            document.getElementById('expedienteForm').reset();
            document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
            cacheColoniasCP = [];
            resetearValidacion();
        }
    } catch (err) {
        console.error(err);
        alert("Error al guardar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

const tablaConsultas = document.getElementById('tablaExpedientes');

if (tablaConsultas) {
    configurarBuscador('filtroDiagnostico', 'listaFiltroDiag', 'diagnosticos');
    configurarBuscador('filtroMedicamento', 'listaFiltroMed', 'medicamentos');

    const inputPacientes = document.getElementById('filtroGeneral');
    const listPacientes = document.getElementById('listaFiltroGeneral');
    if (inputPacientes) {
        let debouncePac;
        inputPacientes.addEventListener('input', function () {
            const query = this.value;
            const clearBtn = this.parentElement.querySelector('.clear-icon');
            if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);
            if (query.length < 1) { listPacientes.style.display = 'none'; return; }

            clearTimeout(debouncePac);
            debouncePac = setTimeout(async () => {
                const { data, error } = await supabaseClient.from('expedientes')
                    .select('paciente_nombre')
                    .ilike('paciente_nombre', `%${query}%`)
                    .limit(5);

                if (!error && data.length > 0) {
                    listPacientes.innerHTML = '';
                    listPacientes.style.display = 'block';
                    const unicos = [...new Set(data.map(i => i.paciente_nombre))];
                    unicos.forEach(nombre => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.innerHTML = `<strong>${nombre}</strong>`;
                        item.onclick = () => {
                            inputPacientes.value = nombre;
                            listPacientes.style.display = 'none';
                            cargarExpedientes();
                        };
                        listPacientes.appendChild(item);
                    });
                } else { listPacientes.style.display = 'none'; }
            }, 300);
        });
        
        document.addEventListener('click', function(e) {
            if(e.target !== inputPacientes && e.target !== listPacientes) {
                listPacientes.style.display = 'none';
            }
        });
    }
}