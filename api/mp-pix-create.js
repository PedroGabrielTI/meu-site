export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'Configure MP_ACCESS_TOKEN nas variáveis da Vercel.' });
  }

  try {
    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor inválido para o PIX.' });
    }

    const vendaId = req.body?.venda_id || '';
    const description = String(req.body?.description || 'Mini Mercado').slice(0, 120);

    const payload = {
      transaction_amount: amount,
      description,
      payment_method_id: 'pix',
      payer: {
        email: 'cliente@minimercado.com',
        first_name: 'Cliente',
        last_name: 'Mini Mercado'
      },
      external_reference: String(vendaId),
      notification_url: process.env.MP_NOTIFICATION_URL || undefined
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `pix-venda-${vendaId}-${Date.now()}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Erro ao gerar PIX.',
        raw: data
      });
    }

    const qrCode = data?.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = data?.point_of_interaction?.transaction_data?.qr_code_base64;

    return res.status(200).json({
      id: data?.id,
      status: data?.status,
      qr_code: qrCode || null,
      qr_code_base64: qrCodeBase64 || null,
    });

  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Erro interno ao gerar PIX.' });
  }
}
