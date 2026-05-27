export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const deviceId = process.env.MP_DEVICE_ID;
  const paymentIntentId = req.body?.payment_intent_id;

  if (!accessToken || !deviceId) {
    return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN e MP_DEVICE_ID nas variáveis da Vercel.' });
  }
  if (!paymentIntentId) {
    return res.status(400).json({ error: 'payment_intent_id é obrigatório.' });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents/${encodeURIComponent(paymentIntentId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || data?.error || 'Mercado Pago não cancelou a cobrança.', raw: data });
    }

    return res.status(200).json({ success: true, raw: data });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao cancelar cobrança da maquininha.' });
  }
}
