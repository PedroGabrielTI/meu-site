export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const paymentIntentId = req.query?.payment_intent_id;

  if (!accessToken) return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN na Vercel.' });
  if (!paymentIntentId) return res.status(400).json({ error: 'payment_intent_id é obrigatório.' });

  try {
    const response = await fetch(`https://api.mercadopago.com/point/integration-api/payment-intents/${encodeURIComponent(paymentIntentId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json().catch(() => ({}));

    // LOG para debug — aparece nos logs do Vercel
    console.log('[mp-point-status] state:', data?.state, '| payment.state:', data?.payment?.state, '| status_detail:', data?.status_detail, '| raw:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || data?.error || 'Mercado Pago não retornou o status da cobrança.', raw: data });
    }

    return res.status(200).json({
      id: data?.id,
      state: data?.state,
      status_detail: data?.status_detail || data?.detail || null,
      amount: data?.amount,
      description: data?.description,
      payment: data?.payment || null,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao consultar status da maquininha.' });
  }
}
