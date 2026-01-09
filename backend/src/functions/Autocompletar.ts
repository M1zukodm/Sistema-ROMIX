import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

// --- CONFIGURACIÓN SOLO AZURE (Sin IA) ---
const searchEndpoint = process.env.SEARCH_ENDPOINT;
const searchApiKey = process.env.SEARCH_API_KEY;
const searchIndexName = process.env.SEARCH_INDEX_NAME;

if (!searchEndpoint || !searchApiKey || !searchIndexName) {
    throw new Error("Faltan variables de entorno de Azure Search");
}

const searchClient = new SearchClient(
    searchEndpoint, 
    searchIndexName, 
    new AzureKeyCredential(searchApiKey)
);

interface RequestBody {
    query: string;
    categoria?: string;
    page?: number;
}

export async function Autocompletar(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    
    // Manejo de CORS
    if (request.method === 'OPTIONS') return { status: 200, headers: getCorsHeaders() };
    if (request.method === 'GET') return { status: 200, jsonBody: { mensaje: "Backend Listo" }, headers: getCorsHeaders() };

    try {
        const body = await request.json() as RequestBody;
        const { query, categoria, page = 1 } = body;

        if (!query || query.trim().length < 1) {
            return { status: 400, jsonBody: { error: "Escribe algo" }, headers: getCorsHeaders() };
        }

        const termino = query.trim();

        // --- EL SECRETO: DOBLE BÚSQUEDA ---
        // 1. "${termino}" (sin asterisco) -> Azure activa tus SINÓNIMOS (Papá -> Padre)
        // 2. "${termino}*" (con asterisco) -> Azure activa el AUTOCOMPLETADO (Parace -> Paracetamol)
        // Usamos "OR" para traer resultados de cualquiera de los dos casos.
        const expandedQuery = `${termino} OR ${termino}*`;
        
        // --- BÚSQUEDA EN AZURE ---
        const searchOptions: any = {
            top: 10,
            skip: (page - 1) * 10,
            includeTotalCount: true,
            queryType: "full", // OBLIGATORIO: 'full' permite entender el operador 'OR' y el '*'
            searchFields: ["titulo", "subtitulo", "texto_busqueda", "dato_extra"],
            select: ["titulo", "subtitulo", "dato_extra", "tipo", "id"]
        };

        if (categoria && categoria !== 'todos') {
            searchOptions.filter = `tipo eq '${categoria}'`;
        }

        const searchResults = await searchClient.search(expandedQuery, searchOptions);
        
        const sugerencias = [];
        for await (const result of searchResults.results) {
            sugerencias.push({
                texto: result.document['titulo'],           
                categoria: result.document['tipo'],
                confianza: result.score,
                metadata: {
                    id: result.document['id'],
                    subtitulo: result.document['subtitulo'], 
                    dato_extra: result.document['dato_extra'] 
                }
            });
        }

        return {
            status: 200,
            jsonBody: {
                success: true,
                total: searchResults.count,
                page: page,
                totalPages: Math.ceil((searchResults.count || 0) / 10),
                sugerencias: sugerencias
            },
            headers: getCorsHeaders()
        };

    } catch (error: any) {
        context.error("❌ Error en Autocompletar:", error);
        return { status: 500, jsonBody: { error: error.message }, headers: getCorsHeaders() };
    }
}

function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}