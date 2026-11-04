import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';
import { cardInputSchema } from '@hcc/shared';
import { createCard, deleteCard, listCards, updateCard } from '../services/cardStore';
import { audit } from '../services/game';

export const cardRouter = Router();
cardRouter.use('/cards', requireAuth);

// List the global card library (readable by instructors and admins).
cardRouter.get(
  '/cards',
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json({ cards: await listCards() });
  }),
);

// Create a card (admins only).
cardRouter.post(
  '/cards',
  requireRole('ADMIN'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = cardInputSchema.parse(req.body);
    const card = await createCard(input);
    await audit(null, req.user!.sub, 'card.created', { cardKey: input.cardKey });
    res.status(201).json({ card });
  }),
);

// Update a card by its current key (admins only).
cardRouter.put(
  '/cards/:cardKey',
  requireRole('ADMIN'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = cardInputSchema.parse(req.body);
    const card = await updateCard(req.params.cardKey, input);
    await audit(null, req.user!.sub, 'card.updated', { cardKey: input.cardKey });
    res.json({ card });
  }),
);

// Delete a card (admins only; blocked when a scenario references it).
cardRouter.delete(
  '/cards/:cardKey',
  requireRole('ADMIN'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = await deleteCard(req.params.cardKey);
    await audit(null, req.user!.sub, 'card.deleted', { cardKey: req.params.cardKey });
    res.json(result);
  }),
);

// Small helper: distinct control ids available for tagging.
cardRouter.get(
  '/cards-meta',
  asyncHandler(async (_req, res) => {
    res.json({ controls: ['HSS', 'CFW', 'WAF', 'DEW', 'CBH', 'SecMaster'] });
  }),
);
