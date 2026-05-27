export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN na Vercel.' });

  const paymentId = req.body?.payment_id;
  if (!paymentId) return res.status(400).json({ error: 'payment_id é obrigatório.' });

  try {
    // O Mercado Pago cancela pagamentos PIX pendentes via PUT com status=cancelled
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelled' })
    });

    const data = await response.json().catch(() => ({}));

    // 400 pode significar que o PIX já expirou ou já foi pago — não é erro crítico
    if (!response.ok && response.status !== 400) {
      return res.status(response.status).json({
        error: data?.message || 'Erro ao cancelar PIX.',
        raw: data
      });
    }

    return res.status(200).json({ success: true, status: data?.status || null });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao cancelar PIX.' });
  }
}
