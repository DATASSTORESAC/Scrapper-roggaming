#!/usr/bin/env node

/**
 * Script para verificar la conexión con el backend antes de ejecutar el scraper
 */

import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:8000/api';
const API_TOKEN = process.env.API_TOKEN;

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 VERIFICACIÓN DE CONEXIÓN CON BACKEND');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Verificar configuración
console.log('📋 Configuración:');
console.log(`   API_URL: ${API_URL}`);
console.log(`   API_TOKEN: ${API_TOKEN ? `${API_TOKEN.substring(0, 20)}...` : '❌ NO CONFIGURADO'}\n`);

if (!API_TOKEN) {
    console.error('❌ ERROR: API_TOKEN no está configurado en .env');
    process.exit(1);
}

// 2. Test de conectividad básica
console.log('🌐 Test 1: Conectividad básica...');
try {
    const healthUrl = API_URL.replace('/api', '') + '/api/health';
    console.log(`   Probando: ${healthUrl}`);

    const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    console.log(`   ✅ Backend responde: ${healthResponse.status} ${healthResponse.statusText}\n`);
} catch (error) {
    console.error(`   ❌ Error de conexión: ${error.message}`);
    console.error(`   → Verifica que el backend esté corriendo en ${API_URL}\n`);
    process.exit(1);
}

// 3. Test de autenticación
console.log('🔐 Test 2: Autenticación del token...');
const testEndpoint = `${API_URL}/scraper/sync/3`; // Caleta

try {
    const response = await fetch(testEndpoint, {
        method: 'POST',
        headers: {
            'X-Scraper-Token': API_TOKEN,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            supplier_id: 3,
            fetched_at: new Date().toISOString(),
            hash: 'test-hash-1234567890123456789012345678901234567890123456789012',
            items: [],
            source_totals: { total_products: 0, images_extracted: 0 },
            margin_percent: 0
        })
    });

    console.log(`   Endpoint: ${testEndpoint}`);
    console.log(`   Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    let responseData;

    try {
        responseData = JSON.parse(responseText);
    } catch {
        responseData = responseText;
    }

    if (response.status === 403) {
        console.error('   ❌ Token INVÁLIDO o NO COINCIDE con el backend');
        console.error('   → Verifica que SCRAPER_TOKEN en backend .env sea igual a API_TOKEN en scraper .env');
        console.error(`   → Respuesta: ${JSON.stringify(responseData, null, 2)}\n`);
        process.exit(1);
    } else if (response.status === 404) {
        console.error('   ❌ Endpoint NO ENCONTRADO');
        console.error('   → Verifica que el backend tenga la ruta: POST /api/scraper/sync/{id}');
        console.error('   → Ejecuta: php artisan route:list | grep scraper\n');
        process.exit(1);
    } else if (response.status === 422) {
        console.log('   ✅ Token VÁLIDO (validación de payload falló, pero autenticación OK)');
        console.log(`   → Respuesta: ${JSON.stringify(responseData, null, 2)}\n`);
    } else if (response.status === 200 || response.status === 201 || response.status === 204) {
        console.log('   ✅ Token VÁLIDO y endpoint funcionando correctamente');
        console.log(`   → Respuesta: ${JSON.stringify(responseData, null, 2)}\n`);
    } else {
        console.warn(`   ⚠️ Respuesta inesperada: ${response.status}`);
        console.warn(`   → Respuesta: ${JSON.stringify(responseData, null, 2)}\n`);
    }
} catch (error) {
    console.error(`   ❌ Error en la petición: ${error.message}\n`);
    process.exit(1);
}

// 4. Verificar proveedores
console.log('👥 Test 3: Verificar proveedores en backend...');
console.log('   → Ejecuta en el backend:');
console.log('   php artisan tinker');
console.log('   DB::table(\'entities\')->where(\'entity_type\', \'supplier\')->get([\'id\', \'name\']);');
console.log('');
console.log('   Proveedores esperados:');
console.log('   - ID: 2 → PCMaster');
console.log('   - ID: 3 → Caleta\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ VERIFICACIÓN COMPLETADA');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Si todos los tests pasaron, puedes ejecutar:');
console.log('  npm run scrape');
console.log('');
