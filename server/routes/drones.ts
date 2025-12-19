import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Mappa Product + SKU + PriceListItem a formato Drone legacy per compatibilità
function mapProductToDrone(product: any, sku: any, priceListItem: any) {
  const specs = product.specs_json as any || {};
  const glbFiles = (product.glb_files_json as any[]) || [];
  const images = (product.images_json as any[]) || [];
  const coreSpecs = product.specs_core_json || [];
  const extraSpecs = product.specs_extra_json || [];
  const manuals = product.manuals_pdf_json || [];
  
  // Prendi la prima immagine GLB se disponibile, altrimenti la prima immagine normale
  const primaryImage = glbFiles.length > 0 
    ? { url: glbFiles[0].url, type: 'glb' }
    : images.length > 0 
      ? { url: images[0].url, type: 'image' }
      : null;

  return {
    id: product.id.replace('prd_', ''),
    model: product.model,
    price: priceListItem ? priceListItem.price_cents / 100 : 0,
    category: specs.category || 'Standard',
    tagline: specs.tagline || product.name,
    targetUse: specs.targetUse || '',
    imageUrl: primaryImage?.type === 'image' ? primaryImage.url : (images.length > 0 ? images[0].url : null),
    glbUrl: glbFiles.length > 0 ? glbFiles[0].url : null,
    images: images,
    specs_core_json: coreSpecs,
    specs_extra_json: extraSpecs,
    manuals_pdf_json: manuals,
    tankCapacity: specs.tank || '',
    batteryInfo: specs.battery || '',
    efficiency: specs.efficiency || '',
    features: specs.feature || '',
    roiMonths: specs.roi_months || 0,
    efficiencyHaPerHour: specs.efficiency_ha_per_hour || 0
  };
}

export const getDrones: RequestHandler = async (req, res) => {
  try {
    // Fetch Products di tipo DRONE (solo ACTIVE, escludi ARCHIVED)
    const products = await prisma.product.findMany({
      where: {
        product_type: 'DRONE',
        status: 'ACTIVE' // Solo droni disponibili
      },
      include: {
        skus: true
      },
      orderBy: {
        model: 'asc'
      }
    });

    // Per ogni SKU, trova il prezzo attivo
    const drones = [];
    for (const product of products) {
      for (const sku of product.skus) {
        // Trova price list item attivo per questo SKU
        const priceListItem = await prisma.priceListItem.findFirst({
          where: {
            sku_id: sku.id,
            price_list: {
              status: 'ACTIVE',
              valid_from: { lte: new Date() },
              OR: [
                { valid_to: null },
                { valid_to: { gte: new Date() } }
              ]
            }
          },
          include: {
            price_list: true
          }
        });

        if (priceListItem) {
          const drone = mapProductToDrone(product, sku, priceListItem);
          drones.push(drone);
        }
      }
    }

    res.json(drones);
  } catch (error: any) {
    console.error('Error fetching drones:', error);
    handlePrismaError(error, res, []);
  }
};

export const getDroneById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = `prd_${id}`;
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        skus: {
          include: {
            price_list_items: {
              where: {
                price_list: {
                  status: 'ACTIVE'
                }
              },
              take: 1
            }
          },
          take: 1
        }
      }
    });

    if (!product || product.skus.length === 0) {
      return res.status(404).json({ error: 'Drone not found' });
    }

    const sku = product.skus[0];
    const priceListItem = sku.price_list_items[0];
    const drone = mapProductToDrone(product, sku, priceListItem);

    res.json(drone);
  } catch (error) {
    console.error('Error fetching drone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
