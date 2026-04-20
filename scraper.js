import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
dotenv.config();

// Importar configuraciones modulares
import { SUPPLIERS, getSupplierConfig, getAvailableSuppliers } from './config/suppliers.js';
import {
  CATEGORIES,
  CATEGORY_PATTERNS,
  CATEGORY_MARGINS,
  DEFAULT_MARGIN
} from './config/categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Environment
  supplierId: process.env.SUPPLIER_ID || null,
  supplierCode: process.env.SUPPLIER_CODE || null,
  apiUrl: process.env.API_URL || 'http://localhost:8000/api',
  apiToken: process.env.API_TOKEN || null,

  // Puppeteer
  headless: process.env.HEADLESS !== 'false',
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '60000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  concurrency: parseInt(process.env.CONCURRENCY || '1'),

  // Scraping behavior
  delayBetweenProducts: 500,
  delayBetweenPages: 1000,
  imageTimeout: 10000,

  // Output
  outputDir: path.join(__dirname, 'output'),
  artifactsDir: path.join(__dirname, 'artifacts'),

  // Suppliers configuration (desde config/suppliers.js)
  suppliers: SUPPLIERS
};

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

class Logger {
  constructor(supplierCode) {
    this.supplierCode = supplierCode;
    this.startTime = Date.now();
  }

  log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const duration = Date.now() - this.startTime;

    const logEntry = {
      timestamp,
      level,
      supplier: this.supplierCode,
      duration_ms: duration,
      message,
      ...metadata
    };

    const logString = `[${timestamp}] [${level.toUpperCase()}] [${this.supplierCode}] ${message}`;

    if (level === 'error') {
      console.error(logString, metadata);
    } else {
      console.log(logString);
    }

    // En modo CI, también escribir a archivo
    if (process.env.CI) {
      this.writeToFile(logEntry);
    }
  }

  writeToFile(entry) {
    const logFile = path.join(CONFIG.outputDir, `${this.supplierCode}-${this.getDateStr()}.log`);
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
  }

  getDateStr() {
    return new Date().toISOString().split('T')[0];
  }

  info(message, metadata) { this.log('info', message, metadata); }
  warn(message, metadata) { this.log('warn', message, metadata); }
  error(message, metadata) { this.log('error', message, metadata); }
  debug(message, metadata) { this.log('debug', message, metadata); }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

function getPeruDateISO() {
  const date = new Date();
  const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000));
  return peruDate.toISOString().replace('Z', '-05:00');
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZACIÓN DE DATOS
// ═══════════════════════════════════════════════════════════════

class DataNormalizer {
  static normalizePrice(priceText) {
    if (!priceText) return null;

    const s = String(priceText).trim();
    // Quita "S/" y espacios
    const noCurrency = s.replace(/s\/\s*/i, '').trim();
    // Cambia coma por punto para decimales tipo "32,50"
    const normalized = noCurrency.replace(',', '.');
    // Extrae el primer número válido
    const match = normalized.match(/(\d+(\.\d+)?)/);
    if (!match) return null;

    const n = Number(match[1]);
    if (!Number.isFinite(n) || n === 0) return null;
    return n;
  }

  static normalizeStock(stockText) {
    if (!stockText) {
      return { qty: null, text: null, available: null };
    }

    const text = String(stockText).trim();
    const lowerText = text.toLowerCase();

    // Disponibilidad
    const available =
      /disponible|en stock|stock|disponibilidad inmediata/i.test(text) ||
      /^\+?\d+$/.test(text);

    // Cantidad numérica
    let qty = null;
    const qtyMatch = text.match(/\+?(\d+)/);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1]);
    } else if (/disponible/i.test(text)) {
      qty = 1; // Asumir al menos 1 si dice "disponible"
    }

    return {
      qty,
      text,
      available: available ? true : null
    };
  }

  static normalizeString(str) {
    if (!str) return null;

    return String(str)
      .replace(/[\t\n\r]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim() || null;
  }

  static extractBrand(name) {
    if (!name) return null;

    const nameLower = name.toLowerCase();

    const brands = [
      { pattern: /\bhavit\b/, name: 'Havit' },
      { pattern: /\benkore\b/, name: 'Enkore' },
      { pattern: /\bhyperx\b/, name: 'HyperX' },
      { pattern: /\blogitech\b/, name: 'Logitech' },
      { pattern: /\brazer\b/, name: 'Razer' },
      { pattern: /\bredragon\b/, name: 'Redragon' },
      { pattern: /\bcorsair\b/, name: 'Corsair' },
      { pattern: /\bsteelseries\b/, name: 'SteelSeries' },
      { pattern: /\bnvidia\b/, name: 'NVIDIA' },
      { pattern: /\bamd\b/, name: 'AMD' },
      { pattern: /\bintel\b/, name: 'Intel' },
      { pattern: /\basus\b/, name: 'ASUS' },
      { pattern: /\bgigabyte\b/, name: 'Gigabyte' },
      { pattern: /\bmsi\b/, name: 'MSI' },
      { pattern: /\basrock\b/, name: 'ASRock' },
      { pattern: /\bkingston\b/, name: 'Kingston' },
      { pattern: /\bseagate\b/, name: 'Seagate' },
      { pattern: /\bwestern digital\b|\bwd\b/, name: 'Western Digital' },
      { pattern: /\bsamsung\b/, name: 'Samsung' },
      { pattern: /\blg\b/, name: 'LG' },
      { pattern: /\bacer\b/, name: 'Acer' },
      { pattern: /\bhp\b/, name: 'HP' },
      { pattern: /\bdell\b/, name: 'Dell' },
      { pattern: /\blenovo\b/, name: 'Lenovo' },
      { pattern: /\btp-link\b|\btplink\b/, name: 'TP-Link' },
      { pattern: /\bthermaltake\b/, name: 'Thermaltake' },
      { pattern: /\bcooler master\b/, name: 'Cooler Master' },
      { pattern: /\bnzxt\b/, name: 'NZXT' },
      { pattern: /\bevga\b/, name: 'EVGA' },
      { pattern: /\bcrucial\b/, name: 'Crucial' },
      { pattern: /\bmicronics\b/, name: 'Micronics' },
      { pattern: /\bxpg\b/, name: 'XPG' },
      { pattern: /\badata\b/, name: 'ADATA' }
    ];

    for (const brand of brands) {
      if (brand.pattern.test(nameLower)) {
        return brand.name;
      }
    }

    return null;
  }

  static detectCategory(name) {
    if (!name) return CATEGORIES.OTROS;

    const nameLower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Iterar sobre los patrones en orden de prioridad
    for (const patternConfig of CATEGORY_PATTERNS) {
      // Verificar patrones de exclusión primero
      if (patternConfig.exclude) {
        const isExcluded = patternConfig.exclude.some(excludePattern =>
          excludePattern.test(nameLower)
        );
        if (isExcluded) continue;
      }

      // Verificar patrones regulares
      const matchesPattern = patternConfig.patterns.some(pattern =>
        pattern.test(nameLower)
      );

      if (matchesPattern) {
        return patternConfig.category;
      }

      // Verificar detección avanzada si existe
      if (patternConfig.advancedDetection) {
        if (patternConfig.advancedDetection(name)) {
          return patternConfig.category;
        }
      }
    }

    return CATEGORIES.OTROS;
  }

  static calculateSalePrice(originalPrice, category) {
    if (!originalPrice) return null;

    // Usar márgenes desde configuración modular
    const marginPercent = CATEGORY_MARGINS[category] || DEFAULT_MARGIN;
    const multiplier = 1 + (marginPercent / 100);

    return Math.round(originalPrice * multiplier);
  }
}

// ═══════════════════════════════════════════════════════════════
// HASH Y DETECCIÓN DE CAMBIOS
// ═══════════════════════════════════════════════════════════════

class ChangeDetector {
  static calculateItemHash(item) {
    const data = {
      sku: item.supplier_sku,
      price: item.supplier_price,
      stock: item.stock_qty,
      image: item.image_url
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
  }

  static calculatePayloadHash(items) {
    const hashes = items
      .map(item => this.calculateItemHash(item))
      .sort()
      .join('|');

    return crypto
      .createHash('sha256')
      .update(hashes)
      .digest('hex');
  }
}

// ═══════════════════════════════════════════════════════════════
// SCRAPER BASE
// ═══════════════════════════════════════════════════════════════

class BaseScraper {
  constructor(supplierConfig, logger) {
    this.config = supplierConfig;
    this.logger = logger;
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.logger.info('Iniciando browser...');

    this.browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async navigateWithRetry(url, retries = CONFIG.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        this.logger.info(`Navegando a ${url} (intento ${i + 1}/${retries})`);

        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.timeoutMs
        });

        return true;
      } catch (error) {
        this.logger.warn(`Error navegando (intento ${i + 1}): ${error.message}`);

        if (i < retries - 1) {
          await sleep(Math.pow(2, i) * 1000); // Exponential backoff
        } else {
          throw error;
        }
      }
    }
  }

  async saveArtifact(type, content) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `${this.config.code}-${type}-${timestamp}`;
    const filepath = path.join(CONFIG.artifactsDir, filename);

    fs.mkdirSync(CONFIG.artifactsDir, { recursive: true });

    if (type === 'screenshot') {
      await this.page.screenshot({ path: `${filepath}.png`, fullPage: true });
    } else if (type === 'html') {
      const html = await this.page.content();
      fs.writeFileSync(`${filepath}.html`, html, 'utf-8');
    }

    this.logger.info(`Artifact guardado: ${filename}`);
  }

  async extractRawProducts() {
    throw new Error('extractRawProducts() debe ser implementado por la clase hija');
  }

  async extractProductImage(url, productId, retries = CONFIG.maxRetries) {
    if (!this.config.extractImages) {
      return null;
    }

    for (let i = 0; i < retries; i++) {
      try {
        this.logger.debug(`Extrayendo imagen para ${productId} (intento ${i + 1})`);

        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.imageTimeout
        });

        await this.page.waitForSelector('.image img, img[class*="product"]', {
          timeout: 5000
        });

        const imageUrl = await this.page.evaluate(() => {
          const img = document.querySelector('.image img, img[class*="product"]');
          return img ? img.src : null;
        });

        if (imageUrl) {
          return imageUrl;
        }

      } catch (error) {
        this.logger.warn(`Error extrayendo imagen (intento ${i + 1}): ${error.message}`);

        if (i < retries - 1) {
          await sleep(1000);
        }
      }
    }

    return null;
  }

  normalizeItem(rawItem) {
    const stock = DataNormalizer.normalizeStock(rawItem.stock);
    const priceOriginal = DataNormalizer.normalizePrice(rawItem.precioOriginal);

    const supplierCategory = DataNormalizer.normalizeString(rawItem.categoria); // del proveedor
    const categorySuggested = DataNormalizer.detectCategory(rawItem.nombre);    // clasificación sugerida

    const priceSuggested = DataNormalizer.calculateSalePrice(priceOriginal, categorySuggested);

    return {
      supplier_sku: this.generateStableSku(rawItem),
      name: DataNormalizer.normalizeString(rawItem.nombre),
      brand: DataNormalizer.extractBrand(rawItem.nombre),

      supplier_category: supplierCategory,
      category_suggested: categorySuggested,

      location: this.config.location,
      url: DataNormalizer.normalizeString(rawItem.enlace),
      image_url: this.config.extractImages ? (rawItem.imagen || null) : null,
      stock_qty: stock.qty,
      stock_text: stock.text,
      is_available: stock.available,
      currency: this.config.currency,
      supplier_price: priceOriginal,
      price_suggested: priceSuggested
    };
  }

  slugFromUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('product');
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      return parts[parts.length - 1] ?? null;
    } catch {
      return null;
    }
  }

  generateStableSku(rawItem) {
    // 1) Si hay id del proveedor estable (Caleta: 7920 / PCMaster: slug)
    if (rawItem.id && String(rawItem.id).trim() !== '') {
      return `${this.config.code}-${String(rawItem.id).trim()}`;
    }

    // 2) Si hay enlace, usar slug o hash(url) - ESTABLE
    if (rawItem.enlace) {
      const slug = this.slugFromUrl(rawItem.enlace);
      if (slug) return `${this.config.code}-${slug}`;

      const urlHash = crypto
        .createHash('sha1')
        .update(String(rawItem.enlace))
        .digest('hex')
        .substring(0, 16);

      return `${this.config.code}-${urlHash}`;
    }

    // 3) Último recurso (no ideal): hash del nombre
    const nameHash = crypto
      .createHash('sha1')
      .update(String(rawItem.nombre || ''))
      .digest('hex')
      .substring(0, 16);

    return `${this.config.code}-${nameHash}`;
  }

  validateItem(item) {
    // Filtros obligatorios
    if (!item.supplier_sku) {
      return { valid: false, reason: 'missing_sku' };
    }

    if (!item.name || item.name.length < 3) {
      return { valid: false, reason: 'invalid_name' };
    }

    // Filtros opcionales (pueden ser configurables)
    if (!item.price_sale && !item.stock_qty) {
      return { valid: false, reason: 'no_price_no_stock' };
    }

    return { valid: true };
  }

  removeDuplicates(items) {
    const seen = new Map();

    for (const item of items) {
      const existing = seen.get(item.supplier_sku);

      if (!existing) {
        seen.set(item.supplier_sku, item);
      } else {
        // Quedarnos con el de mayor stock, o el último si ambos sin stock
        if ((item.stock_qty || 0) > (existing.stock_qty || 0)) {
          seen.set(item.supplier_sku, item);
        }
      }
    }

    return Array.from(seen.values());
  }

  async scrape() {
    const startTime = Date.now();

    try {
      await this.init();
      await this.navigateWithRetry(this.config.url);

      // Extraer datos crudos
      this.logger.info('Extrayendo productos...');
      const rawProducts = await this.extractRawProducts();
      this.logger.info(`Productos crudos extraídos: ${rawProducts.length}`);

      // Extraer imágenes si está habilitado y no fueron extraídas ya
      if (this.config.extractImages && rawProducts.length > 0) {
        // Contar cuántas imágenes ya fueron extraídas
        const alreadyExtracted = rawProducts.filter(p => p.imagen).length;

        if (alreadyExtracted > 0) {
          this.logger.info(`Imágenes ya extraídas de la tabla: ${alreadyExtracted}/${rawProducts.length}`);
        }

        // Solo navegar a páginas de producto para los que NO tienen imagen
        const productsNeedingImages = rawProducts.filter(p => !p.imagen && p.enlace);

        if (productsNeedingImages.length > 0) {
          this.logger.info(`Extrayendo imágenes de páginas de producto: ${productsNeedingImages.length} productos...`);

          for (let i = 0; i < productsNeedingImages.length; i++) {
            const product = productsNeedingImages[i];

            product.imagen = await this.extractProductImage(
              product.enlace,
              product.id || i
            );

            // Delay entre productos
            if (i < productsNeedingImages.length - 1) {
              await sleep(CONFIG.delayBetweenProducts);
            }
          }
        }

        const totalImagesExtracted = rawProducts.filter(p => p.imagen).length;
        this.logger.info(`Total imágenes extraídas: ${totalImagesExtracted}/${rawProducts.length}`);
      }


      // Normalizar items
      this.logger.info('Normalizando datos...');
      let items = rawProducts.map(raw => this.normalizeItem(raw));

      // Validar y filtrar
      const beforeValidation = items.length;
      items = items.filter(item => {
        const validation = this.validateItem(item);
        if (!validation.valid) {
          this.logger.debug(`Item descartado: ${validation.reason}`, {
            sku: item.supplier_sku,
            name: item.name
          });
        }
        return validation.valid;
      });
      this.logger.info(`Items válidos: ${items.length}/${beforeValidation}`);

      // Remover duplicados
      const beforeDedup = items.length;
      items = this.removeDuplicates(items);
      if (beforeDedup !== items.length) {
        this.logger.info(`Duplicados removidos: ${beforeDedup - items.length}`);
      }

      // Calcular hash
      const payloadHash = ChangeDetector.calculatePayloadHash(items);

      // Preparar payload
      const payload = {
        supplier_id: this.config.id,
        fetched_at: getPeruDateISO(),
        margin_percent: this.config.marginPercent,
        source_totals: {
          total_products: items.length,
          images_extracted: items.filter(i => i.image_url).length
        },
        items: items,
        hash: payloadHash
      };

      const duration = Date.now() - startTime;
      this.logger.info(`Scraping completado en ${(duration / 1000).toFixed(2)}s`, {
        total_items: items.length,
        hash: payloadHash
      });

      return payload;

    } catch (error) {
      this.logger.error('Error en scraping', {
        error: error.message,
        stack: error.stack
      });

      // Guardar artifacts para debugging
      try {
        await this.saveArtifact('screenshot');
        await this.saveArtifact('html');
      } catch (artifactError) {
        this.logger.warn('No se pudieron guardar artifacts');
      }

      throw error;

    } finally {
      await this.close();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SCRAPERS ESPECÍFICOS
// ═══════════════════════════════════════════════════════════════

class CaletaScraper extends BaseScraper {
  async extractRawProducts() {
    return await this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const data = [];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td.nthss');

        if (cells.length >= 4) {
          const linkElement = cells[1]?.querySelector('a');
          const nombre = linkElement?.textContent?.trim();
          const enlace = linkElement?.href || '';

          const stockText = cells[2]?.querySelector('p')?.textContent?.trim() || '';
          const precioText = cells[3]?.textContent?.trim() || '';

          const idInput = row.querySelector('input[name="id"]');
          const id = idInput?.value || '';

          // Construir URL de imagen directamente desde el ID
          // Patrón: https://www.caleta.pe/fotos/{ID}.png
          const imagen = id ? `https://www.caleta.pe/fotos/${id}.png` : null;

          if (nombre && precioText && enlace) {
            data.push({
              id,
              nombre,
              stock: stockText,
              precioOriginal: precioText,
              enlace,
              imagen
            });
          }
        }
      });

      return data;
    });
  }
}

