export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const deviceId = process.env.MP_DEVICE_ID;

  if (!accessToken || !deviceId) {
    return res.status(500).json({
      error: 'Configure MP_ACCESS_TOKEN e MP_DEVICE_ID nas variáveis da Vercel.'
    });
  }

  try {
    const amountNumber = Number(req.body?.amount || 0);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: 'Valor inválido para envio à maquininha.' });
    }

    const externalReference = String(req.body?.external_reference || req.body?.venda_id || '').trim();
    const description = String(req.body?.description || 'Venda Mercado Penharol').slice(0, 120);
    const basePayload = {
      amount: Math.round(amountNumber * 100),
      description,
      additional_info: {
        print_on_terminal: true,
        ...(externalReference ? { external_reference: externalReference } : {})
      }
    };

    // Tenta 1: debit_card
    // Tenta 2: sem type (maquininha decide)
    // Tenta 3: credit_card (fallback)
    const attempts = [
      { ...basePayload, payment: { installments: 1, type: 'debit_card' } },
      { ...basePayload, payment: { installments: 1 } },
      { ...basePayload, payment: { installments: 1, type: 'credit_card' } },
    ];

    let lastError = null;
    for (const payload of attempts) {
      const response = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json().catch(() => ({}));
      console.log('[mp-point-create-debit] type=', payload.payment?.type || 'none', 'status=', response.status, 'msg=', data?.message || '');

      if (response.ok) {
        return res.status(200).json({
          id: data?.id || null,
          state: data?.state || null,
          detail: data?.status_detail || data?.detail || null,
          raw: data
        });
      }

      const msg = String(data?.message || '').toLowerCase();
      // Se for erro de queued intent, para imediatamente
      if (msg.includes('queued intent')) {
        return res.status(409).json({
          error: 'Já existe uma cobrança pendente. Cancele ou aguarde alguns segundos.',
          raw: data
        });
      }

      // Se for erro de type inválido, tenta próximo
      if (msg.includes('does not match') || msg.includes('payment.type') || msg.includes('property_type')) {
        lastError = data;
        continue;
      }

      // Outro erro — retorna direto
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Mercado Pago recusou a criação da cobrança.',
        raw: data
      });
    }

    return res.status(400).json({
      error: 'Não foi possível criar cobrança de débito.',
      raw: lastError
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao criar cobrança na maquininha.'
    });
  }
}
