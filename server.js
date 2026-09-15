import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';

export const app = express();
const port = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'subscriptions.json');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:4173';
const providerState = () => ({
  enabled: Boolean(stripe),
  provider: stripe ? 'stripe' : 'local-demo',
  mode: stripe ? 'live' : 'demo',
  message: stripe ? 'Stripe checkout is configured.' : 'Demo checkout is active. Connect a valid Stripe key for live billing.',
});

const plans = {
  free: {
    id: 'free',
    name: 'Free',
    priceByBilling: { weekly: 0, monthly: 0, yearly: 0 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceByBilling: { weekly: 19, monthly: 49, yearly: 468 },
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    priceByBilling: { weekly: 39, monthly: 99, yearly: 948 },
  },
};

const normalizePlanId = (planId = 'free') => {
  if (planId === 'pro' || planId === 'scale') return planId;
  return 'free';
};

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
};

const readSubscriptions = () => {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const writeSubscriptions = (data) => {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

const addBillingCycle = (billingFrequency = 'monthly', referenceDate = new Date()) => {
  const next = new Date(referenceDate);

  if (billingFrequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (billingFrequency === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString().slice(0, 10);
};

const serializeSubscription = ({ email, planId, billingFrequency, amount }) => {
  const normalizedPlanId = normalizePlanId(planId);
  const normalizedFrequency = ['weekly', 'monthly', 'yearly'].includes(billingFrequency) ? billingFrequency : 'monthly';

  return {
    email,
    planId: normalizedPlanId,
    billingFrequency: normalizedFrequency,
    status: 'active',
    amount,
    nextBillingDate: addBillingCycle(normalizedFrequency),
    paymentMethod: 'Local demo checkout • Visa •••• 4242',
    autoRenew: true,
    cancellationDate: null,
    provider: 'local-demo',
    paymentStatus: 'paid',
    updatedAt: new Date().toISOString(),
  };
};

app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Noxen subscription service is running' });
});

app.get('/api/plans', (_req, res) => {
  res.json({
    ok: true,
    plans: Object.values(plans).map((plan) => ({
      ...plan,
      priceByBilling: { ...plan.priceByBilling },
    })),
  });
});

app.get('/api/subscriptions/:email', (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const subscriptions = readSubscriptions();
  const subscription = subscriptions[email];

  if (!subscription) {
    return res.json({
      ok: true,
      exists: false,
      subscription: {
        planId: 'free',
        billingFrequency: 'monthly',
        status: 'active',
      },
    });
  }

  return res.json({ ok: true, exists: true, subscription });
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ ok: false, message: 'Stripe is not configured on this server. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET first.' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ ok: false, message: 'Missing Stripe signature header.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook verification failed:', error.message);
    return res.status(400).json({ ok: false, message: `Webhook verification failed: ${error.message}` });
  }

  try {
    const eventType = event.type;
    const object = event.data.object || {};
    const customerEmail = object.customer_details?.email || object.customer_email || object.metadata?.customerEmail || '';
    const metadata = object.metadata || {};
    const planId = metadata.planId || 'free';
    const billingFrequency = metadata.billingFrequency || 'monthly';

    if (eventType === 'checkout.session.completed') {
      if (!customerEmail) {
        return res.status(200).json({ ok: true, received: true, type: eventType, note: 'No email in checkout session metadata.' });
      }

      const subscriptions = readSubscriptions();
      subscriptions[customerEmail.toLowerCase()] = {
        email: customerEmail.toLowerCase(),
        planId: normalizePlanId(planId),
        billingFrequency: ['weekly', 'monthly', 'yearly'].includes(billingFrequency) ? billingFrequency : 'monthly',
        status: 'active',
        amount: object.amount_total ? object.amount_total / 100 : 0,
        nextBillingDate: addBillingCycle(billingFrequency),
        paymentMethod: 'Stripe Checkout',
        autoRenew: true,
        cancellationDate: null,
        provider: 'stripe',
        paymentStatus: 'paid',
        updatedAt: new Date().toISOString(),
      };
      writeSubscriptions(subscriptions);
    }

    if (eventType === 'invoice.payment_failed') {
      const email = object.customer_email || object.customer?.email || '';
      if (email) {
        const subscriptions = readSubscriptions();
        const current = subscriptions[email.toLowerCase()] || {};
        subscriptions[email.toLowerCase()] = {
          ...current,
          email: email.toLowerCase(),
          status: 'past_due',
          provider: 'stripe',
          paymentStatus: 'failed',
          updatedAt: new Date().toISOString(),
        };
        writeSubscriptions(subscriptions);
      }
    }

    if (eventType === 'customer.subscription.deleted') {
      const email = object.customer_email || object.metadata?.customerEmail || '';
      if (email) {
        const subscriptions = readSubscriptions();
        const current = subscriptions[email.toLowerCase()] || {};
        subscriptions[email.toLowerCase()] = {
          ...current,
          email: email.toLowerCase(),
          status: 'cancelled',
          provider: 'stripe',
          paymentStatus: 'cancelled',
          updatedAt: new Date().toISOString(),
        };
        writeSubscriptions(subscriptions);
      }
    }

    return res.json({ ok: true, received: true, type: eventType });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return res.status(500).json({ ok: false, message: 'Webhook processing failed.' });
  }
});

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  return app._router.handle(req, res);
});

