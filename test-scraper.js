#!/usr/bin/env node

/**
 * Script de prueba para validar el scraper sin enviar a API
 * 
 * Uso:
 *   node test-scraper.js caleta
 *   node test-scraper.js pcmaster
 */

import { ScraperFactory, DataNormalizer, ChangeDetector } from './scraper.js';
import fs from 'fs';

const supplierCode = process.argv[2] || 'caleta';

console.log('═══════════════════════════════════════════════════════════════');
console.log(`🧪 TEST MODE - Scraper: ${supplierCode.toUpperCase()}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Crear scraper
const scraper = ScraperFactory.create(supplierCode);

// Configurar para no enviar a API
process.env.API_TOKEN = null;

// Ejecutar
scraper.scrape()
  .then(payload => {
    console.log('\n✅ SCRAPING EXITOSO\n');
    
    console.log('📊 Estadísticas:');
    console.log(`   Total items: ${payload.items.length}`);
    console.log(`   Con imágenes: ${payload.source_totals.images_extracted}`);
    console.log(`   Hash: ${payload.hash}\n`);
    
    console.log('📦 Primeros 5 productos:');
    payload.items.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.name}`);
      console.log(`   SKU: ${item.supplier_sku}`);
      console.log(`   Marca: ${item.brand || 'N/A'}`);
      console.log(`   Categoría: ${item.category}`);
      console.log(`   Stock: ${item.stock_qty || 'N/A'} | Disponible: ${item.is_available ? 'Sí' : 'No'}`);
      console.log(`   Precio: ${item.currency} ${item.price_sale} (original: ${item.price_original})`);
      console.log(`   Imagen: ${item.image_url ? '✅' : '❌'}`);
    });
    
    console.log('\n📁 Categorías encontradas:');
    const categories = payload.items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count} productos`);
      });
    
    console.log('\n🏷️  Top 10 marcas:');
    const brands = payload.items
      .filter(item => item.brand)
      .reduce((acc, item) => {
        acc[item.brand] = (acc[item.brand] || 0) + 1;
        return acc;
      }, {});
    Object.entries(brands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([brand, count]) => {
        console.log(`   ${brand}: ${count} productos`);
      });
    
    console.log('\n💰 Rango de precios:');
    const prices = payload.items
      .filter(item => item.price_sale)
      .map(item => item.price_sale);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      console.log(`   Mínimo: S/ ${min.toFixed(2)}`);
      console.log(`   Máximo: S/ ${max.toFixed(2)}`);
      console.log(`   Promedio: S/ ${avg.toFixed(2)}`);
    }
    
    console.log('\n✅ Items válidos:');
    const validItems = payload.items.filter(item => 
      item.supplier_sku && 
      item.name && 
      (item.price_sale || item.stock_qty)
    );
    console.log(`   ${validItems.length}/${payload.items.length} (${((validItems.length/payload.items.length)*100).toFixed(1)}%)`);
    
    console.log('\n🖼️  Items con imagen:');
    const withImages = payload.items.filter(item => item.image_url && !item.image_url.includes('placeholder'));
    console.log(`   ${withImages.length}/${payload.items.length} (${((withImages.length/payload.items.length)*100).toFixed(1)}%)`);
    
    // Guardar payload
    const filename = `test-${supplierCode}-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(payload, null, 2));
    console.log(`\n💾 Payload guardado en: ${filename}`);
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✨ TEST COMPLETADO');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });