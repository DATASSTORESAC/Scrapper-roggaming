# Scraper Unificado Multi-Proveedor

Scraper robusto con Puppeteer que extrae, normaliza y sincroniza datos de múltiples proveedores con detección de cambios.

## 🚀 Características

- ✅ **Multi-proveedor**: Soporta múltiples fuentes con configuración centralizada
- ✅ **Normalización estricta**: Conversión de precios, stock y datos a formato consistente
- ✅ **Detección de cambios**: Hash-based change detection para evitar procesamiento innecesario
- ✅ **Robustez**: Reintentos con exponential backoff, timeouts, manejo de errores
- ✅ **Observabilidad**: Logs estructurados, artifacts en fallos
- ✅ **CI/CD Ready**: GitHub Actions workflow incluido
- ✅ **Extracción de imágenes**: Opcional por proveedor

## 📋 Requerimientos

- Node.js >= 18.0.0
- NPM >= 9.0.0

## 🔧 Instalación

```bash
npm install
```

## ⚙️ Configuración

### Variables de entorno

Copia `.env.example` a `.env` y configura:

```bash
# Proveedor específico (opcional)
SUPPLIER_CODE=caleta  # o pcmaster

# API Laravel
API_URL=http://localhost:8000/api
API_TOKEN=your-scraper-token-here  # Must match SCRAPER_TOKEN in backend .env

# Puppeteer
HEADLESS=true
TIMEOUT_MS=60000
MAX_RETRIES=3
```

### Agregar nuevo proveedor

Edita `scraper.js` y agrega en `CONFIG.suppliers`:

```javascript
'nuevo_proveedor': {
  id: 3,
  code: 'NUEVO',
  name: 'Nuevo Proveedor',
  url: 'https://example.com/productos',
  location: 'CC EXAMPLE',
  currency: 'PEN',
  extractImages: false,
  marginPercent: 5.5,
  categoryMargins: {
    'Laptops': 9.5,
    // ...
  }
}
```

Luego crea la clase scraper:

```javascript
class NuevoProveedorScraper extends BaseScraper {
  async extractRawProducts() {
    return await this.page.evaluate(() => {
      // Tu lógica de extracción aquí
      return productos;
    });
  }
}
```

Y registra en `ScraperFactory`:

```javascript
case 'nuevo_proveedor':
  return new NuevoProveedorScraper(config, logger);
```

## 🎯 Uso

### Modo local

```bash
# Ejecutar todos los proveedores
npm run scrape

# Ejecutar proveedor específico
npm run scrape:caleta
npm run scrape:pcmaster

# O con variables de entorno
SUPPLIER_CODE=caleta node scraper.js
```

### Modo CI (GitHub Actions)

El workflow se ejecuta:
- **Automáticamente**: Cada 6 horas
- **Manualmente**: Desde GitHub Actions UI
- **En push**: Cuando cambias `scraper.js` o el workflow

#### Configurar secrets en GitHub:

1. Ve a: `Settings` → `Secrets and variables` → `Actions`
2. Agrega:
   - `API_URL`: URL de tu API Laravel
   - `API_TOKEN`: Token de autenticación

## 📤 Formato de salida

El scraper genera un payload normalizado:

```json
{
  "supplier_id": 1,
  "fetched_at": "2024-12-16T10:30:00.000Z",
  "margin_percent": 5.5,
  "source_totals": {
    "total_products": 150,
    "images_extracted": 145
  },
  "items": [
    {
      "supplier_sku": "CALETA-12345",
      "name": "Laptop ASUS ROG Strix G15",
      "brand": "ASUS",
      "category": "Laptops",
      "location": "CC CYBERPLAZA",
      "url": "https://...",
      "image_url": "https://...",
      "stock_qty": 5,
      "stock_text": "+5",
      "is_available": true,
      "currency": "PEN",
      "supplier_price": 3500.0,
      "price_suggested": 3832.5
    }
  ],
  "hash": "a1b2c3d4e5f6..."
}
```

## 🔍 Normalización de datos

### Precios
```javascript
"S/32"      → 32.0
"S/. 1,250" → 1250.0
"$45.99"    → 45.99
"S/0"       → null
```

