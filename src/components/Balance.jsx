import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  UtensilsCrossed,
  Car,
  Euro,
  PiggyBank
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval, subMonths, eachMonthOfInterval } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { budgetApi } from '../lib/supabase';
import './Balance.css';

// Generate test data
const generateTestData = () => {
  const testTransactions = [];
  
  // Generate data for 2025 and 2026
  const years = [2025, 2026];
  
  years.forEach(year => {
    // Generate salary (2950 EUR) on 25th of each month
    for (let month = 0; month < 12; month++) {
      const salaryDate = new Date(year, month, 25);
      testTransactions.push({
        id: `salary-${year}-${month}`,
        type: 'income',
        amount: 2950,
        category: 'Salary',
        description: 'Monthly salary',
        date: format(salaryDate, 'yyyy-MM-dd'),
        created_at: salaryDate.toISOString(),
      });
    }
    
    // Generate rent/living (865 EUR) on 1st of each month
    for (let month = 0; month < 12; month++) {
      const rentDate = new Date(year, month, 1);
      testTransactions.push({
        id: `rent-${year}-${month}`,
        type: 'expense',
        amount: 865,
        category: 'Rent',
        description: 'Monthly rent',
        date: format(rentDate, 'yyyy-MM-dd'),
        created_at: rentDate.toISOString(),
      });
    }
    
    // Generate fuel (80 EUR) each month - random day between 5-15
    for (let month = 0; month < 12; month++) {
      const fuelDay = 5 + Math.floor(Math.random() * 11); // Random day between 5-15
      const fuelDate = new Date(year, month, fuelDay);
      testTransactions.push({
        id: `fuel-${year}-${month}`,
        type: 'expense',
        amount: 80,
        category: 'Gas',
        description: 'Fuel expense',
        date: format(fuelDate, 'yyyy-MM-dd'),
        created_at: fuelDate.toISOString(),
      });
    }
    
    // Generate food (500 EUR) each month - split into multiple transactions
    // Split into groceries (400 EUR) and restaurant (100 EUR) for variety
    for (let month = 0; month < 12; month++) {
      // Groceries on 3rd of month
      const groceriesDate = new Date(year, month, 3);
      testTransactions.push({
        id: `groceries-${year}-${month}`,
        type: 'expense',
        amount: 400,
        category: 'Groceries',
        description: 'Monthly groceries',
        date: format(groceriesDate, 'yyyy-MM-dd'),
        created_at: groceriesDate.toISOString(),
      });
      
      // Restaurant on 15th of month
      const restaurantDate = new Date(year, month, 15);
      testTransactions.push({
        id: `restaurant-${year}-${month}`,
        type: 'expense',
        amount: 100,
        category: 'Restaurant',
        description: 'Restaurant expenses',
        date: format(restaurantDate, 'yyyy-MM-dd'),
        created_at: restaurantDate.toISOString(),
      });
    }
    
    // Generate additional occasional expenses
    const additionalExpenses = [
      { name: 'Utilities', amount: 120, day: 2 },
      { name: 'Internet', amount: 45, day: 2 },
      { name: 'Phone', amount: 25, day: 2 },
    ];
    
    additionalExpenses.forEach(expense => {
      for (let month = 0; month < 12; month++) {
        const expenseDate = new Date(year, month, expense.day);
        testTransactions.push({
          id: `${expense.name.toLowerCase()}-${year}-${month}`,
          type: 'expense',
          amount: expense.amount,
          category: expense.name,
          description: `${expense.name} bill`,
          date: format(expenseDate, 'yyyy-MM-dd'),
          created_at: expenseDate.toISOString(),
        });
      }
    });
    
    // Generate occasional shopping and entertainment expenses (every other month)
    for (let month = 0; month < 12; month += 2) {
      const shoppingDate = new Date(year, month, 10);
      testTransactions.push({
        id: `shopping-${year}-${month}`,
        type: 'expense',
        amount: 150 + Math.floor(Math.random() * 100), // 150-250 EUR
        category: 'Shopping',
        description: 'Shopping expense',
        date: format(shoppingDate, 'yyyy-MM-dd'),
        created_at: shoppingDate.toISOString(),
      });
    }
    
    for (let month = 1; month < 12; month += 2) {
      const entertainmentDate = new Date(year, month, 20);
      testTransactions.push({
        id: `entertainment-${year}-${month}`,
        type: 'expense',
        amount: 60 + Math.floor(Math.random() * 40), // 60-100 EUR
        category: 'Entertainment',
        description: 'Entertainment expense',
        date: format(entertainmentDate, 'yyyy-MM-dd'),
        created_at: entertainmentDate.toISOString(),
      });
    }
  });
  
  // Add savings transactions - 10k EUR total
  // Add initial savings deposit at start of 2025
  const initialSavingsDate = new Date(2025, 0, 1);
  testTransactions.push({
    id: 'savings-initial-2025',
    type: 'income',
    amount: 10000,
    category: 'Savings',
    description: 'Initial savings deposit',
    date: format(initialSavingsDate, 'yyyy-MM-dd'),
    created_at: initialSavingsDate.toISOString(),
  });
  
  // Add monthly savings contributions (surplus from income - expenses)
  // Average monthly surplus is approximately 2950 - (865 + 80 + 500 + 120 + 45 + 25) = ~1315 EUR
  // Add savings contributions on 28th of each month for 2025 and 2026
  years.forEach(year => {
    for (let month = 0; month < 12; month++) {
      const savingsDate = new Date(year, month, 28);
      const savingsAmount = 1200 + Math.floor(Math.random() * 300); // 1200-1500 EUR per month
      testTransactions.push({
        id: `savings-${year}-${month}`,
        type: 'income',
        amount: savingsAmount,
        category: 'Savings',
        description: 'Monthly savings contribution',
        date: format(savingsDate, 'yyyy-MM-dd'),
        created_at: savingsDate.toISOString(),
      });
    }
  });
  
  return testTransactions;
};

