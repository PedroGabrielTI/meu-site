export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(200).json({ id: null, state: null });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const deviceId = process.env.MP_DEVICE_ID;

  if (!accessToken || !deviceId) {
    return res.status(200).json({ id: null, state: null });
  }

  try {
    const response = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(200).json({
        id: null,
        state: null,
        ignored_error: true,
        mp_status: response.status
      });
    }

    return res.status(200).json({
      id: data?.id || null,
      state: data?.state || null,
      amount: data?.amount || null
    });

  } catch (error) {
    return res.status(200).json({
      id: null,
      state: null,
      ignored_error: true
    });
  }
}
