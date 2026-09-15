export const BILLING_PERIODS = ['weekly', 'monthly', 'yearly'];

export const BILLING_CONFIG = {
  provider: 'stripe-ready',
  providerLabel: 'Stripe-ready demo (no live payments connected)',
  currency: 'USD',
  plans: [
    {
      id: 'free',
      name: 'Free',
      description: 'Basic business tools and essentials',
      priceByBilling: { weekly: 0, monthly: 0, yearly: 0 },
      features: [
        'Basic dashboard access',
        'Up to 3 customers',
        'Core scheduling tools',
        'Limited task management',
      ],
      badge: 'Starter',
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For fast-growing businesses and premium workflows',
      priceByBilling: { weekly: 19, monthly: 49, yearly: 468 },
      features: [
        'Everything in Free',
        'Advanced analytics and reporting',
        'Unlimited customers and invoicing',
        'AI marketing recommendations',
        'Priority support',
      ],
      badge: 'Most popular',
    },
    {
      id: 'scale',
      name: 'Scale',
      description: 'For multi-service teams and expansion',
      priceByBilling: { weekly: 39, monthly: 99, yearly: 948 },
      features: [
        'Everything in Pro',
        'Advanced automations',
        'Team collaboration views',
        'Custom business workflows',
        'Dedicated onboarding guidance',
      ],
      badge: 'Best value',
    },
  ],
};

export const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'customer.subscription.renewed',
];

export const getPlanById = (planId = 'free') => {
  const found = BILLING_CONFIG.plans.find((plan) => plan.id === planId);
  return found || BILLING_CONFIG.plans[0];
};

export const getPlanCatalog = (billingPeriod = 'monthly') =>
  BILLING_CONFIG.plans.map((plan) => {
    const price = plan.priceByBilling[billingPeriod] ?? 0;
    const yearlyPrice = plan.priceByBilling.yearly ?? 0;
    const monthlyEquivalent = plan.priceByBilling.monthly ?? 0;
    const yearlySavings = Math.max(0, monthlyEquivalent * 12 - yearlyPrice);

    return {
      ...plan,
      price,
      yearlySavings,
      billingPeriod,
    };
  });

export const calculateYearlySavings = (plan) => {
  const monthlyEquivalent = plan.priceByBilling.monthly ?? 0;
  const yearlyPrice = plan.priceByBilling.yearly ?? 0;
  return Math.max(0, monthlyEquivalent * 12 - yearlyPrice);
};

export const getNextBillingDate = (billingFrequency = 'monthly', referenceDate = new Date()) => {
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

export const canAccessFeature = (subscription, featureKey) => {
  const planId = subscription?.planId || 'free';
  const plan = getPlanById(planId);
  const premiumFeatures = ['advanced_analytics', 'marketing_ai', 'automation', 'team_workflows'];

  if (premiumFeatures.includes(featureKey)) {
    return plan.id === 'pro' || plan.id === 'scale';
  }

  return true;
};

export const getSubscriptionSummary = (subscription = {}) => {
  const plan = getPlanById(subscription.planId || 'free');
  const billingFrequency = subscription.billingFrequency || 'monthly';
  const price = plan.priceByBilling[billingFrequency] ?? 0;

  return {
    plan,
    billingFrequency,
    price,
    status: subscription.status || 'active',
    nextBillingDate: subscription.nextBillingDate || getNextBillingDate(billingFrequency),
    paymentMethod: subscription.paymentMethod || 'Stripe-ready test • Visa •••• 4242',
    cancellationDate: subscription.cancellationDate || null,
  };
};

export const applyPlanChange = (subscription = {}, planId, billingFrequency = 'monthly') => {
  const normalizedPlanId = planId || subscription.planId || 'free';
  const normalizedFrequency = BILLING_PERIODS.includes(billingFrequency) ? billingFrequency : 'monthly';
  const nextStatus = normalizedPlanId === 'free' ? 'active' : subscription.status || 'active';

  return {
    ...subscription,
    planId: normalizedPlanId,
    billingFrequency: normalizedFrequency,
    status: nextStatus,
    nextBillingDate: getNextBillingDate(normalizedFrequency),
    paymentMethod: subscription.paymentMethod || 'Stripe-ready test • Visa •••• 4242',
    autoRenew: true,
    cancellationDate: null,
  };
};

export const handleWebhookEvent = (subscription, eventType) => {
  if (!subscription) return subscription;

  const updates = {
    'customer.subscription.created': { status: 'active' },
    'invoice.paid': { status: 'active' },
    'invoice.payment_failed': { status: 'past_due' },
    'customer.subscription.deleted': { status: 'cancelled', autoRenew: false, cancellationDate: new Date().toISOString().slice(0, 10) },
    'customer.subscription.updated': { status: 'active' },
    'customer.subscription.renewed': { status: 'active', nextBillingDate: getNextBillingDate(subscription.billingFrequency || 'monthly') },
  };

  return {
    ...subscription,
    ...(updates[eventType] || {}),
  };
};
