import { app } from '@azure/functions';
import { Autocompletar } from './functions/Autocompletar.js';
import { ValidarInteraccion } from './functions/ValidarInteraccion.js'; 

// 1. Ruta del Buscador
app.http('Autocompletar', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'autocompletar',
    handler: Autocompletar
});

// 2. Ruta del Validador IA 
app.http('ValidarInteraccion', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'ValidarInteraccion', 
    handler: ValidarInteraccion
});