// ============================================================
// API: /api/mp-point-create
// Cria uma ordem de pagamento na maquininha Point via
// nova API /v1/orders (substitui /point/integration-api/payment-intents)
// Documentação: https://www.mercadopago.com.br/developers/en/docs/mp-point/payment-processing
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const deviceId    = process.env.MP_DEVICE_ID;   // ex: "NEWLAND_N950__N950NCB801293324"

  if (!accessToken || !deviceId) {
    return res.status(500).json({
      error: 'Configure MP_ACCESS_TOKEN e MP_DEVICE_ID nas variáveis de ambiente.'
    });
  }

  const amountNumber = Number(req.body?.amount || 0);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return res.status(400).json({ error: 'Valor inválido.' });
  }

  // 'debit_card' ou 'credit_card'
  const requestedType = String(req.body?.payment_type || 'credit_card').toLowerCase();
  const paymentType   = requestedType === 'debit_card' ? 'debit_card' : 'credit_card';

  const externalReference = String(req.body?.external_reference || req.body?.venda_id || '').trim();
  const description       = String(req.body?.description || 'Venda Mercado Penharol').slice(0, 120);

  // Valor como string no formato "0.00" conforme exigido pela nova API
  const amountStr = amountNumber.toFixed(2);

  // Idempotency key única por chamada
  const idempotencyKey = `${externalReference || 'venda'}-${Date.now()}`;

  const payload = {
    type: 'point',
    external_reference: externalReference || undefined,
    description,
    transactions: {
      payments: [
        { amount: amountStr }
      ]
    },
    config: {
      point: {
        terminal_id: deviceId,
        print_on_terminal: 'merchant'  // string obrigatória: 'merchant' | 'no_ticket' | 'both'
      },
      payment_method: {
        // Este campo define débito ou crédito na nova API
        default_type: paymentType
      }
    }
  };

  console.log('[mp-point-create] payload:', JSON.stringify(payload));

  try {
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    console.log('[mp-point-create] MP status:', response.status, '| data:', JSON.stringify(data));

    if (!response.ok) {
      const rawMsg = String(data?.message || data?.error || '').toLowerCase();

      // Já existe uma cobrança ativa no terminal
      if (rawMsg.includes('queued') || rawMsg.includes('pending') || response.status === 409) {
        return res.status(409).json({
          error: 'Já existe uma cobrança pendente na maquininha. Cancele ou aguarde.',
          raw: data
        });
      }

      return res.status(response.status).json({
        error: data?.message || data?.error || 'Mercado Pago recusou a criação da cobrança.',
        raw: data
      });
    }

    return res.status(200).json({
      id:     data?.id     || null,   // ID da Order (ex: "ORD01JS...")
      state:  data?.status || null,   // status da order
      detail: data?.status_detail    || null,
      raw:    data
    });

  } catch (error) {
    console.error('[mp-point-create] erro:', error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao criar cobrança na maquininha.'
    });
  }
}
