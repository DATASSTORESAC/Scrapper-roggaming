#!/usr/bin/env node

/**
 * Script para ejecutar todos los proveedores y mostrar resumen
 * 
 * Uso:
 *   node run-all-scrapers.js
 */

import { ScraperFactory } from './scraper.js';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'output');

// Asegurar que existe el directorio de salida
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Configurar para no enviar a API
process.env.API_TOKEN = null;

const suppliers = ['caleta', 'pcmaster'];
const results = [];

console.log('═══════════════════════════════════════════════════════════════');
console.log('🚀 EJECUTANDO TODOS LOS SCRAPERS');
console.log('═══════════════════════════════════════════════════════════════\n');

async function runAllScrapers() {
    for (const supplierCode of suppliers) {
        console.log(`\n📦 Procesando: ${supplierCode.toUpperCase()}`);
        console.log('─'.repeat(60));

        const startTime = Date.now();

        try {
            const scraper = ScraperFactory.create(supplierCode);
            const payload = await scraper.scrape();

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            // Guardar resultado
            const filename = `${supplierCode}-${Date.now()}.json`;
            const filepath = path.join(OUTPUT_DIR, filename);
            fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));

            // Estadísticas
            const stats = {
                supplier: supplierCode.toUpperCase(),
                success: true,
                products: payload.items.length,
                withImages: payload.items.filter(i => i.image_url).length,
                withCategory: payload.items.filter(i => i.supplier_category).length,
                duration: `${duration}s`,
                file: filename,
                hash: payload.hash
            };

            results.push(stats);

            console.log(`✅ Completado en ${duration}s`);
            console.log(`   Productos: ${stats.products}`);
            console.log(`   Con imágenes: ${stats.withImages} (${((stats.withImages / stats.products) * 100).toFixed(1)}%)`);
            console.log(`   Con categoría: ${stats.withCategory} (${((stats.withCategory / stats.products) * 100).toFixed(1)}%)`);
            console.log(`   Hash: ${payload.hash.substring(0, 12)}...`);
            console.log(`   Archivo: ${filename}`);

        } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.error(`❌ Error: ${error.message}`);

            // Mostrar detalles adicionales si es error de validación
            if (error.message.includes('422') || error.message.includes('Validation')) {
                console.error(`   Tipo: Error de validación`);
            } else if (error.message.includes('401') || error.message.includes('403')) {
                console.error(`   Tipo: Error de autenticación`);
            }

            results.push({
                supplier: supplierCode.toUpperCase(),
                success: false,
                error: error.message,
                duration: `${duration}s`
            });
        }
    }

    // Resumen final
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN FINAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const totalProducts = results.reduce((sum, r) => sum + (r.products || 0), 0);
    const totalImages = results.reduce((sum, r) => sum + (r.withImages || 0), 0);
    const totalWithCategory = results.reduce((sum, r) => sum + (r.withCategory || 0), 0);
    const successCount = results.filter(r => r.success).length;

    results.forEach(result => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${result.supplier}`);

        if (result.success) {
            console.log(`   Productos: ${result.products}`);
            console.log(`   Imágenes: ${result.withImages}`);
            console.log(`   Categorías: ${result.withCategory}`);
            console.log(`   Tiempo: ${result.duration}`);
        } else {
            console.log(`   Error: ${result.error}`);
            console.log(`   Tiempo: ${result.duration}`);
        }
        console.log('');
    });

    console.log('─'.repeat(60));
    console.log(`Total proveedores: ${suppliers.length}`);
    console.log(`Exitosos: ${successCount}/${suppliers.length}`);
    console.log(`Total productos: ${totalProducts}`);
    console.log(`Total imágenes: ${totalImages} (${totalProducts > 0 ? ((totalImages / totalProducts) * 100).toFixed(1) : 0}%)`);
    console.log(`Total con categoría: ${totalWithCategory} (${totalProducts > 0 ? ((totalWithCategory / totalProducts) * 100).toFixed(1) : 0}%)`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(successCount === suppliers.length ? 0 : 1);
}

runAllScrapers().catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
});
