export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const payerEmail =
    process.env.MP_PAYER_EMAIL ||
    req.body?.payer_email ||
    'caixa@minimercado.local';

  if (!accessToken) {
    return res.status(500).json({
      error: 'Configure MP_ACCESS_TOKEN nas variáveis da Vercel.'
    });
  }

  try {
    const amountNumber = Number(req.body?.amount || 0);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({
        error: 'Valor inválido para gerar o PIX.'
      });
    }

    const externalReference = String(
      req.body?.external_reference || req.body?.venda_id || ''
    ).trim();

    const payload = {
      transaction_amount: Number(amountNumber.toFixed(2)),
      description: String(
        req.body?.description || 'Venda Mini Mercado'
      ).slice(0, 120),
      payment_method_id: 'pix',
      payer: {
        email: payerEmail
      },
      ...(externalReference ? { external_reference: externalReference } : {})
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error ||
          'Mercado Pago recusou a criação do PIX.',
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
      error: error?.message || 'Erro interno ao gerar o QR Code PIX.'
    });
  }
}
