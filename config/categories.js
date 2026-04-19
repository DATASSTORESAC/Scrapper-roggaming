/**
 * Configuración de Categorías y Detección
 * 
 * Define las categorías disponibles y los patrones de detección
 */

export const CATEGORIES = {
    // Computadoras
    PC_COMPLETA: 'PC Completa',
    LAPTOPS: 'Laptops',

    // Componentes principales
    PROCESADORES: 'Procesadores',
    PLACAS_MADRE: 'Placas Madre',
    MEMORIAS_RAM: 'Memorias RAM',
    TARJETAS_GRAFICAS: 'Tarjetas Gráficas',
    ALMACENAMIENTO: 'Almacenamiento',
    FUENTES_PODER: 'Fuentes de Poder',
    GABINETES: 'Gabinetes',
    REFRIGERACION: 'Refrigeración',

    // Periféricos
    MONITORES: 'Monitores',
    TECLADOS: 'Teclados',
    MOUSES: 'Mouses',
    AUDIFONOS: 'Audífonos',
    PERIFERICOS: 'Periféricos',
    CAMARAS: 'Cámaras',

    // Redes y otros
    REDES: 'Redes',
    IMPRESORAS: 'Impresoras',
    OTROS: 'Otros'
};

/**
 * Patrones de detección de categorías
 * Orden de prioridad: de arriba hacia abajo
 */
export const CATEGORY_PATTERNS = [
    // Prioridad 1: Laptops
    {
        category: CATEGORIES.LAPTOPS,
        patterns: [
            /\blaptop\b/i,
            /notebook/i,
            /ultrabook/i,
            /chromebook/i,
            /netbook/i
        ]
    },

    // Prioridad 2: PC Completa
    {
        category: CATEGORIES.PC_COMPLETA,
        patterns: [
            /\bpc completa\b/i,
            /\bpc armada\b/i,
            /\bequipo completo\b/i
        ],
        // Detección avanzada por múltiples componentes
        advancedDetection: (name) => {
            const nameLower = name.toLowerCase();
            const hasMultipleComponents = nameLower.includes('+');

            if (!hasMultipleComponents) return false;

            // Detectar componentes principales
            const hasProcessor = /\b(intel|amd|ryzen|core)\s+(i[3579]|ryzen|r[3579])/i.test(nameLower);
            const hasMotherboard = /\b(b[4567]\d{2}|h[4567]\d{2}|x[4567]\d{2}|z[4567]\d{2}|a[4567]\d{2})\b/i.test(nameLower);
            const hasRAM = /\b\d+gb\s*(ddr[345]|ram)\b|\bddr[345]\b/i.test(nameLower);
            const hasGPU = /\b(rtx|gtx|radeon|rx)\s*\d{3,4}\b/i.test(nameLower);
            const hasStorage = /\b\d+(gb|tb)\s*(m\.2|ssd|nvme)\b/i.test(nameLower);

            // Si tiene 3+ componentes principales, es PC completa
            const componentCount = [hasProcessor, hasMotherboard, hasRAM, hasGPU, hasStorage].filter(Boolean).length;
            if (componentCount >= 3) return true;

            // Si empieza con "PC" y tiene componentes
            if (/^\s*pc\s+/i.test(nameLower)) {
                return (hasRAM && hasStorage) || (hasRAM && hasGPU);
            }

            return false;
        }
    },

    // Periféricos específicos
    {
        category: CATEGORIES.CAMARAS,
        patterns: [
            /\bcamara\b/i,
            /\bcam\b/i,
            /webcam/i,
            /camara smart/i,
            /camara ip/i,
            /camara wifi/i
        ]
    },

    {
        category: CATEGORIES.TECLADOS,
        patterns: [
            /\bteclado\b/i,
            /keyboard/i,
            /(red|blue|brown)\s+switch/i
        ],
        exclude: [/\blaptop\b/i]
    },

    {
        category: CATEGORIES.AUDIFONOS,
        patterns: [
            /\bauricular\b/i,
            /headset/i,
            /audifono/i
        ]
    },

    {
        category: CATEGORIES.MOUSES,
        patterns: [
            /\bmouse\b/i,
            /raton/i,
            /gaming mouse/i
        ],
        exclude: [/\bauricular\b/i, /headset/i]
    },

    // Componentes individuales
    {
        category: CATEGORIES.GABINETES,
        patterns: [
            /\bcase\b/i,
            /\bgabinete\b/i,
            /tower/i,
            /chasis/i
        ],
        exclude: [/motherboard/i, /placa madre/i]
    },

    {
        category: CATEGORIES.PROCESADORES,
        patterns: [
            /\bprocesador\b/i,
            /\bcpu\b/i,
            /\bryzen\b/i,
            /core i[3579]/i
        ]
    },

    {
        category: CATEGORIES.PLACAS_MADRE,
        patterns: [
            /\bmbb\b/i,
            /motherboard/i,
            /placa madre/i,
            /mainboard/i
        ],
        exclude: [/\bcase\b/i, /\bgabinete\b/i]
    },

    {
        category: CATEGORIES.MEMORIAS_RAM,
        patterns: [
            /\bmemoria\b/i,
            /\bram\b/i,
            /\bddr[345]\b/i
        ]
    },

    {
        category: CATEGORIES.TARJETAS_GRAFICAS,
        patterns: [
            /tarjeta grafica/i,
            /tarjeta de video/i,
            /\bgpu\b/i,
            /geforce/i,
            /radeon/i
        ]
    },

    {
        category: CATEGORIES.ALMACENAMIENTO,
        patterns: [
            /\bssd\b/i,
            /\bhdd\b/i,
            /\bdisco\b/i,
            /nvme/i,
            /m\.2/i
        ]
    },

    {
        category: CATEGORIES.FUENTES_PODER,
        patterns: [
            /\bfuente\b/i,
            /\bpsu\b/i,
            /power supply/i,
            /\b\d{3,4}w\b/i  // Solo wattajes de 3-4 dígitos (ej: 500w, 750w)
        ],
        exclude: [/\bcase\b/i, /gabinete/i, /\bcamara\b/i]
    },

    {
        category: CATEGORIES.MONITORES,
        patterns: [
            /\bmonitor\b/i,
            /pantalla/i,
            /display/i
        ]
    },

    {
        category: CATEGORIES.REFRIGERACION,
        patterns: [
            /\bcooler\b/i,
            /\bfan\b/i,
            /ventilador/i,
            /refrigeracion/i
        ]
    },

    {
        category: CATEGORIES.REDES,
        patterns: [
            /\brouter\b/i,
            /\bswitch\b/i,
            /modem/i,
            /ups/i,
            /estabilizador/i
        ]
    },

    {
        category: CATEGORIES.IMPRESORAS,
        patterns: [
            /\bimpresora\b/i,
            /printer/i
        ]
    },

    {
        category: CATEGORIES.PERIFERICOS,
        patterns: [
            /mousepad/i,
            /parlante/i,
            /microfono/i
        ]
    }
];

