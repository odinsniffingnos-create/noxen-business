import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  Filter,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import { BILLING_CONFIG, applyPlanChange, canAccessFeature, getPlanCatalog, getSubscriptionSummary, handleWebhookEvent } from './billing/billingService';
import { getBillingProviderWarning, createCheckoutSession } from './lib/billing';
import { getAuthSession, signIn, signOut, hasFeatureAccess, updateSessionPlan } from './lib/auth';
import { initialData } from './data/seedData';

const API_BASE = 'http://localhost:3001';

const STORAGE_KEY = 'noxen-business-demo';

const uid = () => Math.random().toString(36).slice(2, 10);

const currency = (value, currencyCode = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const getInitialState = () => {
  const baseState = {
    ...initialData,
    subscription: {
      ...initialData.subscription,
    },
    settings: {
      ...initialData.settings,
    },
  };

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...baseState,
        ...parsed,
        settings: {
          ...baseState.settings,
          ...(parsed.settings || {}),
        },
        subscription: {
          ...baseState.subscription,
          ...(parsed.subscription || {}),
        },
      };
    } catch {
      return baseState;
    }
  }
  return baseState;
};

const chartData = [
  { month: 'Jan', revenue: 12000, customers: 35 },
  { month: 'Feb', revenue: 16000, customers: 42 },
  { month: 'Mar', revenue: 14200, customers: 38 },
  { month: 'Apr', revenue: 18400, customers: 58 },
  { month: 'May', revenue: 21400, customers: 67 },
  { month: 'Jun', revenue: 23800, customers: 72 },
  { month: 'Jul', revenue: 26000, customers: 79 },
  { month: 'Aug', revenue: 27400, customers: 95 },
];

const serviceData = [
  { name: 'Consulting', value: 34 },
  { name: 'Marketing', value: 21 },
  { name: 'Maintenance', value: 18 },
  { name: 'Support', value: 15 },
  { name: 'Design', value: 12 },
];

const pieColors = ['#7c6af9', '#39d0ff', '#48d597', '#ffbf69', '#ff7ca3'];

const loadingCards = Array.from({ length: 4 }, (_, index) => index);

const renderEmptyState = ({ title, description, actionText, onAction }) => (
  <div className="empty-state">
    <div className="empty-icon">
      <Search size={20} />
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    {onAction ? (
      <button type="button" className="primary-button" onClick={onAction}>
        {actionText}
      </button>
    ) : null}
  </div>
);