### Stock
```javascript
"+5"               → { qty: 5, text: "+5", available: true }
"Disponible"       → { qty: 1, text: "Disponible", available: true }
"Sin stock"        → { qty: null, text: "Sin stock", available: null }
"10 unidades"      → { qty: 10, text: "10 unidades", available: true }
```

### SKU estable
- Si el proveedor tiene ID: `CALETA-12345`
- Si no: hash MD5 del nombre: `CALETA-a1b2c3d4`

## 🎛️ API Endpoint

El scraper envía datos a:

```
POST /api/scraper/sync/{supplier_id}
```

**Headers:**
```
X-Scraper-Token: {token}
Content-Type: application/json
```

**Respuestas:**
- `202`: Import ya en proceso (idempotencia)
- `204`: Sin cambios detectados (hash igual)
- `200/201`: Datos procesados exitosamente
- `401/403`: Error de autenticación (no reintenta)
- `404`: Endpoint no encontrado (no reintenta)
- `422`: Error de validación (no reintenta)
- `4xx`: Error del cliente (no reintenta)
- `5xx`: Error del servidor (reintenta con backoff)

## 🛡️ Manejo de errores

### Reintentos automáticos:
- ✅ Timeouts de navegación
- ✅ Errores de red (ECONNREFUSED, ETIMEDOUT)
- ✅ Respuestas 5xx del servidor

### NO reintenta:
- ❌ 401/403 (autenticación/permisos)
- ❌ 404 (ruta no existe)
- ❌ 4xx (errores del cliente)

### Artifacts en fallos:
- Screenshot de la página
- HTML dump
- Logs detallados

## 📊 Logs

Los logs incluyen:

```json
{
  "timestamp": "2024-12-16T10:30:00.000Z",
  "level": "info",
  "supplier": "CALETA",
  "duration_ms": 45230,
  "message": "Scraping completado",
  "total_items": 150,
  "hash": "a1b2c3d4..."
}
```

## 🔒 Seguridad

- ❌ Nunca hardcodear tokens o URLs sensibles
- ✅ Tokens solo por variables de entorno o secrets
- ✅ Logs nunca muestran el token
- ✅ User-agent realista para evitar bloqueos

## ⚡ Performance

- **Timeout por navegación**: 60s (configurable)
- **Delay entre productos**: 500ms
- **Delay entre páginas**: 1000ms
- **Concurrencia**: 1 (configurable)
- **Extracción de imágenes**: Opcional por proveedor

## 📝 Validación de items

Se descartan items que:
- No tienen `supplier_sku`
- Tienen nombre inválido (< 3 caracteres)
- No tienen `price_sale` ni `stock_qty` (opcional)

## 🔄 Detección de duplicados

Si hay items con el mismo `supplier_sku`:
- Se queda con el de mayor stock
- Si ambos sin stock, con el último visto

## 📂 Estructura de archivos

```
.
├── scraper.js              # Scraper unificado
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── .github/
│   └── workflows/
│       └── scrape-suppliers.yml
├── output/                 # Payloads JSON generados
│   ├── caleta-{timestamp}.json
│   └── pcmaster-{timestamp}.json
└── artifacts/              # Screenshots y HTML en fallos
    ├── CALETA-screenshot-{timestamp}.png
    └── CALETA-html-{timestamp}.html
```

## 🐛 Debugging

### Ver HTML de la página
```bash
# Se guarda automáticamente en artifacts/ en caso de error
```

### Ejecutar en modo NO headless
```bash
HEADLESS=false npm run scrape:caleta
```

### Ver logs detallados
```bash
# En modo CI se guardan en output/*.log
```

## 📈 Estadísticas

El scraper reporta:
- Total de productos extraídos
- Imágenes obtenidas exitosamente
- Productos por categoría
- Productos por marca
- Hash del payload
- Duración total

## 🤝 Contribuir

Para agregar un nuevo proveedor:

1. Agregar configuración en `CONFIG.suppliers`
2. Crear clase `{Proveedor}Scraper extends BaseScraper`
3. Implementar `extractRawProducts()`
4. Registrar en `ScraperFactory`
5. Probar localmente
6. Actualizar README

## 📜 Licencia

MIT