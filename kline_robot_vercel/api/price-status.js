export default function handler(req, res) {
  res.status(200).json({
    service: "market-price-cache",
    enabled: true,
    intervalMinutes: 5,
    message: "Scheduled updater status will be connected here"
  });
}
