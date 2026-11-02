import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { PRODUCT_CATALOG, getProductCard } from '@hcc/shared';
import { ApiError } from '../lib/http';

export const catalogRouter = Router();

/** Product catalog is public within the app (no sensitive data). */
catalogRouter.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    res.json({ cards: PRODUCT_CATALOG });
  }),
);

catalogRouter.get(
  '/catalog/:key',
  asyncHandler(async (req, res) => {
    const card = getProductCard(req.params.key);
    if (!card) throw ApiError.notFound('Product card not found');
    res.json({ card });
  }),
);