function App() {
  const [state, setState] = useState(getInitialState);
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [authSession, setAuthSession] = useState(getAuthSession());
  const [providerStatus, setProviderStatus] = useState({ provider: 'local-demo', mode: 'demo', enabled: false, message: 'Demo mode' });
  const [loginForm, setLoginForm] = useState({ email: 'owner@noxenbusiness.com', password: 'noxen123' });
  const [billingPeriod, setBillingPeriod] = useState(state.subscription?.billingFrequency || 'monthly');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [taskFilter, setTaskFilter] = useState('All');
  const [marketingInput, setMarketingInput] = useState('Boutique fitness studio');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    totalSpent: 0,
  });
  const [appointmentForm, setAppointmentForm] = useState({
    customer: '',
    date: '',
    time: '',
    service: '',
    price: 0,
    notes: '',
  });
  const [invoiceForm, setInvoiceForm] = useState({
    customer: '',
    issueDate: '',
    dueDate: '',
    items: [{ name: '', price: 0 }],
    notes: '',
  });
  const [taskForm, setTaskForm] = useState({
    title: '',
    dueDate: '',
    priority: 'Medium',
    description: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  useEffect(() => {
    fetch(`${API_BASE}/api/provider`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.provider) {
          setProviderStatus({
            provider: data.provider,
            mode: data.mode || (data.provider === 'stripe' ? 'live' : 'demo'),
            enabled: Boolean(data.enabled),
            message: data.message || 'Demo mode',
          });
        }
      })
      .catch(() => {
        setProviderStatus({ provider: 'local-demo', mode: 'demo', enabled: false, message: 'Demo mode' });
      });
  }, []);

  useEffect(() => {
    if (state.subscription?.billingFrequency) {
      setBillingPeriod(state.subscription.billingFrequency);
    }
  }, [state.subscription?.billingFrequency]);

  useEffect(() => {
    if (!authSession?.user) return;
    const currentPlan = state.subscription?.planId || 'free';
    if (authSession.user.plan !== currentPlan) {
      const updatedSession = updateSessionPlan(currentPlan);
      if (updatedSession) {
        setAuthSession(updatedSession);
      }
    }
  }, [authSession, state.subscription?.planId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const showNotice = (message, tone = 'success') => {
    setNotice({ message, tone });
  };

  const submitConfirm = (title, message, onConfirm) => {
    setConfirmDialog({ title, message, onConfirm });
  };

  const handleSectionSelect = (section) => {
    const premiumGates = {
      Marketing: 'marketing_ai',
      Analytics: 'advanced_analytics',
    };

    const lockedFeature = premiumGates[section];
    if (lockedFeature && !canAccessFeature(state.subscription, lockedFeature)) {
      submitConfirm(
        'Upgrade required',
        'This feature is available on Pro and Scale plans. Upgrade your subscription to unlock premium growth tools.',
        () => {
          setActiveSection('Settings');
          setConfirmDialog(null);
        }
      );
      return;
    }

    setActiveSection(section);
  };

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      business: state.settings,
      subscription: state.subscription,
      customers: state.customers,
      appointments: state.appointments,
      invoices: state.invoices,
      tasks: state.tasks,
    };

    const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `noxen-business-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice('Workspace export downloaded.', 'success');
  };

  const subscriptionSummary = useMemo(() => getSubscriptionSummary(state.subscription), [state.subscription]);

  const planCatalog = useMemo(() => getPlanCatalog(billingPeriod), [billingPeriod]);

  const totals = useMemo(() => {
    const revenue = state.invoices
      .filter((invoice) => invoice.status === 'Paid')
      .reduce((sum, invoice) => sum + invoice.items.reduce((total, item) => total + item.price, 0), 0);

    const outstanding = state.invoices
      .filter((invoice) => invoice.status === 'Unpaid')
      .reduce((sum, invoice) => sum + invoice.items.reduce((total, item) => total + item.price, 0), 0);

    const upcomingAppointments = state.appointments.filter((appointment) => !appointment.completed).length;
    const completedTasks = state.tasks.filter((task) => task.completed).length;

    return {
      revenue,
      customerCount: state.customers.length,
      outstanding,
      upcomingAppointments,
      completedTasks,
    };
  }, [state]);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return state.customers.filter((customer) => {
      const matchesSearch = !q || customer.name.toLowerCase().includes(q) || customer.email.toLowerCase().includes(q) || customer.phone.toLowerCase().includes(q);
      const matchesFilter = customerFilter === 'All' || customer.totalSpent >= (customerFilter === 'High' ? 3000 : 0);
      return matchesSearch && matchesFilter;
    });
  }, [state.customers, search, customerFilter]);

  const filteredAppointments = useMemo(() => {
    const q = search.toLowerCase().trim();
    return state.appointments.filter((appointment) => {
      const matchesSearch = !q || appointment.customer.toLowerCase().includes(q) || appointment.service.toLowerCase().includes(q) || appointment.date.includes(q);
      return matchesSearch;
    });
  }, [state.appointments, search]);

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((task) => {
      const matchesSearch = !search || task.title.toLowerCase().includes(search.toLowerCase()) || task.description.toLowerCase().includes(search.toLowerCase());
      if (taskFilter === 'Active') return matchesSearch && !task.completed;
      if (taskFilter === 'Completed') return matchesSearch && task.completed;
      if (taskFilter === 'High priority') return matchesSearch && task.priority === 'High';
      return matchesSearch;
    });
  }, [state.tasks, taskFilter, search]);

  const invoiceStats = useMemo(() => {
    const paid = state.invoices.filter((invoice) => invoice.status === 'Paid').length;
    const unpaid = state.invoices.filter((invoice) => invoice.status === 'Unpaid').length;
    return { paid, unpaid };
  }, [state.invoices]);

  const addCustomer = (customer) => {
    if (!customer.name?.trim() || !customer.email?.trim()) {
      showNotice('Customer name and email are required.', 'error');
      return false;
    }

    setState((prev) => ({
      ...prev,
      customers: [
        {
          id: uid(),
          dateAdded: new Date().toISOString().slice(0, 10),
          totalSpent: 0,
          ...customer,
          name: customer.name.trim(),
          email: customer.email.trim(),
        },
        ...prev.customers,
      ],
    }));

    showNotice('Customer added successfully.', 'success');
    return true;
  };

  const deleteCustomer = (id) => {
    submitConfirm(
      'Delete customer',
      'This customer record and related history will be removed from the workspace.',
      () => {
        setState((prev) => ({
          ...prev,
          customers: prev.customers.filter((customer) => customer.id !== id),
        }));
        showNotice('Customer deleted.', 'success');
        setConfirmDialog(null);
      }
    );
  };

  const addAppointment = (appointment) => {
    if (!appointment.customer?.trim() || !appointment.date || !appointment.service?.trim()) {
      showNotice('Customer, date, and service are required to add an appointment.', 'error');
      return false;
    }

    setState((prev) => ({
      ...prev,
      appointments: [
        {
          id: uid(),
          completed: false,
          ...appointment,
          customer: appointment.customer.trim(),
          service: appointment.service.trim(),
        },
        ...prev.appointments,
      ],
    }));

    showNotice('Appointment scheduled.', 'success');
    return true;
  };

  const updateAppointment = (id, next) => {
    setState((prev) => ({
      ...prev,
      appointments: prev.appointments.map((appointment) => (appointment.id === id ? { ...appointment, ...next } : appointment)),
    }));
  };

  const deleteAppointment = (id) => {
    submitConfirm(
      'Delete appointment',
      'This appointment will be removed from the schedule.',
      () => {
        setState((prev) => ({
          ...prev,
          appointments: prev.appointments.filter((appointment) => appointment.id !== id),
        }));
        showNotice('Appointment deleted.', 'success');
        setConfirmDialog(null);
      }
    );
  };

  const addInvoice = (invoice) => {
    if (!invoice.customer?.trim() || !invoice.dueDate || !invoice.items?.length) {
      showNotice('Invoice needs a customer, due date, and at least one service item.', 'error');
      return false;
    }

    setState((prev) => ({
      ...prev,
      invoices: [{ id: uid(), status: 'Unpaid', ...invoice, customer: invoice.customer.trim() }, ...prev.invoices],
    }));

    showNotice('Invoice created successfully.', 'success');
    return true;
  };

  const toggleInvoiceStatus = (id) => {
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((invoice) =>
        invoice.id === id ? { ...invoice, status: invoice.status === 'Paid' ? 'Unpaid' : 'Paid' } : invoice
      ),
    }));
  };

  const deleteInvoice = (id) => {
    submitConfirm(
      'Delete invoice',
      'This invoice will be permanently removed from the billing list.',
      () => {
        setState((prev) => ({
          ...prev,
          invoices: prev.invoices.filter((invoice) => invoice.id !== id),
        }));
        showNotice('Invoice deleted.', 'success');
        setConfirmDialog(null);
      }
    );
  };

  const addTask = (task) => {
    if (!task.title?.trim() || !task.description?.trim()) {
      showNotice('Task title and description are required.', 'error');
      return false;
    }

    setState((prev) => ({
      ...prev,
      tasks: [{ id: uid(), completed: false, ...task, title: task.title.trim() }, ...prev.tasks],
    }));

    showNotice('Task created successfully.', 'success');
    return true;
  };

  const toggleTask = (id) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)),
    }));
  };

  const deleteTask = (id) => {
    submitConfirm(
      'Delete task',
      'This task will be removed from the backlog.',
      () => {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((task) => task.id !== id),
        }));
        showNotice('Task deleted.', 'success');
        setConfirmDialog(null);
      }
    );
  };

  const updateSettings = (key, value) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  const updateSubscription = (nextSubscription) => {
    setState((prev) => ({
      ...prev,
      subscription: nextSubscription,
    }));
  };

  const handlePlanChange = async (planId) => {
    const email = authSession?.user?.email || state.settings.businessEmail || 'owner@noxenbusiness.com';

    try {
      const response = await fetch(`${API_BASE}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingFrequency: billingPeriod,
          customerEmail: email,
        }),
      });

      const checkout = await response.json();
      if (!response.ok || !checkout.ok) {
        throw new Error(checkout.message || `Checkout failed (${response.status || 'unknown'}).`);
      }

      const next = applyPlanChange(state.subscription, checkout.planId || planId, checkout.billingFrequency || billingPeriod);
      updateSubscription(next);

      if (authSession?.user) {
        const updatedSession = updateSessionPlan(next.planId);
        if (updatedSession) {
          setAuthSession(updatedSession);
        }
      }

      showNotice(checkout.message || 'Checkout started successfully.', 'success');
      return;
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Checkout failed.';

      const isBackendUnavailable = message.includes('Failed to fetch') || message.includes('fetch') || message.includes('ECONNREFUSED') || message.toLowerCase().includes('backend');

      showNotice(
        isBackendUnavailable
          ? 'Noxen backend is not running on http://localhost:3001. Start the backend and try again.'
          : message,
        'error'
      );
    }
  };

  const handleCancelSubscription = async () => {
    submitConfirm(
      'Cancel subscription',
      'This will pause future renewals and keep your account on a read-only plan until the billing period ends.',
      async () => {
        const email = authSession?.user?.email || state.settings.businessEmail || 'owner@noxenbusiness.com';

        try {
          await fetch(`${API_BASE}/api/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              planId: state.subscription?.planId || 'free',
              billingFrequency: state.subscription?.billingFrequency || 'monthly',
              eventType: 'customer.subscription.deleted',
            }),
          });
        } catch (error) {
          console.error('Webhook sync failed', error);
        }

        const next = handleWebhookEvent(state.subscription, 'customer.subscription.deleted');
        updateSubscription(next);
        showNotice('Subscription cancellation scheduled.', 'success');
        setConfirmDialog(null);
      }
    );
  };

  const marketingIdeas = useMemo(() => {
    const base = `${marketingInput} business`;
    return {
      social: [
        `Create short-form video snippets around ${base}`,
        `Share behind-the-scenes content and team wins for ${base}`,
        `Highlight customer success stories from ${base}`,
      ],
      promotions: [
        `Launch a limited-time “new client” offer for ${base}`,
        `Bundle services into a value-first monthly plan for ${base}`,
        `Introduce a seasonal campaign to re-engage past clients of ${base}`,
      ],
      retention: [
        `Run loyalty check-ins for existing clients of ${base}`,
        `Send personalized “thank you” follow-ups after service delivery`,
        `Create a referral reward for customers who bring in new business`,
      ],
      referrals: [
        `Offer a service credit for every referral to ${base}`,
        `Create a “bring a friend” month for ${base}`,
        `Feature referral shoutouts on social channels`,
      ],
      ads: [
        `Use local search ads around ${base} services`,
        `Promote a lead magnet for ${base} on social pages`,
        `Retarget website visitors with a conversion-focused ad set`,
      ],
    };
  }, [marketingInput]);

  const dashboardRevenue = [
    { name: 'Jan', revenue: 12000 },
    { name: 'Feb', revenue: 16000 },
    { name: 'Mar', revenue: 14800 },
    { name: 'Apr', revenue: 19800 },
    { name: 'May', revenue: 23600 },
    { name: 'Jun', revenue: 29200 },
    { name: 'Jul', revenue: 31800 },
    { name: 'Aug', revenue: 36100 },
  ];

  const customerGrowth = [
    { month: 'Jan', customers: 20 },
    { month: 'Feb', customers: 28 },
    { month: 'Mar', customers: 35 },
    { month: 'Apr', customers: 42 },
    { month: 'May', customers: 48 },
    { month: 'Jun', customers: 55 },
    { month: 'Jul', customers: 62 },
    { month: 'Aug', customers: 71 },
  ];

  const renderLoading = () => (
    <div className="content-section">
      <div className="section-header">
        <div className="skeleton skeleton-line long" />
        <div className="skeleton skeleton-button" />
      </div>
      <div className="stats-grid">
        {loadingCards.map((card) => (
          <div key={card} className="stat-card skeleton-panel">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-block" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="content-section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Business dashboard</h1>
        </div>
        <button className="primary-button" type="button">
          <Plus size={16} />
          New report
        </button>
      </div>

      <div className="stats-grid">
        <StatCard title="Total revenue" value={currency(totals.revenue)} detail="Across all paid invoices" badge="+18.2%" tone="positive" />
        <StatCard title="Monthly revenue" value={currency(18000)} detail="Compared to last month" badge="+8.1%" tone="positive" />
        <StatCard title="Customers" value={String(totals.customerCount)} detail="Active customer base" badge="+9" tone="info" />
        <StatCard title="Appointments" value={String(totals.upcomingAppointments)} detail="Upcoming this month" badge="4 today" tone="warning" />
      </div>

      <div className="dashboard-row">
        <div className="glass-panel chart-panel large-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Performance</div>
              <h3>Revenue overview</h3>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dashboardRevenue}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#7c6af9" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#7c6af9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="#8fa3bf" tickLine={false} axisLine={false} />
                <YAxis stroke="#8fa3bf" tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [currency(value), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#7c6af9" fill="url(#revenueFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel chart-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Forecast</div>
              <h3>Customer growth</h3>
            </div>
          </div>
          <div className="chart-wrap small">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={customerGrowth}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#8fa3bf" tickLine={false} axisLine={false} />
                <YAxis stroke="#8fa3bf" tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`${value} customers`, 'Growth']} />
                <Line type="monotone" dataKey="customers" stroke="#39d0ff" strokeWidth={3} dot={{ fill: '#39d0ff', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-bottom">
        <div className="glass-panel list-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Calendar</div>
              <h3>Upcoming appointments</h3>
            </div>
          </div>
          <div className="stack-list">
            {state.appointments.slice(0, 4).map((appointment) => (
              <div key={appointment.id} className="list-item">
                <div className="item-icon accent"><CalendarClock size={16} /></div>
                <div className="item-copy">
                  <div className="item-title">{appointment.customer}</div>
                  <div className="item-meta">{appointment.date} • {appointment.time}</div>
                </div>
                <span className="tag muted">{appointment.service}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel list-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Finance</div>
              <h3>Outstanding invoices</h3>
            </div>
          </div>
          <div className="stack-list">
            {state.invoices.filter((invoice) => invoice.status === 'Unpaid').slice(0, 4).length ? (
              state.invoices.filter((invoice) => invoice.status === 'Unpaid').slice(0, 4).map((invoice) => (
                <div key={invoice.id} className="list-item">
                  <div className="item-icon warn"><BadgeDollarSign size={16} /></div>
                  <div className="item-copy">
                    <div className="item-title">{invoice.customer}</div>
                    <div className="item-meta">Due {formatDate(invoice.dueDate)}</div>
                  </div>
                  <span className="tag warning">{currency(invoice.items.reduce((sum, item) => sum + item.price, 0))}</span>
                </div>
              ))
            ) : (
              <div className="empty-inline">No outstanding invoices.</div>
            )}
          </div>
        </div>

        <div className="glass-panel list-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Execution</div>
              <h3>Completed tasks</h3>
            </div>
          </div>
          <div className="stack-list">
            {state.tasks.filter((task) => task.completed).slice(0, 4).length ? (
              state.tasks.filter((task) => task.completed).slice(0, 4).map((task) => (
                <div key={task.id} className="list-item">
                  <div className="item-icon success"><Check size={16} /></div>
                  <div className="item-copy">
                    <div className="item-title">{task.title}</div>
                    <div className="item-meta">Completed {task.dueDate}</div>
                  </div>
                  <span className="tag success">Done</span>
                </div>
              ))
            ) : (
              <div className="empty-inline">No completed tasks yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid-extra">
        <div className="glass-panel activity-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Activity</div>
              <h3>Recent activity</h3>
            </div>
          </div>
          <div className="activity-list">
            {state.activity.map((event) => (
              <div key={event.id} className="activity-item">
                <div className="activity-dot" />
                <div>
                  <div className="activity-title">{event.title}</div>
                  <div className="activity-detail">{event.detail}</div>
                </div>
                <span className="activity-time">{event.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel action-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Quick actions</div>
              <h3>Start a task</h3>
            </div>
          </div>
          <div className="quick-actions">
            <button type="button" className="action-button" onClick={() => handleSectionSelect('Customers')}><Users size={16} /> Add Customer</button>
            <button type="button" className="action-button" onClick={() => handleSectionSelect('Invoices')}><BadgeDollarSign size={16} /> Create Invoice</button>
            <button type="button" className="action-button" onClick={() => handleSectionSelect('Appointments')}><CalendarClock size={16} /> Schedule Appointment</button>
            <button type="button" className="action-button" onClick={() => handleSectionSelect('Tasks')}><BriefcaseBusiness size={16} /> Add Task</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => {
    const handleSubmit = (event) => {
      event.preventDefault();
      const didAdd = addCustomer(customerForm);
      if (didAdd) {
        setCustomerForm({ name: '', email: '', phone: '', address: '', notes: '', totalSpent: 0 });
      }
    };

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Customers</div>
            <h1>Customer management</h1>
          </div>
        </div>

        <div className="panel-grid-two">
          <div className="glass-panel form-panel">
            <h3>Add customer</h3>
            <form onSubmit={handleSubmit} className="stack-form">
              <input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder="Name" />
              <input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="Email" />
              <input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="Phone" />
              <input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} placeholder="Address" />
              <textarea value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} placeholder="Notes" rows="4" />
              <input type="number" value={customerForm.totalSpent} onChange={(e) => setCustomerForm({ ...customerForm, totalSpent: Number(e.target.value) })} placeholder="Total amount spent" />
              <button type="submit" className="primary-button">Add customer</button>
            </form>
          </div>

          <div className="glass-panel table-panel">
            <div className="toolbar-row">
              <div className="search-wrap">
                <Search size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" />
              </div>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="High">High spend</option>
              </select>
            </div>

            {filteredCustomers.length ? (
              <div className="customer-list">
                {filteredCustomers.map((customer) => (
                  <div key={customer.id} className="customer-row">
                    <div>
                      <div className="customer-name">{customer.name}</div>
                      <div className="customer-meta">{customer.email}</div>
                    </div>
                    <div className="customer-meta">{customer.phone}</div>
                    <div className="customer-meta">{customer.address}</div>
                    <div className="customer-amount">{currency(customer.totalSpent)}</div>
                    <div className="row-actions">
                      <button type="button" aria-label="Edit customer" className="icon-button"><Pencil size={15} /></button>
                      <button type="button" aria-label="Delete customer" className="icon-button danger" onClick={() => deleteCustomer(customer.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState({
                title: 'No customers found',
                description: 'Try a different search or add a new customer to begin tracking relationships.',
                actionText: 'Add customer',
                onAction: () => setActiveSection('Customers'),
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAppointments = () => {
    const handleSubmit = (event) => {
      event.preventDefault();
      const didAdd = addAppointment(appointmentForm);
      if (didAdd) {
        setAppointmentForm({ customer: '', date: '', time: '', service: '', price: 0, notes: '' });
      }
    };

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Appointments</div>
            <h1>Schedule and manage visits</h1>
          </div>
        </div>

        <div className="panel-grid-two">
          <div className="glass-panel form-panel">
            <h3>Create appointment</h3>
            <form onSubmit={handleSubmit} className="stack-form">
              <input value={appointmentForm.customer} onChange={(e) => setAppointmentForm({ ...appointmentForm, customer: e.target.value })} placeholder="Customer" />
              <input type="date" value={appointmentForm.date} onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })} />
              <input type="time" value={appointmentForm.time} onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })} />
              <input value={appointmentForm.service} onChange={(e) => setAppointmentForm({ ...appointmentForm, service: e.target.value })} placeholder="Service" />
              <input type="number" value={appointmentForm.price} onChange={(e) => setAppointmentForm({ ...appointmentForm, price: Number(e.target.value) })} placeholder="Price" />
              <textarea value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} placeholder="Notes" rows="4" />
              <button type="submit" className="primary-button">Schedule appointment</button>
            </form>
          </div>

          <div className="glass-panel table-panel">
            <div className="toolbar-row">
              <div className="search-wrap">
                <Search size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search appointments" />
              </div>
            </div>

            {filteredAppointments.length ? (
              <div className="appointment-list">
                {filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-header">
                      <div>
                        <div className="customer-name">{appointment.customer}</div>
                        <div className="customer-meta">{appointment.service}</div>
                      </div>
                      <span className={`tag ${appointment.completed ? 'success' : 'muted'}`}>{appointment.completed ? 'Completed' : 'Scheduled'}</span>
                    </div>
                    <div className="appointment-body">
                      <span>{appointment.date}</span>
                      <span>{appointment.time}</span>
                      <span>{currency(appointment.price)}</span>
                    </div>
                    <div className="customer-meta">{appointment.notes}</div>
                    <div className="row-actions end">
                      <button type="button" className="icon-button" onClick={() => updateAppointment(appointment.id, { completed: !appointment.completed })}><Check size={15} /></button>
                      <button type="button" className="icon-button" onClick={() => deleteAppointment(appointment.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState({
                title: 'No appointments found',
                description: 'Search is clear, or you can create a new booking to get the schedule moving.',
                actionText: 'Create appointment',
                onAction: () => setActiveSection('Appointments'),
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInvoices = () => {
    const updateItem = (index, field, value) => {
      setInvoiceForm((prev) => ({
        ...prev,
        items: prev.items.map((item, idx) => (idx === index ? { ...item, [field]: field === 'price' ? Number(value) : value } : item)),
      }));
    };

    const addItem = () => {
      setInvoiceForm((prev) => ({ ...prev, items: [...prev.items, { name: '', price: 0 }] }));
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      const didCreate = addInvoice({
        customer: invoiceForm.customer,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate,
        items: invoiceForm.items.filter((item) => item.name.trim()),
        notes: invoiceForm.notes,
      });

      if (didCreate) {
        setInvoiceForm({ customer: '', issueDate: '', dueDate: '', items: [{ name: '', price: 0 }], notes: '' });
      }
    };

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Invoices</div>
            <h1>Billing and payment tracking</h1>
          </div>
        </div>

        <div className="panel-grid-two aligned">
          <div className="glass-panel form-panel">
            <h3>Create invoice</h3>
            <form onSubmit={handleSubmit} className="stack-form">
              <input value={invoiceForm.customer} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer: e.target.value })} placeholder="Customer" />
              <div className="inline-fields">
                <input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} />
                <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
              </div>

              {invoiceForm.items.map((item, index) => (
                <div key={index} className="invoice-item-row">
                  <input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Service" />
                  <input type="number" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} placeholder="Price" />
                </div>
              ))}

              <button type="button" className="secondary-button" onClick={addItem}>Add service</button>
              <textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} placeholder="Notes" rows="3" />
              <button type="submit" className="primary-button">Generate invoice</button>
            </form>
          </div>

          <div className="glass-panel table-panel">
            <div className="metrics-row">
              <div className="metric-box">
                <div className="mini-label">Paid</div>
                <strong>{invoiceStats.paid}</strong>
              </div>
              <div className="metric-box">
                <div className="mini-label">Unpaid</div>
                <strong>{invoiceStats.unpaid}</strong>
              </div>
              <div className="metric-box">
                <div className="mini-label">Revenue</div>
                <strong>{currency(totals.revenue)}</strong>
              </div>
              <div className="metric-box">
                <div className="mini-label">Outstanding</div>
                <strong>{currency(totals.outstanding)}</strong>
              </div>
            </div>

            {state.invoices.length ? (
              <div className="invoice-list">
                {state.invoices.map((invoice) => (
                  <div key={invoice.id} className="invoice-card">
                    <div className="invoice-topline">
                      <div>
                        <div className="customer-name">{invoice.customer}</div>
                        <div className="customer-meta">Issued {invoice.issueDate}</div>
                      </div>
                      <span className={`tag ${invoice.status === 'Paid' ? 'success' : 'warning'}`}>{invoice.status}</span>
                    </div>
                    <div className="invoice-items">
                      {invoice.items.map((item, idx) => (
                        <div key={idx} className="invoice-item-line">
                          <span>{item.name}</span>
                          <span>{currency(item.price)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="row-actions end">
                      <button type="button" className="secondary-button" onClick={() => toggleInvoiceStatus(invoice.id)}>{invoice.status === 'Paid' ? 'Mark unpaid' : 'Mark paid'}</button>
                      <button type="button" className="icon-button danger" onClick={() => deleteInvoice(invoice.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState({
                title: 'No invoices yet',
                description: 'Create your first invoice to start tracking payment status and collections.',
                actionText: 'Create invoice',
                onAction: () => setActiveSection('Invoices'),
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTasks = () => {
    const handleSubmit = (event) => {
      event.preventDefault();
      const didCreate = addTask(taskForm);
      if (didCreate) {
        setTaskForm({ title: '', dueDate: '', priority: 'Medium', description: '' });
      }
    };

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Tasks</div>
            <h1>Operations and priorities</h1>
          </div>
        </div>

        <div className="panel-grid-two">
          <div className="glass-panel form-panel">
            <h3>Add task</h3>
            <form onSubmit={handleSubmit} className="stack-form">
              <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" />
              <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Description" rows="4" />
              <button type="submit" className="primary-button">Create task</button>
            </form>
          </div>

          <div className="glass-panel table-panel">
            <div className="toolbar-row">
              <div className="search-wrap">
                <Search size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" />
              </div>
              <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="High priority">High priority</option>
              </select>
            </div>

            {filteredTasks.length ? (
              <div className="task-list">
                {filteredTasks.map((task) => (
                  <div key={task.id} className={`task-card ${task.completed ? 'done' : ''}`}>
                    <div className="task-topline">
                      <div>
                        <div className="task-title">{task.title}</div>
                        <div className="customer-meta">Due {task.dueDate}</div>
                      </div>
                      <span className={`tag ${task.priority === 'High' ? 'warning' : task.priority === 'Low' ? 'muted' : 'info'}`}>{task.priority}</span>
                    </div>
                    <div className="customer-meta">{task.description}</div>
                    <div className="row-actions end">
                      <button type="button" className="secondary-button" onClick={() => toggleTask(task.id)}>{task.completed ? 'Reopen' : 'Complete'}</button>
                      <button type="button" className="icon-button danger" onClick={() => deleteTask(task.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState({
                title: 'No tasks match this view',
                description: 'Clear the filters or create a new task to continue planning work.',
                actionText: 'Create task',
                onAction: () => setActiveSection('Tasks'),
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMarketing = () => {
    if (!canAccessFeature(state.subscription, 'marketing_ai')) {
      return (
        <div className="content-section">
          <div className="glass-panel empty-state premium-gate">
            <div className="empty-icon">
              <Sparkles size={20} />
            </div>
            <h3>Pro plan required</h3>
            <p>Unlock AI-powered marketing recommendations and campaign strategy built for growth teams.</p>
            <button type="button" className="primary-button" onClick={() => setActiveSection('Settings')}>Upgrade to Pro</button>
          </div>
        </div>
      );
    }

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Marketing</div>
            <h1>Growth assistant</h1>
          </div>
        </div>

        <div className="glass-panel marketing-panel">
          <div className="marketing-header">
            <div>
              <div className="mini-label">Business type</div>
              <h3>Generate campaign ideas</h3>
            </div>
            <input value={marketingInput} onChange={(e) => setMarketingInput(e.target.value)} placeholder="E.g. coffee shop, law firm, real estate agency" />
          </div>

          <div className="marketing-grid">
            {Object.entries(marketingIdeas).map(([key, items]) => (
              <div key={key} className="idea-card">
                <div className="idea-title">{key.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}</div>
                <ul>
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!canAccessFeature(state.subscription, 'advanced_analytics')) {
      return (
        <div className="content-section">
          <div className="glass-panel empty-state premium-gate">
            <div className="empty-icon">
              <BarChart3 size={20} />
            </div>
            <h3>Advanced analytics unlocked at Pro</h3>
            <p>Upgrade to unlock deeper revenue performance tracking, conversion insights, and reporting dashboards.</p>
            <button type="button" className="primary-button" onClick={() => setActiveSection('Settings')}>Upgrade now</button>
          </div>
        </div>
      );
    }

    return (
      <div className="content-section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Analytics</div>
            <h1>Performance overview</h1>
          </div>
        </div>

        <div className="stats-grid analytics-grid">
          <StatCard title="Revenue trend" value="+$34.8K" detail="Compared to prior quarter" badge="+18.2%" tone="positive" />
          <StatCard title="Customer growth" value="+31%" detail="Net growth this cycle" badge="+8.6%" tone="info" />
          <StatCard title="Appointments" value="184" detail="Booked across all services" badge="+12" tone="warning" />
          <StatCard title="Invoices" value="86%" detail="Paid rate this quarter" badge="Healthy" tone="positive" />
        </div>

        <div className="dashboard-row">
          <div className="glass-panel chart-panel large-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Revenue</div>
                <h3>Revenue over time</h3>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="month" stroke="#8fa3bf" tickLine={false} axisLine={false} />
                  <YAxis stroke="#8fa3bf" tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [currency(value), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#7c6af9" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel chart-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Services</div>
                <h3>Best-performing services</h3>
              </div>
            </div>
            <div className="chart-wrap small">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
                  <Pie data={serviceData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={3}>
                    {serviceData.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-panel map-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Insights</div>
              <h3>Appointment and invoice stats</h3>
            </div>
          </div>
          <div className="chart-wrap large">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[{ name: 'Appointments', value: 54 }, { name: 'Invoices', value: 86 }, { name: 'Revenue', value: 72 }, { name: 'Retention', value: 61 }]}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="#8fa3bf" tickLine={false} axisLine={false} />
                <YAxis stroke="#8fa3bf" tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`${value}%`, 'Performance']} />
                <Bar dataKey="value" fill="#39d0ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const session = signIn({
      email: loginForm.email,
      password: loginForm.password,
      businessName: state.settings.businessName,
      plan: state.subscription?.planId || 'free',
    });

    if (!session) {
      showNotice('Invalid credentials. Try the demo account details.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/subscriptions/${encodeURIComponent(session.user.email.toLowerCase())}`);
      const data = await response.json();
      if (data?.subscription?.planId) {
        const activeSubscription = applyPlanChange(state.subscription, data.subscription.planId, data.subscription.billingFrequency || state.subscription?.billingFrequency || 'monthly');
        updateSubscription(activeSubscription);
        const syncedSession = updateSessionPlan(activeSubscription.planId);
        if (syncedSession) {
          setAuthSession(syncedSession);
        }
      }
    } catch (error) {
      console.error('Failed to sync subscription on login', error);
    }

    setAuthSession(session);
    showNotice(`Signed in as ${session.user.email}.`, 'success');
  };

  const handleLogout = () => {
    signOut();
    setAuthSession(null);
    showNotice('Signed out successfully.', 'success');
  };

  const renderSettings = () => (
    <div className="content-section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Business configuration</h1>
        </div>
      </div>

      <div className="billing-layout">
        <div className="glass-panel form-panel billing-overview">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Billing</div>
              <h3>Subscription overview</h3>
            </div>
            <span className={`tag ${subscriptionSummary.status === 'active' ? 'success' : 'warning'}`}>
              {subscriptionSummary.status}
            </span>
          </div>

          <div className="subscription-summary">
            <div>
              <div className="mini-label">Current plan</div>
              <div className="plan-name">{subscriptionSummary.plan.name}</div>
            </div>
            <div className="billing-amount">{currency(subscriptionSummary.price)}<span>/ {subscriptionSummary.billingFrequency}</span></div>
          </div>

          <div className="billing-meta-grid">
            <div>
              <div className="mini-label">Next billing</div>
              <strong>{formatDate(subscriptionSummary.nextBillingDate)}</strong>
            </div>
            <div>
              <div className="mini-label">Payment method</div>
              <strong>{subscriptionSummary.paymentMethod}</strong>
            </div>
          </div>

          <div className="billing-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveSection('Dashboard')}>Review usage</button>
            <button type="button" className="primary-button" onClick={handleCancelSubscription}>Cancel plan</button>
          </div>
        </div>

        <div className="glass-panel form-panel settings-panel">
          <div className="settings-grid">
            <div className="setting-column">
              <label>
                Business name
                <input value={state.settings.businessName} onChange={(e) => updateSettings('businessName', e.target.value)} />
              </label>
              <label>
                Business email
                <input value={state.settings.businessEmail} onChange={(e) => updateSettings('businessEmail', e.target.value)} />
              </label>
              <label>
                Phone
                <input value={state.settings.phone} onChange={(e) => updateSettings('phone', e.target.value)} />
              </label>
            </div>
            <div className="setting-column">
              <label>
                Business address
                <textarea value={state.settings.address} onChange={(e) => updateSettings('address', e.target.value)} rows="4" />
              </label>
              <label>
                Currency
                <select value={state.settings.currency} onChange={(e) => updateSettings('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label>
                Theme
                <select value={state.settings.theme} onChange={(e) => updateSettings('theme', e.target.value)}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel pricing-panel">
        <div className="panel-header compact">
          <div>
            <div className="eyebrow">Pricing</div>
            <h3>Choose your billing rhythm</h3>
          </div>
          <div className="billing-toggle" role="tablist" aria-label="Billing period selector">
            {BILLING_CONFIG.plans.length > 0 && ['weekly', 'monthly', 'yearly'].map((period) => (
              <button
                key={period}
                type="button"
                className={`toggle-button ${billingPeriod === period ? 'active' : ''}`}
                onClick={() => setBillingPeriod(period)}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="provider-banner">
          <div>
            <div className="mini-label">Payment provider</div>
            <strong>{BILLING_CONFIG.providerLabel}</strong>
          </div>
          <span className="tag info">Provider-safe demo</span>
        </div>

        <div className="security-banner">
          <div>
            <div className="mini-label">Security</div>
            <strong>{getBillingProviderWarning()}</strong>
          </div>
        </div>

        <div className="plan-grid">
          {planCatalog.map((plan) => {
            const isCurrent = state.subscription?.planId === plan.id;
            const savings = plan.yearlySavings > 0 ? `Save ${currency(plan.yearlySavings)} yearly` : 'No annual savings';
            const buttonLabel = isCurrent ? 'Current plan' : `Upgrade to ${plan.name}`;

            return (
              <div key={plan.id} className={`plan-card ${isCurrent ? 'featured' : ''}`}>
                <div className="plan-header">
                  <div>
                    <div className="mini-label">{plan.badge}</div>
                    <h3>{plan.name}</h3>
                  </div>
                  {isCurrent ? <span className="tag success">Current</span> : null}
                </div>

                <div className="plan-price">
                  {currency(plan.price)}
                  <span>/{billingPeriod}</span>
                </div>

                <p>{plan.description}</p>

                <div className="plan-savings">{savings}</div>

                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}><Check size={15} /> {feature}</li>
                  ))}
                </ul>

                <button type="button" className={isCurrent ? 'secondary-button' : 'primary-button'} onClick={() => handlePlanChange(plan.id)}>
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'Dashboard':
        return renderDashboard();
      case 'Customers':
        return renderCustomers();
      case 'Appointments':
        return renderAppointments();
      case 'Invoices':
        return renderInvoices();
      case 'Tasks':
        return renderTasks();
      case 'Marketing':
        return renderMarketing();
      case 'Analytics':
        return renderAnalytics();
      case 'Settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} setActiveSection={handleSectionSelect} currentPlan={subscriptionSummary.plan.name} />
      <main className="main-panel">
        <header className="topbar glass-panel">
          <div className="topbar-copy">
            <div className="eyebrow">Welcome back</div>
            <h2>{state.settings.businessName}</h2>
          </div>

          <div className="topbar-actions">
            <div className={`chip ${providerStatus.mode === 'live' ? 'success' : 'warning'}`}>
              <span className="chip-dot" />
              {providerStatus.mode === 'live' ? 'Live billing enabled' : 'Demo mode'}
            </div>
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspace" />
            </label>
            <div className="chip">
              <span className="chip-dot" />
              {authSession ? 'Signed in' : 'Demo'}
            </div>
            {authSession ? (
              <button type="button" className="secondary-button" onClick={handleLogout}>Sign out</button>
            ) : (
              <button type="button" className="primary-button" onClick={() => setActiveSection('Settings')}>Sign in</button>
            )}
            <button type="button" className="primary-button" onClick={handleExport}>Export</button>
          </div>
        </header>

        {!authSession && !loading ? (
          <div className="auth-panel glass-panel">
            <div className="panel-header compact">
              <div>
                <div className="eyebrow">Access</div>
                <h3>Business owner sign in</h3>
              </div>
            </div>

            <form onSubmit={handleLogin} className="stack-form auth-form">
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="owner@noxenbusiness.com"
              />
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="Password"
              />
              <div className="demo-credentials">
                Demo access: owner@noxenbusiness.com / noxen123
              </div>
              <button type="submit" className="primary-button">Sign in to Noxen</button>
            </form>
          </div>
        ) : null}

        {loading ? renderLoading() : renderSection()}

        {notice ? (
          <div className={`toast toast-${notice.tone}`} role="status" aria-live="polite">
            {notice.tone === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{notice.message}</span>
          </div>
        ) : null}

        {confirmDialog ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card glass-panel">
              <div className="modal-header">
                <div>
                  <div className="eyebrow">Confirm action</div>
                  <h3>{confirmDialog.title}</h3>
                </div>
                <button type="button" className="icon-button" onClick={() => setConfirmDialog(null)} aria-label="Close dialog">
                  <X size={15} />
                </button>
              </div>
              <p>{confirmDialog.message}</p>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </button>
                <button type="button" className="primary-button" onClick={confirmDialog.onConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
