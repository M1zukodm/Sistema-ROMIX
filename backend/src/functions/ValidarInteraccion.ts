import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) { throw new Error("Falta GEMINI_API_KEY"); }

const genAI = new GoogleGenerativeAI(geminiApiKey);

// USAMOS TU MODELO QUE SI FUNCIONA, PERO CON PERMISOS PARA HABLAR DE MEDICINA
const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest", 
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE }
    ]
});

interface ValidationRequest {
    diagnostico: string;
    medicamento: string;
}

export async function ValidarInteraccion(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    if (request.method === 'OPTIONS') return { status: 200, headers: getCorsHeaders() };

    try {
        const body = await request.json() as ValidationRequest;
        const { diagnostico, medicamento } = body;

        if (!diagnostico || !medicamento || diagnostico.length < 2 || medicamento.length < 2) {
            return { status: 200, jsonBody: { riesgo: false }, headers: getCorsHeaders() };
        }

        context.log(`💊 Analizando: ${diagnostico} vs ${medicamento}`);

        const prompt = `
            Actúa como farmacólogo experto. Analiza la interacción entre:
            - Diagnóstico: "${diagnostico}"
            - Medicamento: "${medicamento}"

            Responde SOLO con este JSON:
            {
                "riesgo": true,  // true si hay contraindicación o peligro real. false si es seguro.
                "mensaje": "Alerta breve para el médico."
            }
        `;

        const result = await model.generateContent(prompt);
        
        // Verificamos si la respuesta fue bloqueada antes de leerla
        if (!result.response.candidates || result.response.candidates.length === 0) {
            throw new Error("La IA no devolvió candidatos (posible bloqueo de seguridad).");
        }

        const responseText = result.response.text(); // Aquí solía fallar si estaba bloqueado
        
        // Limpiamos el JSON por si la IA le puso comillas o markdown
        const jsonLimpio = responseText.replace(/```json|```/g, "").trim();
        
        let analisis;
        try {
            analisis = JSON.parse(jsonLimpio);
        } catch (e) {
            // Si el JSON falla, asumimos riesgo por precaución
            analisis = { riesgo: true, mensaje: "Posible interacción detectada (Revisar manualmente)." };
        }

        return {
            status: 200,
            jsonBody: analisis,
            headers: getCorsHeaders()
        };

    } catch (error: any) {
        context.error("❌ Error en validación:", error);
        // IMPORTANTE: Devolvemos 200 con un JSON de error para que el frontend no muestre error 500
        return { 
            status: 200, 
            jsonBody: { 
                riesgo: false, 
                mensaje: "No se pudo validar en este momento." 
            }, 
            headers: getCorsHeaders() 
        };
    }
}

function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}