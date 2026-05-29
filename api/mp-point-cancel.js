// ============================================================
// API: /api/mp-point-cancel
// Cancela uma Order do Point (nova API /v1/orders/:id/cancel)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN nas variáveis de ambiente.' });
  }

  // Suporta tanto o param antigo (payment_intent_id) quanto o novo (order_id)
  const orderId = req.body?.order_id || req.body?.payment_intent_id;
  if (!orderId) {
    return res.status(400).json({ error: 'order_id é obrigatório.' });
  }

  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json().catch(() => ({}));
    console.log('[mp-point-cancel] status:', response.status, '| data:', JSON.stringify(data));

    if (!response.ok) {
      const rawMsg = String(data?.message || '').toLowerCase();
      if (rawMsg.includes('being processed') || rawMsg.includes('conflict') || response.status === 409) {
        return res.status(409).json({
          error: 'A maquininha está processando o pagamento agora, não é possível cancelar.',
          raw: data
        });
      }
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Não foi possível cancelar a cobrança.',
        raw: data
      });
    }

    return res.status(200).json({ success: true, raw: data });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao cancelar cobrança da maquininha.'
    });
  }
}
