export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const paymentId = String(req.body?.payment_id || '').trim();

  if (!accessToken) {
    return res.status(500).json({
      error: 'Configure MP_ACCESS_TOKEN nas variáveis da Vercel.'
    });
  }

  if (!paymentId) {
    return res.status(400).json({
      error: 'Informe payment_id.'
    });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelled' })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error ||
          'Mercado Pago recusou o cancelamento do PIX.',
        raw: data
      });
    }

    return res.status(200).json({
      id: data?.id || null,
      status: data?.status || null,
      status_detail: data?.status_detail || null,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao cancelar o PIX.'
    });
  }
}
