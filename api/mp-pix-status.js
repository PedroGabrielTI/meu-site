export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const paymentId = String(req.query?.payment_id || '').trim();

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
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error ||
          'Mercado Pago recusou a consulta do PIX.',
        raw: data
      });
    }

    const tx = data?.point_of_interaction?.transaction_data || {};

    return res.status(200).json({
      id: data?.id || null,
      status: data?.status || null,
      status_detail: data?.status_detail || null,
      qr_code: tx?.qr_code || null,
      qr_code_base64: tx?.qr_code_base64 || null,
      ticket_url: tx?.ticket_url || null,
      date_of_expiration: data?.date_of_expiration || null,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao consultar o PIX.'
    });
  }
}
