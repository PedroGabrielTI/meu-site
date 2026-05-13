import { randomUUID } from 'crypto';

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

    const vendaId = req.body?.venda_id || req.body?.external_reference || '';
    const description = String(req.body?.description || 'Venda Mercado Penharol').slice(0, 120);

    // payment_method_id enviado pelo frontend: 'debit_card' ou 'credit_card'
    const paymentMethodId = req.body?.payment_method_id;
    const defaultType = paymentMethodId === 'debit_card' ? 'debit_card'
                      : paymentMethodId === 'credit_card' ? 'credit_card'
                      : 'credit_card';

    // Nova Orders API — suporta débito e crédito corretamente
    const payload = {
      type: 'point',
      external_reference: String(vendaId).slice(0, 64),
      expiration_time: 'PT10M',
      transactions: {
        payments: [
          {
            amount: amountNumber.toFixed(2)
          }
        ]
      },
      config: {
        point: {
          terminal_id: deviceId,
          print_on_terminal: 'full_ticket'
        },
        payment_method: {
          default_type: defaultType,
          default_installments: '1',
          installments_cost: 'seller'
        }
      },
      description
    };

    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[mp-point-create-v2] erro MP:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Mercado Pago recusou a criação da ordem.',
        raw: data
      });
    }

    console.log('[mp-point-create-v2] ordem criada id=', data?.id, 'payment=', data?.transactions?.payments?.[0]?.id);

    return res.status(200).json({
      id: data?.id || null,                                          // order id
      payment_id: data?.transactions?.payments?.[0]?.id || null,    // payment id para status
      state: data?.status || null,
      detail: data?.status_detail || null,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erro interno ao criar ordem na maquininha.'
    });
  }
}
