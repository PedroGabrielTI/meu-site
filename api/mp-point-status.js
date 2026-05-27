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

    const intentStateRaw = intentData?.state || '';
    const intentState = String(intentStateRaw).toUpperCase();

    const paymentId =
      intentData?.payment?.id ||
      intentData?.payment?.payment_id ||
      intentData?.payment_id ||
      intentData?.payment?.paymentId ||
      null;

    console.log('[mp-point-status] intent.state:', intentStateRaw, '| payment.id:', paymentId);

    let paymentData = null;

    // Em FINISHED/CONFIRMATION_REQUIRED, a intent pode ter terminado aprovada OU recusada.
    // Quando houver payment_id, consulta /v1/payments para obter o status real.
    if (paymentId && ['FINISHED', 'CONFIRMATION_REQUIRED'].includes(intentState)) {
      const payRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } }
      );
      paymentData = await payRes.json().catch(() => ({}));
      console.log('[mp-point-status] payment.status:', paymentData?.status, '| payment.status_detail:', paymentData?.status_detail);
    }

    return res.status(200).json({
      id: intentData?.id,
      state: intentData?.state,
      status_detail: paymentData?.status_detail || intentData?.status_detail || intentData?.payment?.status_detail || null,
      amount: intentData?.amount,
      description: intentData?.description,
      payment: {
        ...(intentData?.payment || {}),
        state: paymentData?.status || intentData?.payment?.state || intentData?.payment?.status || null,
        status: paymentData?.status || intentData?.payment?.status || null,
        status_detail: paymentData?.status_detail || intentData?.payment?.status_detail || null,
        payment_id: paymentId
      },
      raw: intentData,
      payment_raw: paymentData
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao consultar status da maquininha.' });
  }
}
