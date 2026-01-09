# 🏥 ROM/X: Sistema de Soporte a la Decisión Clínica (CDSS)

![Status](https://img.shields.io/badge/Estado-En_Desarrollo-green)
![Tech](https://img.shields.io/badge/Stack-Azure_Functions_%7C_Supabase_%7C_Gemini-blue)
![License](https://img.shields.io/badge/Licencia-MIT-purple)

**ROM/X** no es solo un expediente clínico digital; es un sistema inteligente diseñado para **prevenir errores médicos (iatrogenia)** en tiempo real. Utiliza una arquitectura de **RAG Híbrido** que combina la precisión de catálogos médicos oficiales con el razonamiento clínico de la Inteligencia Artificial.

---

## 🚀 Características Principales

### 1. 🛡️ Validación Farmacológica Activa
El sistema actúa como un "segundo par de ojos". Al prescribir un medicamento para un diagnóstico específico:
- **Analiza:** Verifica interacciones peligrosas y contraindicaciones absolutas.
- **Interviene:** Si detecta un riesgo grave (ej. *Úlcera + Aspirina*), **bloquea físicamente** el guardado del expediente hasta que el médico justifique o cambie la prescripción.

### 2. ⚡ Autocompletado Determinista (Azure Search)
Búsqueda en milisegundos sobre catálogos oficiales (CIE-10 para diagnósticos, Catálogo de Medicamentos, CIF).
- Soporta búsqueda por sinónimos (ej. "Papá" -> "PADRE").
- Corrección de errores tipográficos ("Parace" -> "Paracetamol").

### 3. 📊 Dashboard de Gestión
Panel de control para consultar el historial de pacientes con filtros avanzados cruzados (Paciente + Diagnóstico + Medicamento).

---

## 🛠️ Arquitectura Técnica

El sistema utiliza una arquitectura **Serverless** moderna y desacoplada:

| Componente | Tecnología | Función |
|------------|------------|---------|
| **Frontend** | HTML5, Bootstrap 5, JS | Interfaz ligera y responsiva. Conexión directa a APIs. |
| **Backend** | Azure Functions (Node.js/TS) | Orquestador de lógica de negocio y proxy seguro. |
| **Búsqueda** | Azure AI Search | Motor de indexación para catálogos médicos (RAG Determinista). |
| **Base de Datos** | Supabase (PostgreSQL) | Almacenamiento de expedientes con seguridad RLS (Row Level Security). |
| **IA / Lógica** | Google Gemini Flash | Motor de razonamiento clínico para validar interacciones. |

---

## 📂 Estructura del Proyecto

```bash
ROMIX-NLM/
├── backend/                  # Azure Functions (Lógica del servidor)
│   ├── src/functions/
│   │   ├── Autocompletar.ts      # Búsqueda en Azure Search
│   │   └── ValidarInteraccion.ts # Consulta a Gemini IA
│   └── local.settings.json       # Variables de entorno (No subido)
│
├── frontend/                 # Interfaz de Usuario
│   ├── index.html            # Dashboard Principal
│   ├── config.js             # Configuración de claves públicas
│   └── src/                  # Assets (Logos, estilos)
│
├── data/                     # Scripts de carga de datos
│   ├── crear_sinonimos.js    # Script para entrenar a Azure Search
│   └── data_unificada.json   # Catálogos médicos procesados
│
└── README.md                 # Documentación
```

# 💻 Instalación y Uso Local

## Prerrequisitos
- Node.js (v18+)
- Cuenta de Azure (Search Service)
- Cuenta de Supabase
- Azure Functions Core Tools

## 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/Sistema-ROMIX.git
cd Sistema-ROMIX
```
## 2. Crear configuraciones del backend
- cd backend
- npm install
- Crea un archivo local.settings.json en la carpeta backend con tus credenciales:

```


{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SEARCH_ENDPOINT": "TU_ENDPOINT_AZURE",
    "SEARCH_API_KEY": "TU_API_KEY_AZURE",
    "SEARCH_INDEX_NAME": "romix-index-v1",
    "GEMINI_API_KEY": "TU_CLAVE_GEMINI"
  }
}
```
## 3. Ejecuta el servidor local:
npm start


## 4. Configurar Frontend
- Ve a la carpeta frontend.
- Renombra config.example.js a config.js.

- Agrega tus claves de Supabase y la URL local de la API (http://localhost:7071/api).

## 5. ¡Listo!
Abre index.html en tu navegador.