class PCMasterScraper extends BaseScraper {
  async extractRawProducts() {
    return await this.page.evaluate(() => {
      const productos = [];

      const slugFromUrl = (url) => {
        if (!url) return null;
        try {
          const u = new URL(url);
          const parts = u.pathname.split('/').filter(Boolean);
          const idx = parts.indexOf('product');
          if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
          return parts[parts.length - 1] ?? null;
        } catch {
          return null;
        }
      };

      // Solo filas reales del listado (tr.pcms-row)
      const rows = Array.from(document.querySelectorAll('tr.pcms-row'));

      rows.forEach((row) => {
        try {
          const linkEl = row.querySelector('a.pcms-name') || row.querySelector('a[href*="/product/"]');
          const enlace = linkEl?.href || row.querySelector('td.pcms-img a')?.href || '';

          const nombre =
            row.querySelector('.pcms-name-wrap')?.textContent?.trim() ||
            linkEl?.textContent?.trim() ||
            row.getAttribute('data-name')?.trim() ||
            '';

          // stock / precio (los dos son td.pcms-center, stock es el primero, precio el segundo)
          const centers = Array.from(row.querySelectorAll('td.pcms-center'));
          const stockText = centers[0]?.textContent?.trim() || '';
          const precioText = centers[1]?.textContent?.trim() || '';

          const imgEl = row.querySelector('td.pcms-img img');
          const imagen = imgEl?.getAttribute('src') || imgEl?.src || null;

          // Categoría del proveedor: data-cats trae varios slugs. Tomamos el primero como principal.
          const cats = (row.getAttribute('data-cats') || '').trim();
          const categoria = cats ? cats.split(/\s+/)[0] : null;

          // ID estable: slug del URL (si no hay, se resolverá luego por hash(url) en Node)
          const id = slugFromUrl(enlace);

          if (enlace && nombre && nombre.length > 3) {
            productos.push({
              id: id || '',
              nombre,
              stock: stockText,
              precioOriginal: precioText,
              enlace,
              imagen,
              categoria
            });
          }
        } catch (e) {
          // silencioso para no romper toda la extracción
        }
      });

      return productos;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════

class ApiClient {
  constructor(logger) {
    this.logger = logger;
    this.baseUrl = CONFIG.apiUrl;
    this.token = CONFIG.apiToken;
  }

  async sendPayload(payload, retries = CONFIG.maxRetries) {
    if (!this.token) {
      throw new Error('API_TOKEN no configurado');
    }

    const endpoint = `${this.baseUrl}/scraper/sync/${payload.supplier_id}`;

    for (let i = 0; i < retries; i++) {
      try {
        this.logger.info(`Enviando payload a API (intento ${i + 1}/${retries})`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-Scraper-Token': this.token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // 202 = Import ya en proceso (async)
        if (response.status === 202) {
          const data = await response.json();
          this.logger.info('Import ya en proceso (202 - async)', { data });
          return {
            success: true,
            changed: false,
            status: 202,
            message: 'Import already in progress',
            data
          };
        }

        // 204 = Sin cambios
        if (response.status === 204) {
          this.logger.info('Sin cambios detectados (204)');
          return {
            success: true,
            changed: false,
            status: 204
          };
        }

        // 200/201 = Procesado exitosamente
        if (response.status === 200 || response.status === 201) {
          const data = await response.json();
          this.logger.info(`Datos procesados exitosamente (${response.status})`, {
            stats: data.stats || data
          });
          return {
            success: true,
            changed: true,
            status: response.status,
            data
          };
        }

        // 401/403 = No reintentar (auth/permisos)
        if (response.status === 401 || response.status === 403) {
          let errorMsg;
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || JSON.stringify(errorData);
          } catch {
            errorMsg = await response.text();
          }
          this.logger.error(`Auth error (${response.status})`, { error: errorMsg });
          throw new Error(`Auth error (${response.status}): ${errorMsg}`);
        }

        // 404 = No reintentar (ruta incorrecta)
        if (response.status === 404) {
          this.logger.error('Endpoint no encontrado (404)', { endpoint });
          throw new Error('Endpoint no encontrado (404)');
        }

        // 422 = Validation error
        if (response.status === 422) {
          let errorMsg;
          try {
            const errorData = await response.json();
            errorMsg = JSON.stringify(errorData.errors || errorData, null, 2);
          } catch {
            errorMsg = await response.text();
          }
          this.logger.error('Validation error (422)', { errors: errorMsg });
          throw new Error(`Validation error (422): ${errorMsg}`);
        }

        // 4xx = Error del cliente, no reintentar
        if (response.status >= 400 && response.status < 500) {
          let errorMsg;
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || JSON.stringify(errorData);
          } catch {
            errorMsg = await response.text();
          }
          this.logger.error(`Client error (${response.status})`, { error: errorMsg });
          throw new Error(`Client error (${response.status}): ${errorMsg}`);
        }

        // 5xx = Error del servidor, reintentar
        if (response.status >= 500) {
          const error = await response.text();
          this.logger.warn(`Server error (${response.status}): ${error}`);

          if (i < retries - 1) {
            const backoffMs = Math.pow(2, i) * 1000;
            this.logger.info(`Reintentando en ${backoffMs}ms...`);
            await sleep(backoffMs);
            continue;
          }

          throw new Error(`Server error after ${retries} attempts: ${error}`);
        }

        // Status desconocido
        throw new Error(`Unexpected status code: ${response.status}`);

      } catch (error) {
        // Si es error de red y quedan reintentos
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          if (i < retries - 1) {
            const backoffMs = Math.pow(2, i) * 1000;
            this.logger.warn(`Network error: ${error.message}. Reintentando en ${backoffMs}ms...`);
            await sleep(backoffMs);
            continue;
          }
        }

        // Si es un error que no debemos reintentar, lanzarlo inmediatamente
        if (error.message.includes('Auth error') ||
          error.message.includes('404') ||
          error.message.includes('Client error')) {
          throw error;
        }

        // Último reintento fallido
        if (i === retries - 1) {
          throw error;
        }

        this.logger.warn(`Error en intento ${i + 1}: ${error.message}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SCRAPER FACTORY
// ═══════════════════════════════════════════════════════════════

class ScraperFactory {
  static create(supplierCode) {
    const config = CONFIG.suppliers[supplierCode.toLowerCase()];

    if (!config) {
      throw new Error(`Supplier no soportado: ${supplierCode}`);
    }

    const logger = new Logger(config.code);

    switch (supplierCode.toLowerCase()) {
      case 'caleta':
        return new CaletaScraper(config, logger);
      case 'pcmaster':
        return new PCMasterScraper(config, logger);
      default:
        throw new Error(`No hay scraper implementado para: ${supplierCode}`);
    }
  }

  static getAvailableSuppliers() {
    return Object.keys(CONFIG.suppliers);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  // Crear directorios de salida
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  fs.mkdirSync(CONFIG.artifactsDir, { recursive: true });

  // Determinar qué supplier(s) ejecutar
  let suppliersToRun = [];

  if (CONFIG.supplierCode) {
    suppliersToRun = [CONFIG.supplierCode.toLowerCase()];
  } else if (CONFIG.supplierId) {
    // Buscar por ID
    const supplier = Object.values(CONFIG.suppliers).find(
      s => s.id === parseInt(CONFIG.supplierId)
    );
    if (supplier) {
      suppliersToRun = [supplier.code.toLowerCase()];
    } else {
      console.error(`Supplier ID ${CONFIG.supplierId} no encontrado`);
      process.exit(1);
    }
  } else {
    // Ejecutar todos
    suppliersToRun = ScraperFactory.getAvailableSuppliers();
    console.log(`No se especificó supplier, ejecutando todos: ${suppliersToRun.join(', ')}`);
  }

  const results = [];

  for (const supplierCode of suppliersToRun) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`Ejecutando scraper: ${supplierCode.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
      const scraper = ScraperFactory.create(supplierCode);
      const payload = await scraper.scrape();

      // Estrategia de guardado inteligente
      let payloadFile;

      if (CONFIG.apiToken && CONFIG.apiUrl) {
        // Producción: sobrescribir archivo "latest" (no acumula espacio)
        payloadFile = path.join(CONFIG.outputDir, `${supplierCode}-latest.json`);
        fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2), 'utf-8');
        scraper.logger.info(`Payload guardado (latest): ${path.basename(payloadFile)}`);
      } else {
        // Desarrollo: guardar con timestamp para comparación
        payloadFile = path.join(CONFIG.outputDir, `${supplierCode}-${Date.now()}.json`);
        fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2), 'utf-8');
        scraper.logger.info(`Payload guardado (dev): ${path.basename(payloadFile)}`);
      }

      // Enviar a API si está configurada
      if (CONFIG.apiToken && CONFIG.apiUrl) {
        const apiClient = new ApiClient(scraper.logger);
        const apiResult = await apiClient.sendPayload(payload);

        results.push({
          supplier: supplierCode,
          success: true,
          items: payload.items.length,
          hash: payload.hash,
          changed: apiResult.changed,
          api_status: apiResult.status
        });
      } else {
        scraper.logger.warn('API no configurada, solo se guardó localmente');
        results.push({
          supplier: supplierCode,
          success: true,
          items: payload.items.length,
          hash: payload.hash,
          api_sent: false
        });
      }

    } catch (error) {
      console.error(`\n❌ Error en ${supplierCode}:`, error.message);

      results.push({
        supplier: supplierCode,
        success: false,
        error: error.message
      });

      // Si es modo CI, continuar con el siguiente supplier
      if (!process.env.CI) {
        process.exit(1);
      }
    }

    // Delay entre suppliers si hay más de uno
    if (suppliersToRun.length > 1 &&
      suppliersToRun.indexOf(supplierCode) < suppliersToRun.length - 1) {
      await sleep(CONFIG.delayBetweenPages);
    }
  }

  // Resumen final
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESUMEN FINAL');
  console.log('═══════════════════════════════════════════════════════════════\n');

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.supplier.toUpperCase()}`);

    if (result.success) {
      console.log(`   Items: ${result.items}`);
      console.log(`   Hash: ${result.hash}`);
      if (result.api_sent !== false) {
        console.log(`   Cambios: ${result.changed ? 'SÍ' : 'NO'}`);
        console.log(`   API Status: ${result.api_status}`);
      }
    } else {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Exit code según resultados
  // Exit code según resultados
  const allSuccess = results.every(r => r.success);
  if (!allSuccess) {
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// EJECUCIÓN
// ═══════════════════════════════════════════════════════════════

// Ejecutar main() si este archivo se ejecuta directamente
// Normalizar rutas para Windows
const currentFile = import.meta.url;
const executedFile = `file:///${process.argv[1].replace(/\\/g, '/')}`;
const isMainModule = currentFile === executedFile ||
  currentFile.endsWith('/scraper.js') ||
  process.argv[1].endsWith('scraper.js');

if (isMainModule) {
  main().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
}

export {
  ScraperFactory,
  DataNormalizer,
  ChangeDetector,
  ApiClient,
  CONFIG
};