const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const stripBom = require('strip-bom-stream');

// Configuración
const CARPETA_DATA = './data';
const ARCHIVO_SALIDA = './data_unificada.json';

const datosUnificados = [];

async function procesar() {
    console.log('--- Iniciando UNIFICACIÓN CORREGIDA (PRECIOS) ---');

    if (!fs.existsSync(CARPETA_DATA)) {
        console.error(`❌ Error: No existe la carpeta ${CARPETA_DATA}`);
        return;
    }

    const archivos = fs.readdirSync(CARPETA_DATA).filter(f => f.endsWith('.csv'));
    
    for (const archivo of archivos) {
        const categoria = archivo.toLowerCase().replace('.csv', '').trim();
        const ruta = path.join(CARPETA_DATA, archivo);
        
        console.log(`⏳ Procesando: ${archivo}...`);

        await new Promise((resolve, reject) => {
            let filas = 0;
            fs.createReadStream(ruta)
                .pipe(stripBom()) // Elimina caracteres raros al inicio del archivo
                .pipe(csv({
                    mapHeaders: ({ header }) => header.trim() // IMPORTANTE: Quita espacios en los nombres de columnas
                }))
                .on('data', (row) => {
                    
                    let item = {
                        id: uuidv4(),
                        tipo: categoria, 
                        titulo: "",      
                        subtitulo: "",   
                        dato_extra: null,
                        texto_busqueda: "" 
                    };

                    // --- LOGICA MEDICAMENTOS ---
                    if (categoria.includes('medicamentos')) {
                        const nombre = row['NOMBRE COMERCIAL'] || row['NOMBRE'] || '';
                        const sustancia = row['SUSTANCIA ACTIVA'] || row['SUSTANCIA'] || '';
                        const presentacion = row['PRESENTACION'] || '';

                        // --- CORRECCIÓN DE PRECIOS ---
                        // Buscamos en orden de prioridad: P.PUBLICO -> PRECIO NETO -> PRECIO
                        let precioRaw = row['P.PUBLICO'] || row['PRECIO NETO'] || row['PRECIO'] || '';
                        
                        // Limpieza del precio: Si viene "$500", lo dejamos como "500" para controlarlo nosotros
                        if (precioRaw) {
                            precioRaw = precioRaw.toString().replace('$', '').trim();
                        }

                        // Asignación de campos
                        item.titulo = nombre ? `${nombre} (${sustancia})` : sustancia;
                        item.subtitulo = presentacion;
                        
                        // Si encontramos precio, le agregamos el signo de pesos. Si no, null.
                        item.dato_extra = precioRaw ? `$${precioRaw}` : null;
                        
                        // Texto de búsqueda
                        item.texto_busqueda = `${nombre} ${sustancia} ${presentacion} medicamento`.toLowerCase();
                    } 
                    
                    // --- LOGICA PARENTESCO ---
                    else if (categoria.includes('parentesco')) {
                        const familiar = row['FAMILIAR'] || row['PARENTESCO'] || Object.values(row)[0];
                        item.titulo = familiar;
                        item.subtitulo = "Relación familiar";
                        item.texto_busqueda = `${familiar} familia pariente`.toLowerCase();
                    } 
                    
                    // --- LOGICA IDENTIDAD ---
                    else if (categoria.includes('identidad')) {
                        const identidad = row['IDENTIDAD'] || row['GENERO'] || Object.values(row)[0];
                        item.titulo = identidad;
                        item.subtitulo = "Identidad de género";
                        item.texto_busqueda = `${identidad} género genero`.toLowerCase();
                    } 
                    
                    // --- LOGICA CIF ---
                    else if (categoria.includes('cif') || categoria.includes('codigos')) {
                        const codigo = row['Código'] || row['CODIGO'] || '';
                        const descripcion = row['Descripción'] || row['DESCRIPCION'] || '';
                        item.titulo = `${codigo} - ${descripcion}`;
                        item.subtitulo = "Clasificación CIF";
                        item.dato_extra = codigo;
                        item.texto_busqueda = `${codigo} ${descripcion} cif`.toLowerCase();
                    }
                   

                    // DIAGNÓSTICOS
                    else if (categoria.includes('diagnosticos')) {
                        const nombre = row['NOMBRE'] || row['Nombre'] || row['DESCRIPTION'] || '';
                        const clave = row['CATALOG_KEY'] || row['CLAVE'] || row['CODIGO'] || '';

                        // Mapeo Inteligente
                        item.titulo = nombre;           // Ej: "Gastroenteritis viral"
                        item.subtitulo = "Diagnóstico"; // Etiqueta gris
                        item.dato_extra = clave;        // Ej: "A084" (Saldrá en el badge)
                        
                        // CLAVE PARA AUTOCOMPLETADO MIXTO:
                        // Al meter los dos en 'texto_busqueda', Azure los encuentra indistantemente.
                        item.texto_busqueda = `${clave} ${nombre} diagnostico cie10`.toLowerCase();
                    }

                    

                    // Guardar solo si hay título válido
                    if (item.titulo) {
                        datosUnificados.push(item);
                        filas++;
                    }
                })
                .on('end', () => {
                    console.log(`   ✅ ${filas} registros procesados.`);
                    resolve();
                })
                .on('error', reject);
        });
    }

    try {
        fs.writeFileSync(ARCHIVO_SALIDA, JSON.stringify(datosUnificados, null, 2));
        console.log(`\n🎉 ARCHIVO CREADO: ${ARCHIVO_SALIDA}`);
        console.log(`Total registros: ${datosUnificados.length}`);
    } catch (err) {
        console.error('❌ Error guardando JSON:', err);
    }
}

procesar();