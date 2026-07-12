export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "Manual refresh endpoint ready. Worker runs through GitHub Actions."
  });
}
