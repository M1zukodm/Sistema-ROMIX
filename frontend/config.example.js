// ⚠️ INSTRUCCIONES:
// 1. Copia este archivo y llámalo 'config.js'.
// 2. El archivo 'config.js' NO se sube a GitHub (está en el .gitignore).
// 3. Pega tus claves reales en ese nuevo archivo.

const CONFIG = {
    // Tu URL de proyecto Supabase (Settings -> API)
    SUPABASE_URL: "https://tu-proyecto.supabase.co",

    // Tu clave pública 'anon' (Settings -> API -> Project API keys)
    // IMPORTANTE: Nunca pongas aquí la clave 'service_role' (esa es secreta).
    SUPABASE_KEY: "tu-clave-publica-anon-aqui",

    // La dirección de tu Backend (Azure Functions)
    // - Para desarrollo local usa: "http://localhost:7071/api"
    // - Para producción usa: "https://api-romix-v2.azurewebsites.net/api"
    API_URL: "http://localhost:7071/api"
};