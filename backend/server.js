import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config({ path: '../.env' });

const app = express();
const port = Number(process.env.PORT || 3001);
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Noxen Business backend',
    status: 'online',
    message: 'Noxen backend is online.'
  });
});

app.post('/api/stripe/checkout', async (req, res) => {
  const { planId = 'pro', billingFrequency = 'monthly', customerEmail = '' } = req.body || {};

  if (!customerEmail) {
    return res.status(400).json({
      ok: false,
      message: 'customerEmail is required.'
    });
  }

  if (!stripe) {
    return res.status(400).json({
      ok: false,
      mode: 'not-configured',
      message: 'Stripe is not configured on the server. Add STRIPE_SECRET_KEY to your backend environment.'
    });
  }

  const priceMap = {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 4900, yearly: 46800 },
    scale: { monthly: 9900, yearly: 94800 }
  };

  const unitAmount = priceMap[planId]?.[billingFrequency] ?? priceMap.pro.monthly;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          recurring: {
            interval: billingFrequency === 'yearly' ? 'year' : 'month'
          },
          product_data: {
            name: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
            description: `Noxen ${planId} plan (${billingFrequency})`
          }
        },
        quantity: 1
      }],
      metadata: {
        planId,
        billingFrequency,
        customerEmail
      },
      success_url: 'http://localhost:4173/?checkout=success',
      cancel_url: 'http://localhost:4173/?checkout=cancelled'
    });

    return res.json({
      ok: true,
      mode: 'live',
      checkoutUrl: session.url,
      sessionId: session.id,
      planId,
      billingFrequency,
      customerEmail,
      message: 'Stripe checkout session created successfully.'
    });
  } catch (error) {
    console.error('Stripe checkout creation failed:', error);
    return res.status(500).json({
      ok: false,
      message: 'Stripe checkout failed. Check your Stripe secret key and account configuration.'
    });
  }
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const rawBody = req.body ? req.body.toString() : '';

  if (!secret) {
    return res.status(500).json({
      ok: false,
      message: 'STRIPE_WEBHOOK_SECRET is not configured on the server.'
    });
  }

  if (!signature) {
    return res.status(400).json({
      ok: false,
      message: 'Missing Stripe signature header.'
    });
  }

  return res.status(200).json({
    ok: true,
    received: true,
    message: 'Stripe webhook placeholder is active. Add real Stripe verification here.',
    payloadPreview: rawBody.slice(0, 200)
  });
});

app.listen(port, () => {
  console.log(`Noxen backend is running on http://localhost:${port}`);
});
