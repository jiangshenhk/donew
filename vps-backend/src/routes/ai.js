import { Router } from 'express';
import { securityCheck } from '../api/_lib/security.js';

import sellPutDecisionHandler from '../api/sell-put-decision.js';
import reportHandler from '../api/report.js';
import marketReportV2Handler from '../api/market-report-v2.js';
import newsSummaryHandler from '../api/news-summary.js';
import baziAnalysisHandler from '../api/bazi-analysis.js';
import putRatingHandler from '../api/put-rating.js';

const router = Router();

function adaptAiRoute(handler) {
  return (req, res, next) => {
    if (!securityCheck(req, res)) return;
    handler(req, res).catch(next);
  };
}

router.post('/api/ai/sell-put-decision', adaptAiRoute(sellPutDecisionHandler));
router.post('/api/ai/report', adaptAiRoute(reportHandler));
router.get('/api/ai/market-report', adaptAiRoute(marketReportV2Handler));
router.post('/api/ai/news-summary', adaptAiRoute(newsSummaryHandler));
router.post('/api/ai/bazi-analysis', adaptAiRoute(baziAnalysisHandler));
router.post('/api/ai/put-rating', adaptAiRoute(putRatingHandler));

export default router;
