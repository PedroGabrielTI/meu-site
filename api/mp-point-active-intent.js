export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const deviceId = process.env.MP_DEVICE_ID;

  if (!accessToken || !deviceId) {
    return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN e MP_DEVICE_ID nas variáveis da Vercel.' });
  }

  try {
    // Busca a intent ativa atual no device
    const response = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // 404 significa que não há intent ativa — retorna vazio sem erro
      if (response.status === 404) return res.status(200).json({ id: null });
      return res.status(response.status).json({ error: data?.message || 'Erro ao consultar intent ativa.', raw: data });
    }

    return res.status(200).json({
      id: data?.id || null,
      state: data?.state || null,
      amount: data?.amount || null,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno.' });
  }
}
