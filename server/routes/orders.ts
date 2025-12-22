import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";
import { OrderStatus } from "../../generated/prisma/client";

// Ottieni tutti gli ordini per un'organizzazione (sia buyer che seller)
export const getOrders: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    console.log('🔵 getOrders chiamato per orgId:', orgId);

    // Carica ordini con Prisma, filtrando solo stati validi
    const validStatuses: OrderStatus[] = ['PAID', 'SHIPPED', 'FULFILLED', 'CANCELLED', 'PROBLEMATIC'];
    
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { buyer_org_id: orgId },
          { seller_org_id: orgId }
        ],
        order_status: {
          in: validStatuses
        }
      },
      include: {
        buyer_org: true,
        order_lines: {
          include: {
            sku: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    // Trasforma i dati per il frontend
    const transformedOrders = orders.map(order => ({
        id: order.id,
        buyer_org_id: order.buyer_org_id,
        seller_org_id: order.seller_org_id,
        buyer_org_name: order.buyer_org.legal_name,
        order_status: order.order_status,
        total_cents: order.total_cents,
        currency: order.currency,
        created_at: order.created_at,
        order_lines: order.order_lines.map(line => ({
          id: line.id,
          sku_id: line.sku_id,
          sku_code: line.sku.sku_code,
          product_name: line.sku.product.name,
          product_model: line.sku.product.model,
          qty: line.qty,
          unit_price_cents: line.unit_price_snapshot_cents,
          line_total_cents: line.line_total_cents
        }))
      }));

    console.log('✅ getOrders: trovati', transformedOrders.length, 'ordini');
    res.json(transformedOrders);
  } catch (error: any) {
    console.error('❌ Errore in getOrders:', error);
    console.error('Stack:', error.stack);
    handlePrismaError(error, res, []);
  }
};

// Ottieni statistiche ordini per dashboard
export const getOrderStats: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Statistiche per dashboard
    const [
      totalRevenue,
      activeOrders,
      completedOrders,
      recentOrders
    ] = await Promise.all([
      // Ricavi totali (solo come seller)
      prisma.order.aggregate({
        where: {
          seller_org_id: orgId,
          order_status: { in: ['PAID', 'FULFILLED'] }
        },
        _sum: { total_cents: true }
      }),

      // Ordini attivi
      prisma.order.count({
        where: {
          seller_org_id: orgId,
          order_status: { in: ['PAID', 'SHIPPED'] }
        }
      }),

      // Ordini completati questo mese
      prisma.order.count({
        where: {
          seller_org_id: orgId,
          order_status: 'FULFILLED',
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Ordini recenti (ultimi 10)
      prisma.order.findMany({
        where: {
          OR: [
            { buyer_org_id: orgId },
            { seller_org_id: orgId }
          ]
        },
        include: {
          buyer_org: true,
          order_lines: {
            include: {
              sku: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 10
      })
    ]);

    const transformedRecentOrders = recentOrders.map(order => ({
      id: order.id,
      buyer_org_name: order.buyer_org.legal_name,
      order_status: order.order_status,
      total_cents: order.total_cents,
      created_at: order.created_at,
      products: order.order_lines.map(line => line.sku.product.name).join(', ')
    }));

    res.json({
      totalRevenue: totalRevenue._sum.total_cents || 0,
      activeOrders,
      completedOrdersThisMonth: completedOrders,
      recentOrders: transformedRecentOrders
    });
  } catch (error: any) {
    handlePrismaError(error, res, {
      totalRevenue: 0,
      activeOrders: 0,
      completedOrdersThisMonth: 0,
      recentOrders: []
    });
  }
};

// Crea ordine di esempio (per testing)
export const createSampleOrder: RequestHandler = async (req, res) => {
  try {
    const { buyerOrgId, sellerOrgId, items } = req.body;

    // Calcola totale
    let totalCents = 0;
    const orderLines = [];

    for (const item of items) {
      const sku = await prisma.sku.findUnique({
        where: { id: item.skuId },
        include: { product: true }
      });

      if (!sku) {
        return res.status(400).json({ error: `SKU ${item.skuId} non trovato` });
      }

      // Trova prezzo corrente per questo SKU
      const priceListItem = await prisma.priceListItem.findFirst({
        where: {
          sku_id: item.skuId,
          price_list: {
            vendor_org_id: sellerOrgId,
            status: 'ACTIVE'
          }
        }
      });

      const unitPrice = priceListItem?.price_cents || 100000; // Default 1000€
      const lineTotal = unitPrice * item.qty;

      orderLines.push({
        sku_id: item.skuId,
        qty: item.qty,
        unit_price_snapshot_cents: unitPrice,
        line_total_cents: lineTotal
      });

      totalCents += lineTotal;
    }

    // Crea ordine
    const order = await prisma.order.create({
      data: {
        buyer_org_id: buyerOrgId,
        seller_org_id: sellerOrgId,
        order_status: 'PAID',
        total_cents: totalCents,
        currency: 'EUR',
        order_lines: {
          create: orderLines
        }
      },
      include: {
        buyer_org: true,
        order_lines: {
          include: {
            sku: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    res.json(order);
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};

// Aggiorna lo stato di un ordine
export const updateOrderStatus: RequestHandler = async (req, res) => {
  console.log('🔵 updateOrderStatus chiamato:', req.method, req.path, req.params, req.body);
  try {
    const { orderId } = req.params;
    const { order_status } = req.body;

    if (!orderId || !order_status) {
      return res.status(400).json({ error: 'orderId e order_status richiesti' });
    }

    // Valida lo stato
    const validStatuses = ['PAID', 'SHIPPED', 'FULFILLED', 'CANCELLED', 'PROBLEMATIC'];
    if (!validStatuses.includes(order_status)) {
      return res.status(400).json({ error: 'Stato ordine non valido' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { order_status },
      include: {
        buyer_org: true,
        order_lines: {
          include: {
            sku: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    // Trasforma per il frontend
    const transformedOrder = {
      id: order.id,
      buyer_org_id: order.buyer_org_id,
      seller_org_id: order.seller_org_id,
      buyer_org_name: order.buyer_org.legal_name,
      order_status: order.order_status,
      total_cents: order.total_cents,
      currency: order.currency,
      created_at: order.created_at,
      order_lines: order.order_lines.map(line => ({
        id: line.id,
        sku_id: line.sku_id,
        sku_code: line.sku.sku_code,
        product_name: line.sku.product.name,
        product_model: line.sku.product.model,
        qty: line.qty,
        unit_price_cents: line.unit_price_snapshot_cents,
        line_total_cents: line.line_total_cents
      }))
    };

    res.json(transformedOrder);
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};
