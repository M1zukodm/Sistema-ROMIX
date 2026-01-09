require('dotenv').config();
const { SearchIndexClient, AzureKeyCredential } = require("@azure/search-documents");

// CREDENCIALES
const endpoint = process.env.SEARCH_ENDPOINT || "PON_TU_ENDPOINT_AQUI";
const apiKey = process.env.SEARCH_API_KEY || "PON_TU_CLAVE_AQUI";

if (!apiKey) {
    throw new Error("❌ Error: No se encontró SEARCH_API_KEY en el archivo .env");
}

const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));

async function main() {
    
    const mapaSinonimos = {
        name: "mis-sinonimos",
        format: "solr",
        synonyms: [
            "padre, papá, papi, progenitor, tutor, padre de familia",
            "madre, mamá, mami, progenitora",
            "dolor de cabeza, cefalea, migraña, jaqueca",
            "estómago, panza, barriga, abdominal, dolor de panza",
            "fiebre, temperatura, calentura, hipertermia, cuerpo cortado"
        ]
    };

    try {
        console.log("⏳ Enviando mapa de sinónimos a Azure...");
        await client.createOrUpdateSynonymMap(mapaSinonimos);
        console.log("✅ ¡LISTO! Mapa 'mis-sinonimos' creado correctamente.");
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main();