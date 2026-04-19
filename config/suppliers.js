/**
 * Configuración de Proveedores
 * 
 * Define la configuración específica de cada proveedor
 */

export const SUPPLIERS = {

    pcmaster: {
        id: 2,
        code: 'PCMASTER',
        name: 'PCMaster Store',
        url: 'https://pcmasterstore.com/distribucion',
        location: 'CC MINKA',
        currency: 'PEN',

        // Configuración de extracción
        extractImages: false,
        imagePattern: 'table', // 'id-based' | 'table' | 'page'

        // Márgenes
        marginPercent: 5.5,

        // Selectores CSS específicos
        selectors: {
            productRow: 'tr.pcms-row',
            productCells: 'td.nthss, td.pcms-img, td.pcms-center, td',
            productLink: 'a.pcms-name, a',
            productImage: 'td.pcms-img img',
            productId: 'input[name="id"]',
            stock: '.pcms-center',
            price: '.pcms-center'
        }
    },

    caleta: {
        id: 3,
        code: 'CALETA',
        name: 'Caleta',
        url: 'https://www.asesores555.caleta.pe/distribucion2.php',
        location: 'CC CYBERPLAZA',
        currency: 'PEN',

        // Configuración de extracción
        extractImages: true,
        imagePattern: 'id-based', // 'id-based' | 'table' | 'page'
        imageBaseUrl: 'https://www.caleta.pe/fotos',
        imageExtension: '.png',

        // Márgenes
        marginPercent: 5.5,

        // Selectores CSS específicos
        selectors: {
            productRow: 'tr',
            productCells: 'td.nthss',
            productLink: 'a',
            productId: 'input[name="id"]',
            stock: 'p',
            price: '.precio66'
        }
    },
};

/**
 * Obtener configuración de un proveedor
 */
export function getSupplierConfig(supplierCode) {
    const config = SUPPLIERS[supplierCode.toLowerCase()];
    if (!config) {
        throw new Error(`Proveedor no encontrado: ${supplierCode}`);
    }
    return config;
}

/**
 * Listar todos los proveedores disponibles
 */
export function getAvailableSuppliers() {
    return Object.keys(SUPPLIERS);
}

/**
 * Validar configuración de proveedor
 */
export function validateSupplierConfig(config) {
    const required = ['id', 'code', 'name', 'url', 'location', 'currency'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(`Configuración incompleta. Faltan campos: ${missing.join(', ')}`);
    }

    return true;
}
