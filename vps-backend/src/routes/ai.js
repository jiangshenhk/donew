import { Router } from 'express';
import { securityCheck } from '../api/_lib/security.js';

import sellPutDecisionHandler from '../api/sell-put-decision.js';
import reportHandler from '../api/report.js';
import marketReportV2Handler from '../api/market-report-v2.js';
import newsSummaryHandler from '../api/news-summary.js';
import baziAnalysisHandler from '../api/bazi-analysis.js';
import putRatingHandler from '../api/put-rating.js';
import barchartOverviewHandler from '../api/barchart-overview.js';
import optionsRankingHandler from '../api/options-ranking.js';
import optionsSignalsHandler from '../api/options-signals.js';

const router = Router();

function adaptAiRoute(handler, handlerHasSecurityCheck = true) {
  return (req, res, next) => {
    if (!handlerHasSecurityCheck && !securityCheck(req, res)) return;
    handler(req, res).catch(next);
  };
}

router.post('/api/ai/sell-put-decision', adaptAiRoute(sellPutDecisionHandler));
router.post('/api/sell-put-decision', adaptAiRoute(sellPutDecisionHandler));
router.post('/api/ai/report', adaptAiRoute(reportHandler));
router.post('/api/report', adaptAiRoute(reportHandler));
router.get('/api/ai/market-report', adaptAiRoute(marketReportV2Handler));
router.get('/api/market-report-v2', adaptAiRoute(marketReportV2Handler));
router.post('/api/ai/news-summary', adaptAiRoute(newsSummaryHandler));
router.post('/api/news-summary', adaptAiRoute(newsSummaryHandler));
router.post('/api/ai/bazi-analysis', adaptAiRoute(baziAnalysisHandler));
router.post('/api/bazi-analysis', adaptAiRoute(baziAnalysisHandler));
router.post('/api/ai/put-rating', adaptAiRoute(putRatingHandler));
router.post('/api/put-rating', adaptAiRoute(putRatingHandler));
router.get('/api/barchart-overview', adaptAiRoute(barchartOverviewHandler, false));
router.get('/api/options-ranking', adaptAiRoute(optionsRankingHandler, false));
router.get('/api/options-signals', adaptAiRoute(optionsSignalsHandler, false));

export default router;
