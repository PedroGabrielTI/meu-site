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
      return res.status(400).json({
        error: 'Valor inválido para envio à maquininha.'
      });
    }

    const externalReference = String(
      req.body?.external_reference || req.body?.venda_id || ''
    ).trim();

    // Usa o tipo enviado pelo frontend (debit_card ou credit_card)
    // Se não enviado, deixa a maquininha decidir (sem forçar tipo)
    const paymentMethodId = req.body?.payment_method_id;
    const paymentType = paymentMethodId === 'debit_card' ? 'debit_card'
                      : paymentMethodId === 'credit_card' ? 'credit_card'
                      : null;

    const paymentObj = {
      installments: 1,
    };

    // Só adiciona o type se foi especificado — senão deixa a maquininha mostrar as opções
    if (paymentType) {
      paymentObj.type = paymentType;
    }

    const payload = {
      amount: Math.round(amountNumber * 100),
      description: String(
        req.body?.description || 'Venda Mercado Penharol'
      ).slice(0, 120),
      payment: paymentObj,
      additional_info: {
        print_on_terminal: true,
        ...(externalReference ? { external_reference: externalReference } : {})
      }
    };

    const response = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const rawMessage = String(data?.message || data?.error || '').toLowerCase();
      if (rawMessage.includes('queued intent')) {
        return res.status(409).json({
          error: 'Já existe uma cobrança pendente para esta maquininha. Cancele ou aguarde alguns segundos antes de tentar de novo.',
          raw: data
        });
      }

      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error ||
          'Mercado Pago recusou a criação da cobrança.',
        raw: data
      });
    }

    return res.status(200).json({
      id: data?.id || null,
      state: data?.state || null,
      detail: data?.status_detail || data?.detail || null,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao criar cobrança na maquininha.'
    });
  }
}