const Balance = ({ initialBalance = 0 }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [periodView, setPeriodView] = useState('month');
  const [categories, setCategories] = useState([]);
  const [useTestData, setUseTestData] = useState(true); // Toggle for test data

  // Form state
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  // Load transactions
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      if (useTestData) {
        // Use test data instead of database
        const testData = generateTestData();
        setTransactions(testData);
        const uniqueCategories = [...new Set(testData.map(t => t.category))];
        setCategories(uniqueCategories.sort());
      } else {
        const { data, error } = await budgetApi.getAll();
        if (error) {
          console.error('Error loading transactions:', error);
        } else {
          setTransactions(data || []);
          const uniqueCategories = [...new Set((data || []).map(t => t.category))];
          setCategories(uniqueCategories.sort());
        }
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [useTestData]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (periodView === 'month') {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      filtered = filtered.filter(t => {
        const transactionDate = parseISO(t.date);
        return isWithinInterval(transactionDate, { start, end });
      });
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date + 'T' + (a.created_at || '00:00:00'));
      const dateB = new Date(b.date + 'T' + (b.created_at || '00:00:00'));
      return dateB - dateA;
    });
  }, [transactions, periodView]);

  // Calculate net for a given period
  const calculateNetForPeriod = useCallback((transactionsList, startDate, endDate) => {
    const periodTransactions = transactionsList.filter(t => {
      const transactionDate = parseISO(t.date);
      return isWithinInterval(transactionDate, { start: startDate, end: endDate });
    });

    const income = periodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    const expenses = periodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    return income - expenses;
  }, []);

  // Calculate summaries for current period
  const summaries = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    const net = income - expenses;
    const currentBalance = initialBalance + net;

    return {
      income,
      expenses,
      net,
      currentBalance,
    };
  }, [filteredTransactions, initialBalance]);

  // Calculate yearly increase
  const yearlyIncrease = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentYearStart = startOfYear(new Date(currentYear, 0, 1));
    const currentYearEnd = endOfYear(new Date(currentYear, 11, 31));
    
    const previousYearStart = startOfYear(new Date(currentYear - 1, 0, 1));
    const previousYearEnd = endOfYear(new Date(currentYear - 1, 11, 31));

    const currentYearNet = calculateNetForPeriod(transactions, currentYearStart, currentYearEnd);
    const previousYearNet = calculateNetForPeriod(transactions, previousYearStart, previousYearEnd);

    const increase = currentYearNet - previousYearNet;
    const increasePercent = previousYearNet !== 0 
      ? ((increase / Math.abs(previousYearNet)) * 100) 
      : (currentYearNet !== 0 ? 100 : 0);

    return {
      amount: increase,
      percent: increasePercent,
      currentYearNet,
      previousYearNet,
    };
  }, [transactions, calculateNetForPeriod]);

  // Category mapping for major categories
  const categoryMapping = {
    'Home/Living': ['home', 'living', 'rent', 'utilities', 'housing', 'mortgage', 'electric', 'water', 'internet', 'phone'],
    'Food': ['food', 'groceries', 'restaurant', 'dining', 'eat', 'grocery', 'supermarket', 'cafe', 'coffee'],
    'Car': ['car', 'vehicle', 'gas', 'fuel', 'auto', 'transportation', 'maintenance', 'insurance', 'parking'],
    'Shopping': ['shopping', 'clothes', 'electronics', 'retail'],
    'Entertainment': ['entertainment', 'movies', 'games', 'hobbies', 'sports'],
  };

  // Check if a category matches a major category
  const matchesCategory = useCallback((transactionCategory, majorCategory) => {
    const keywords = categoryMapping[majorCategory];
    const categoryLower = (transactionCategory || '').toLowerCase();
    return keywords.some(keyword => categoryLower.includes(keyword));
  }, []);

  // Calculate yearly income
  const yearlyIncome = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentYearStart = startOfYear(new Date(currentYear, 0, 1));
    const currentYearEnd = endOfYear(new Date(currentYear, 11, 31));
    
    const yearTransactions = transactions.filter(t => {
      const transactionDate = parseISO(t.date);
      return isWithinInterval(transactionDate, { start: currentYearStart, end: currentYearEnd });
    });
    
    return yearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, [transactions]);

  // Calculate total savings
  const totalSavings = useMemo(() => {
    return transactions
      .filter(t => t.category === 'Savings' && t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, [transactions]);

  // Calculate major category totals
  const majorCategories = useMemo(() => {
    const allExpenses = transactions.filter(t => t.type === 'expense');
    const totalExpenses = allExpenses.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    return Object.keys(categoryMapping).map(categoryName => {
      const categoryTransactions = allExpenses.filter(t => 
        matchesCategory(t.category, categoryName)
      );
      
      const total = categoryTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;

      let icon = Home;
      if (categoryName === 'Food') icon = UtensilsCrossed;
      else if (categoryName === 'Car') icon = Car;
      else if (categoryName === 'Shopping') icon = Wallet;
      else if (categoryName === 'Entertainment') icon = TrendingUp;

      return {
        name: categoryName,
        total,
        percentage,
        transactionCount: categoryTransactions.length,
        icon,
      };
    }).filter(cat => cat.total > 0).sort((a, b) => b.total - a.total); // Sort by total descending
  }, [transactions, matchesCategory]);

  // Calculate chart data for balance over time
  const chartData = useMemo(() => {
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA - dateB;
    });

    if (sortedTransactions.length === 0) return [];

    let runningBalance = initialBalance;
    const monthlyData = {};
    
    // Group transactions by month
    sortedTransactions.forEach(transaction => {
      const date = parseISO(transaction.date);
      const monthKey = format(date, 'yyyy-MM');
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          monthKey: monthKey,
          month: format(date, 'MMM yyyy'),
          income: 0,
          expenses: 0,
          balance: runningBalance,
        };
      }
      
      if (transaction.type === 'income') {
        monthlyData[monthKey].income += parseFloat(transaction.amount || 0);
        runningBalance += parseFloat(transaction.amount || 0);
      } else {
        monthlyData[monthKey].expenses += parseFloat(transaction.amount || 0);
        runningBalance -= parseFloat(transaction.amount || 0);
      }
      
      monthlyData[monthKey].balance = runningBalance;
    });

    // Convert to array and sort by monthKey (which is sortable)
    return Object.entries(monthlyData)
      .map(([monthKey, item]) => ({
        month: item.month,
        monthKey: monthKey, // Keep for sorting
        balance: item.balance,
        income: item.income,
        expenses: item.expenses,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(({ monthKey, ...rest }) => rest); // Remove monthKey from final data
  }, [transactions, initialBalance]);

  // Get monthly summaries for the year
  const monthlySummaries = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const summaries = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = startOfMonth(new Date(currentYear, month, 1));
      const monthEnd = endOfMonth(monthStart);
      
      const monthTransactions = transactions.filter(t => {
        try {
          const transactionDate = parseISO(t.date);
          if (isNaN(transactionDate.getTime())) return false;
          return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
        } catch (e) {
          return false;
        }
      });
      
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      const net = income - expenses;
      
      summaries.push({
        month: monthStart,
        income,
        expenses,
        net,
        transactionCount: monthTransactions.length,
      });
    }
    
    return summaries;
  }, [transactions]);


  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.category) {
      alert('Please fill in amount and category');
      return;
    }

    const transactionData = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      category: formData.category.trim(),
      description: formData.description.trim() || null,
      date: formData.date,
    };

    try {
      if (editingTransaction) {
        const { error } = await budgetApi.update(editingTransaction.id, transactionData);
        if (error) {
          console.error('Error updating transaction:', error);
          alert('Failed to update transaction');
        } else {
          await loadTransactions();
          resetForm();
        }
      } else {
        const { error } = await budgetApi.create(transactionData);
        if (error) {
          console.error('Error creating transaction:', error);
          alert('Failed to create transaction');
        } else {
          await loadTransactions();
          resetForm();
        }
      }
    } catch (err) {
      console.error('Error saving transaction:', err);
      alert('Failed to save transaction');
    }
  };


  // Reset form
  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setEditingTransaction(null);
    setShowAddForm(false);
  };


  if (loading) {
    return (
      <div className="balance-page loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="balance-page">
      {/* Top Bar - Fixed Header */}
      <div className="balance-topbar glass-card">
        <div className="topbar-left">
          <div className="page-title-section">
            <Wallet size={28} className="title-icon" />
            <div>
              <h1>Balance</h1>
              <p className="page-subtitle">Personal Budget Management</p>
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="period-selector">
            <button
              className={`period-btn ${periodView === 'month' ? 'active' : ''}`}
              onClick={() => setPeriodView('month')}
            >
              <Calendar size={16} />
              This Month
            </button>
            <button
              className={`period-btn ${periodView === 'all' ? 'active' : ''}`}
              onClick={() => setPeriodView('all')}
            >
              All Time
            </button>
          </div>
          <button
            className="btn-primary-add"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
          >
            <Plus size={20} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="balance-dashboard">
        <div className="key-metrics-grid">
          {/* Current Balance Card */}
          <div className="summary-card-large glass-card balance-card">
            <div className="card-header">
              <div className="card-icon-wrapper balance">
                <Wallet size={24} />
              </div>
              <span className="card-label">Balance</span>
            </div>
            <div className="card-value-large positive">
              {summaries.currentBalance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div className="card-footer">
              <span className="card-subtitle">
                {summaries.net >= 0 ? '+' : ''}{summaries.net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € this period
              </span>
            </div>
          </div>

          {/* Yearly Income Card */}
          <div className="summary-card-large glass-card yearly-income-card">
            <div className="card-header">
              <div className="card-icon-wrapper yearly-positive">
                <Euro size={24} />
              </div>
              <span className="card-label">Yearly Income</span>
            </div>
            <div className="card-value-large positive">
              {yearlyIncome.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div className="card-footer">
              <span className="card-subtitle">
                {((yearlyIncome / 12) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € per month avg
              </span>
            </div>
          </div>

          {/* Yearly Increase Card */}
          <div className="summary-card-large glass-card yearly-card">
            <div className="card-header">
              <div className={`card-icon-wrapper ${yearlyIncrease.amount >= 0 ? 'yearly-positive' : 'yearly-negative'}`}>
                {yearlyIncrease.amount >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              </div>
              <span className="card-label">Yearly Increase</span>
            </div>
            <div className={`card-value-large ${yearlyIncrease.amount >= 0 ? 'positive' : 'negative'}`}>
              {yearlyIncrease.amount >= 0 ? '+' : ''}{yearlyIncrease.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div className="card-footer">
              <span className="card-subtitle">
                {yearlyIncrease.percent >= 0 ? '+' : ''}{yearlyIncrease.percent.toFixed(1)}% vs last year
              </span>
            </div>
          </div>

          {/* Savings Card */}
          <div className="summary-card-large glass-card savings-card">
            <div className="card-header">
              <div className="card-icon-wrapper savings">
                <PiggyBank size={24} />
              </div>
              <span className="card-label">Savings</span>
            </div>
            <div className="card-value-large positive">
              {totalSavings.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div className="card-footer">
              <span className="card-subtitle">
                Total saved
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="monthly-overview-section glass-card">
        <h2 className="section-title">Year Overview - {new Date().getFullYear()}</h2>
        <div className="month-bars">
          {monthlySummaries.map((summary, idx) => {
            const maxNet = Math.max(...monthlySummaries.map(s => Math.abs(s.net)), 1);
            const barHeight = Math.min(Math.abs(summary.net) / maxNet * 100, 100);
            const isCurrentMonth = format(summary.month, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
            
            return (
              <div 
                key={idx} 
                className={`month-bar-container ${isCurrentMonth ? 'selected' : ''}`}
                title={`${format(summary.month, 'MMMM')}: ${summary.net >= 0 ? '+' : ''}${summary.net.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
              >
                <div className="bar-wrapper">
                  <div 
                    className={`bar ${summary.net >= 0 ? 'positive' : 'negative'}`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="month-label">{format(summary.month, 'MMM')}</span>
                {summary.transactionCount > 0 && (
                  <span className={`month-net ${summary.net >= 0 ? 'positive' : 'negative'}`}>
                    {summary.net >= 0 ? '+' : ''}{summary.net.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Balance Chart */}
      {chartData.length > 0 && (
        <div className="balance-chart-section glass-card">
          <h2 className="section-title">Balance Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 211, 238, 0.2)" />
              <XAxis 
                dataKey="month" 
                stroke="var(--text-muted)"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                stroke="var(--text-muted)"
                style={{ fontSize: '0.75rem' }}
                tickFormatter={(value) => `${value.toLocaleString('de-DE')} €`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid rgba(34, 211, 238, 0.18)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
                formatter={(value) => [`${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 'Balance']}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="var(--accent-primary)" 
                strokeWidth={2}
                fill="url(#balanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Major Categories Section */}
      {majorCategories.length > 0 && (
        <div className="major-categories-section">
          <h2 className="section-title">Major Expense Categories</h2>
          <div className="categories-grid">
            {majorCategories.map((category) => {
              const IconComponent = category.icon;
              return (
                <div key={category.name} className="category-card glass-card">
                  <div className="category-header">
                    <div className="category-icon-wrapper">
                      <IconComponent size={20} />
                    </div>
                    <span className="category-name">{category.name}</span>
                  </div>
                  <div className="category-value">
                    {category.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </div>
                  <div className="category-footer">
                    <div className="category-stats">
                      <span className="category-percentage">{category.percentage.toFixed(1)}% of expenses</span>
                      <span className="category-count">{category.transactionCount} transactions</span>
                    </div>
                    <div className="category-progress-bar">
                      <div 
                        className="category-progress-fill" 
                        style={{ width: `${Math.min(category.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="form-modal-overlay" onClick={resetForm}>
          <div className="form-modal glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <Wallet size={24} />
                <h3>{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</h3>
              </div>
              <button className="btn-close-modal" onClick={resetForm}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="transaction-form">
              <div className="form-group">
                <label className="form-label">Type</label>
                <div className="type-toggle-large">
                  <button
                    type="button"
                    className={`toggle-option expense ${formData.type === 'expense' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))}
                  >
                    <ArrowDown size={20} />
                    <span>Expense</span>
                  </button>
                  <button
                    type="button"
                    className={`toggle-option income ${formData.type === 'income' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, type: 'income' }))}
                  >
                    <ArrowUp size={20} />
                    <span>Income</span>
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group form-group-large">
                  <label htmlFor="amount" className="form-label">Amount *</label>
                  <div className="amount-input-wrapper">
                    <Euro size={20} className="amount-icon" />
                    <input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                      placeholder="0.00"
                      className="amount-input"
                    />
                  </div>
                </div>

                <div className="form-group form-group-large">
                  <label htmlFor="date" className="form-label">Date *</label>
                  <div className="date-input-wrapper">
                    <Calendar size={20} className="date-icon" />
                    <input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      required
                      className="date-input"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="category" className="form-label">Category *</label>
                <input
                  id="category"
                  type="text"
                  list="categories-list"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  required
                  placeholder="e.g., Food, Rent, Salary"
                  className="category-input"
                />
                <datalist id="categories-list">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label htmlFor="description" className="form-label">Description</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional notes about this transaction"
                  rows="3"
                  className="description-input"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-submit">
                  {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Balance;