app.use(express.json());

app.get('/api/provider', (_req, res) => {
  res.json({
    ok: true,
    ...providerState(),
  });
});

const createCheckoutSessionHandler = async (req, res) => {
  const { planId, billingFrequency = 'monthly', customerEmail = '' } = req.body || {};
  const email = String(customerEmail).trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ ok: false, message: 'Customer email is required.' });
  }

  const normalizedPlanId = normalizePlanId(planId);
  const selectedPlan = plans[normalizedPlanId] || plans.free;
  const amount = selectedPlan.priceByBilling[billingFrequency] ?? selectedPlan.priceByBilling.monthly ?? 0;

  if (!stripe) {
    return res.status(503).json({
      ok: false,
      mode: 'not-configured',
      provider: 'not-configured',
      message: 'Stripe is not configured on this backend. Add a valid STRIPE_SECRET_KEY before creating a live checkout session.',
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(amount) * 100),
            recurring: {
              interval: billingFrequency === 'weekly' ? 'week' : billingFrequency === 'yearly' ? 'year' : 'month',
            },
            product_data: {
              name: `${selectedPlan.name} plan`,
              description: `${selectedPlan.name} subscription for ${email}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        customerEmail: email,
        planId: normalizedPlanId,
        billingFrequency,
      },
      success_url: `${clientUrl}/?checkout=success`,
      cancel_url: `${clientUrl}/?checkout=cancelled`,
    });

    const subscriptions = readSubscriptions();
    subscriptions[email] = {
      email,
      planId: normalizedPlanId,
      billingFrequency,
      status: 'active',
      amount,
      nextBillingDate: addBillingCycle(billingFrequency),
      paymentMethod: 'Stripe Checkout',
      autoRenew: true,
      cancellationDate: null,
      provider: 'stripe',
      paymentStatus: 'paid',
      updatedAt: new Date().toISOString(),
    };
    writeSubscriptions(subscriptions);

    return res.json({
      ok: true,
      mode: 'live',
      provider: 'stripe',
      planId: normalizedPlanId,
      billingFrequency,
      customerEmail: email,
      amount,
      status: 'paid',
      checkoutUrl: session.url,
      sessionId: session.id,
      message: `Stripe checkout created successfully for ${selectedPlan.name}.`,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ ok: false, message: 'Stripe checkout failed. Please verify your Stripe keys and configuration.' });
  }
};

app.post('/api/stripe/checkout', createCheckoutSessionHandler);
app.post('/api/checkout', createCheckoutSessionHandler);

export const startServer = (currentPort = port) => {
  return app.listen(currentPort, () => {
    console.log(`Noxen subscription backend running on http://localhost:${currentPort}`);
  });
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer(port);
}
