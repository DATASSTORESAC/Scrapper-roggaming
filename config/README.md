# Configuración del Scraper

Este directorio contiene toda la configuración modular del scraper.

## Archivos de Configuración

### `categories.js`
Define las categorías de productos, patrones de detección y márgenes de ganancia.

**Características**:
- ✅ Categorías centralizadas
- ✅ Patrones de detección con prioridad
- ✅ Detección avanzada para PCs completas
- ✅ Márgenes configurables por categoría
- ✅ Fácil de extender

**Ejemplo de uso**:
```javascript
import { CATEGORIES, CATEGORY_PATTERNS, CATEGORY_MARGINS } from './config/categories.js';

// Obtener margen de una categoría
const margin = CATEGORY_MARGINS[CATEGORIES.LAPTOPS]; // 9.5%
```

### `suppliers.js`
Define la configuración de cada proveedor (Caleta, PCMaster, etc.).

**Características**:
- ✅ Configuración modular por proveedor
- ✅ Selectores CSS específicos
- ✅ Patrones de extracción de imágenes
- ✅ Validación de configuración
- ✅ Fácil agregar nuevos proveedores

**Ejemplo de uso**:
```javascript
import { getSupplierConfig, getAvailableSuppliers } from './config/suppliers.js';

// Obtener configuración de un proveedor
const config = getSupplierConfig('caleta');

// Listar proveedores disponibles
const suppliers = getAvailableSuppliers(); // ['caleta', 'pcmaster']
```

## Cómo Agregar un Nuevo Proveedor

1. **Editar `suppliers.js`**:
```javascript
export const SUPPLIERS = {
  // ... proveedores existentes
  
  nuevo_proveedor: {
    id: 3,
    code: 'NUEVO',
    name: 'Nuevo Proveedor',
    url: 'https://ejemplo.com/distribucion',
    location: 'UBICACIÓN',
    currency: 'PEN',
    
    extractImages: true,
    imagePattern: 'table', // o 'id-based' o 'page'
    
    marginPercent: 5.5,
    
    selectors: {
      productRow: 'tr.producto',
      productCells: 'td',
      productLink: 'a.nombre',
      // ... más selectores
    }
  }
};
```

2. **Crear clase scraper** en `scraper.js`:
```javascript
class NuevoProveedorScraper extends BaseScraper {
  async extractRawProducts() {
    // Implementar extracción específica
  }
}
```

3. **Registrar en factory**:
```javascript
case 'nuevo_proveedor':
  return new NuevoProveedorScraper(config, logger);
```

## Cómo Modificar Márgenes

Editar `categories.js`:
```javascript
export const CATEGORY_MARGINS = {
  [CATEGORIES.LAPTOPS]: 9.5,      // Cambiar aquí
  [CATEGORIES.GABINETES]: 20.0,   // Cambiar aquí
  // ...
};
```

## Cómo Agregar Nuevas Categorías

1. **Agregar a `CATEGORIES`**:
```javascript
export const CATEGORIES = {
  // ... existentes
  NUEVA_CATEGORIA: 'Nueva Categoría'
};
```

2. **Agregar patrón de detección**:
```javascript
export const CATEGORY_PATTERNS = [
  // ... existentes
  {
    category: CATEGORIES.NUEVA_CATEGORIA,
    patterns: [
      /patron1/i,
      /patron2/i
    ]
  }
];
```

3. **Agregar margen**:
```javascript
export const CATEGORY_MARGINS = {
  // ... existentes
  [CATEGORIES.NUEVA_CATEGORIA]: 10.0
};
```

## Variables de Entorno

Crear archivo `.env` en la raíz:
```env
# API Configuration
API_URL=http://localhost:8000/api
API_TOKEN=tu_token_aqui

# Supplier Selection
SUPPLIER_ID=1
SUPPLIER_CODE=caleta

# Scraping Behavior
HEADLESS=true
TIMEOUT_MS=60000
MAX_RETRIES=3
CONCURRENCY=1
```

## Beneficios

- 📝 **Mantenibilidad**: Configuración separada del código
- 🔧 **Flexibilidad**: Fácil modificar márgenes y categorías
- 🚀 **Escalabilidad**: Agregar proveedores sin tocar lógica core
- ✅ **Validación**: Configuración validada automáticamente
- 📚 **Documentación**: Configuración auto-documentada
