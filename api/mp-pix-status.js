export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN na Vercel.' });

  const paymentId = req.query?.payment_id;
  if (!paymentId) return res.status(400).json({ error: 'payment_id é obrigatório.' });

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'Erro ao consultar pagamento PIX.', raw: data });
    }

    return res.status(200).json({
      id: data?.id,
      status: data?.status,
      status_detail: data?.status_detail,
      transaction_amount: data?.transaction_amount,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno.' });
  }
}
