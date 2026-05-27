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
    // 1) Busca status da intent
    const intentRes = await fetch(
      `https://api.mercadopago.com/point/integration-api/payment-intents/${encodeURIComponent(paymentIntentId)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const intentData = await intentRes.json().catch(() => ({}));

    if (!intentRes.ok) {
      return res.status(intentRes.status).json({
        error: intentData?.message || intentData?.error || 'Erro ao consultar intent.',
        raw: intentData
      });
    }

    const intentState = intentData?.state || '';
    const paymentId = intentData?.payment?.id;

    console.log('[mp-point-status] intent.state:', intentState, '| payment.id:', paymentId);

    // 2) Se FINISHED e tem payment.id, busca o pagamento real para saber se aprovado ou recusado
    let paymentData = null;
    if (intentState === 'FINISHED' && paymentId) {
      const payRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
      );
      paymentData = await payRes.json().catch(() => ({}));
      console.log('[mp-point-status] payment.status:', paymentData?.status, '| payment.status_detail:', paymentData?.status_detail);
    }

    return res.status(200).json({
      id: intentData?.id,
      state: intentState,
      status_detail: paymentData?.status_detail || intentData?.status_detail || null,
      amount: intentData?.amount,
      description: intentData?.description,
      payment: {
        ...intentData?.payment,
        // Adiciona status real do pagamento quando disponível
        state: paymentData?.status || intentData?.payment?.state || null,
        status_detail: paymentData?.status_detail || null,
        payment_id: paymentId || null
      },
      raw: intentData
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao consultar status da maquininha.' });
  }
}
