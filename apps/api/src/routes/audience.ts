import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { getAudienceView } from '../services/game';

export const audienceRouter = Router();

/** Read-only, instructor-approved public view. No private team data. */
audienceRouter.get(
  '/audience/:token',
  asyncHandler(async (req, res) => {
    const view = await getAudienceView(req.params.token);
    res.json({ view });
  }),
);
