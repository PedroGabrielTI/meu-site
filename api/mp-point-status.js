// ============================================================
// API: /api/mp-point-status
// Consulta o status de uma Order do Point (nova API /v1/orders)
// Documentação: https://www.mercadopago.com.br/developers/en/docs/mp-point/payment-processing
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN.' });

  // Suporta tanto o param antigo (payment_intent_id) quanto o novo (order_id)
  // para compatibilidade durante a migração
  const orderId = req.query?.order_id || req.query?.payment_intent_id;
  if (!orderId) return res.status(400).json({ error: 'order_id é obrigatório.' });

  try {
    // Consulta a Order pela nova API
    const orderRes = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const orderData = await orderRes.json().catch(() => ({}));

    if (!orderRes.ok) {
      return res.status(orderRes.status).json({
        error: orderData?.message || orderData?.error || 'Erro ao consultar order.',
        raw: orderData
      });
    }

    const orderStatus = orderData?.status || '';         // ex: "open", "processed", "canceled"
    const orderDetail = orderData?.status_detail || '';  // ex: "accredited", "rejected"

    console.log('[mp-point-status] order.status:', orderStatus, '| detail:', orderDetail);

    // Pega o payment_id associado para mais detalhes se necessário
    const payments     = orderData?.transactions?.payments || [];
    const firstPayment = payments[0] || {};
    const paymentId    = firstPayment?.id || null;
    const payStatus    = firstPayment?.status || null;

    // Mapeamento de status da nova API para o padrão que o frontend já entende:
    // - "processed" + "accredited" → equivale a "FINISHED" com pagamento aprovado
    // - "canceled"                 → equivale ao estado de cancelado
    // - "open" / "pending"         → ainda aguardando
    let mappedState = orderStatus.toUpperCase();
    // Para compatibilidade com o código frontend que espera "FINISHED"
    if (orderStatus === 'processed') mappedState = 'FINISHED';
    if (orderStatus === 'canceled')  mappedState = 'CANCELED';

    return res.status(200).json({
      id:           orderData?.id,
      state:        mappedState,
      status_detail: orderDetail,
      amount:       orderData?.total_amount,
      description:  orderData?.description,
      payment: {
        id:           paymentId,
        state:        payStatus || (orderDetail === 'accredited' ? 'approved' : orderDetail),
        status_detail: orderDetail,
        payment_id:   paymentId
      },
      raw: orderData
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao consultar status da maquininha.'
    });
  }
}
