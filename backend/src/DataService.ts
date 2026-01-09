import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import stringSimilarity from 'string-similarity';

// Definimos cómo se ve un item de datos
interface ItemData {
    texto: string;
    categoria: string;
    metadata?: any;
}

export class DataService {
    private static instance: DataService;
    private data: ItemData[] = [];
    private isLoaded: boolean = false;

    private constructor() {}

    // Singleton para no cargar los CSV en cada petición
    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    // Función para encontrar la ruta correcta de 'data'
    private getDataPath(): string {
        // Intenta buscar en la carpeta dist/data (producción) o en ../data (desarrollo)
        const possiblePaths = [
            path.join(__dirname, 'data'),           // Si data está junto al script
            path.join(__dirname, '../data'),        // Si está un nivel arriba
            path.join(__dirname, '../../data'),     // Si está dos niveles arriba
            path.join(process.cwd(), 'data')        // Raíz del proyecto
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                console.log(`Carpeta data encontrada en: ${p}`);
                return p;
            }
        }
        throw new Error(`No se encontró la carpeta 'data'. Busqué en: ${possiblePaths.join(', ')}`);
    }

    // Carga los 3 archivos CSV
    public async cargarDatos(): Promise<void> {
        if (this.isLoaded) return;

        const dataPath = this.getDataPath();
        
        // Promesa para cargar los 3 archivos en paralelo
        await Promise.all([
            this.leerCSV(path.join(dataPath, 'medicamentos.csv'), 'medicamentos'),
            this.leerCSV(path.join(dataPath, 'parentesco.csv'), 'parentesco'),
            this.leerCSV(path.join(dataPath, 'identidad_de_genero.csv'), 'identidad_de_genero')
        ]);

        this.isLoaded = true;
        console.log(`Total de datos cargados: ${this.data.length}`);
    }

    private leerCSV(filePath: string, categoria: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(filePath)) {
                console.warn(`Archivo no encontrado: ${filePath}`);
                resolve(); // No fallamos si falta uno, solo lo ignoramos
                return;
            }

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row: any) => {
                    // ASUMIENDO QUE TU CSV TIENE UNA COLUMNA LLAMADA 'nombre' o 'texto'
                    // Ajusta 'row.nombre' según el encabezado de tu CSV real
                    const texto = row.nombre || row.texto || row.term || Object.values(row)[0]; 
                    
                    if (texto) {
                        this.data.push({
                            texto: texto.toString(),
                            categoria: categoria,
                            metadata: row // Guardamos el resto por si acaso
                        });
                    }
                })
                .on('end', () => resolve())
                .on('error', (error) => reject(error));
        });
    }

    public buscar(query: string, categoriaFiltro?: string): any[] {
        if (!query) return [];
        
        const queryNorm = query.toLowerCase();

        // 1. Filtrar primero por categoría si se solicita
        let pool = this.data;
        if (categoriaFiltro && categoriaFiltro !== 'todos') {
            pool = pool.filter(item => item.categoria === categoriaFiltro);
        }

        // 2. Búsqueda simple (contiene el texto) + Fuzzy
        const resultados = pool
            .map(item => {
                // Calcular similitud (0 a 1)
                const similitud = stringSimilarity.compareTwoStrings(queryNorm, item.texto.toLowerCase());
                return { ...item, confianza: similitud };
            })
            .filter(item => item.confianza > 0.3) // Umbral mínimo de coincidencia
            .sort((a, b) => b.confianza - a.confianza) // Ordenar por mejor coincidencia
            .slice(0, 15); // Limitar a 15 resultados

        return resultados;
    }
}