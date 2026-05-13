export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  // Aceita order_id (novo) ou payment_intent_id (compatibilidade)
  const orderId = req.query?.order_id || req.query?.payment_intent_id;

  if (!accessToken) return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN.' });
  if (!orderId) return res.status(400).json({ error: 'order_id é obrigatório.' });

  try {
    // Busca status da ordem na nova API
    const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Erro ao consultar ordem.',
        raw: data
      });
    }

    // Mapeia status da Orders API para o formato que o frontend espera
    const orderStatus = String(data?.status || '').toLowerCase();
    const payment = data?.transactions?.payments?.[0];
    const paymentStatus = String(payment?.status || '').toLowerCase();
    const paymentStatusDetail = payment?.status_detail || null;
    const paymentMethod = payment?.payment_method?.type || null;

    console.log('[mp-point-status-v2] order.status=', orderStatus, '| payment.status=', paymentStatus, '| detail=', paymentStatusDetail, '| method=', paymentMethod);

    // Mapeia status da Orders API para o formato legado que o frontend usa
    // Orders API: created, open, at_terminal, processing, finished, expired, canceled
    // Frontend espera: OPEN, ON_TERMINAL, FINISHED, CANCELED etc
    const stateMap = {
      'created': 'OPEN',
      'open': 'OPEN',
      'at_terminal': 'ON_TERMINAL',
      'processing': 'PROCESSING',
      'finished': 'FINISHED',
      'expired': 'CANCELED',
      'canceled': 'CANCELED',
    };

    const mappedState = stateMap[orderStatus] || orderStatus.toUpperCase();

    return res.status(200).json({
      id: orderId,
      state: mappedState,
      status_detail: paymentStatusDetail,
      amount: payment?.amount,
      payment: {
        id: payment?.id || null,
        state: paymentStatus,        // approved, rejected, cancelled etc
        status_detail: paymentStatusDetail,
        type: paymentMethod          // credit_card, debit_card
      },
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao consultar ordem.'
    });
  }
}
