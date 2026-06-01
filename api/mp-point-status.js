// ============================================================
// API: /api/mp-point-status
// Consulta o status de uma Order do Point (nova API /v1/orders)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN.' });

  const orderId = req.query?.order_id || req.query?.payment_intent_id;
  if (!orderId) return res.status(400).json({ error: 'order_id é obrigatório.' });

  try {
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

    const orderStatus = String(orderData?.status || '').toLowerCase();
    const orderDetail = String(orderData?.status_detail || '').toLowerCase();

    console.log('[mp-point-status] order.status:', orderStatus, '| detail:', orderDetail);

    // Extrai payment associado
    const payments     = orderData?.transactions?.payments || [];
    const firstPayment = payments[0] || {};
    const paymentId    = firstPayment?.id || null;

    // payment.status vem da API do MP — pode ser: approved, rejected, cancelled, pending, etc.
    // Garante que nunca ficará undefined: usa orderDetail como fallback confiável
    const rawPayStatus = String(firstPayment?.status || '').toLowerCase();

    // Mapeamento de state para o frontend:
    //
    //  "processed" = order encerrada na maquininha.
    //    → status_detail "accredited" = aprovado
    //    → qualquer outro detail = recusado/cancelado
    //
    //  "canceled"  = cancelado antes de completar
    //  "open"      = ainda aguardando no terminal
    //
    // Para compatibilidade, o frontend espera state="FINISHED" para acionar resolveFinishedState.
    // Mas agora também enviamos payment.state já resolvido para que resolveFinishedState
    // encontre um valor claro e não caia no fallback de "failure".

    let mappedState  = orderStatus.toUpperCase(); // "OPEN", "PROCESSED", "CANCELED", etc.
    let paymentState = rawPayStatus;              // valor real do MP (approved, rejected…)

    if (orderStatus === 'processed') {
      mappedState = 'FINISHED';

      // Se o MP não preencheu payment.status ainda, derivamos do status_detail da order:
      // "accredited" → aprovado; qualquer outro → rejeitado
      if (!paymentState || paymentState === 'pending' || paymentState === 'in_process') {
        paymentState = orderDetail === 'accredited' ? 'approved' : 'rejected';
      }
    }

    if (orderStatus === 'canceled') {
      mappedState  = 'CANCELED';
      paymentState = paymentState || 'cancelled';
    }

    console.log('[mp-point-status] mappedState:', mappedState, '| paymentState final:', paymentState);

    return res.status(200).json({
      id:           orderData?.id,
      state:        mappedState,
      status_detail: orderDetail,
      amount:       orderData?.total_amount,
      description:  orderData?.description,
      payment: {
        id:           paymentId,
        state:        paymentState,   // SEMPRE resolvido: 'approved' | 'rejected' | 'cancelled' | …
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