/**
 * Márgenes de ganancia por categoría (en porcentaje)
 */
export const CATEGORY_MARGINS = {
    [CATEGORIES.PC_COMPLETA]: 8.0,
    [CATEGORIES.LAPTOPS]: 9.5,
    [CATEGORIES.PROCESADORES]: 6.0,
    [CATEGORIES.PLACAS_MADRE]: 7.5,
    [CATEGORIES.MEMORIAS_RAM]: 9.0,
    [CATEGORIES.TARJETAS_GRAFICAS]: 6.5,
    [CATEGORIES.ALMACENAMIENTO]: 8.0,
    [CATEGORIES.FUENTES_PODER]: 7.0,
    [CATEGORIES.GABINETES]: 20.0,
    [CATEGORIES.REFRIGERACION]: 12.0,
    [CATEGORIES.MONITORES]: 8.5,
    [CATEGORIES.TECLADOS]: 15.0,
    [CATEGORIES.MOUSES]: 15.0,
    [CATEGORIES.AUDIFONOS]: 15.0,
    [CATEGORIES.PERIFERICOS]: 18.0,
    [CATEGORIES.CAMARAS]: 15.0,
    [CATEGORIES.REDES]: 10.0,
    [CATEGORIES.IMPRESORAS]: 11.0,
    [CATEGORIES.OTROS]: 10.0
};

/**
 * Margen por defecto si no se encuentra la categoría
 */
export const DEFAULT_MARGIN = 5.5;
