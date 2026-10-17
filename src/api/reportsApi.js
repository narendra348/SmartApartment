/**
 * reportsApi.js
 *
 * Dedicated API service for Financial & Operational Reports:
 * - Collections Report (Verified maintenance receipts & trends)
 * - Outstanding Bills Report (Unpaid balances, overdue accounts, building breakdowns)
 * - Expenses Report (Categorized expenditures & trends)
 *
 * Connects directly to backend endpoints using the centralized Axios client.
 * Does not fabricate financial data or production statistics.
 */

import client from './client';

/**
 * Clean parameters object by stripping empty, undefined, or 'all' values.
 */
function cleanParams(params = {}) {
  return Object.entries(params).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') {
      acc[k] = v;
    }
    return acc;
  }, {});
}

/**
 * Fetch Collections Report.
 *
 * @param {object} params - { startDate, endDate, buildingId, period }
 * @returns {Promise<{
 *   totalCollected: number,
 *   verifiedCount: number,
 *   pendingCount: number,
 *   items: Array,
 *   collectionsByPeriod: Array,
 *   collectionsByBuilding: Array,
 *   trends: Array
 * }>}
 */
export async function getCollectionsReport(params = {}) {
  const query = cleanParams(params);

  try {
    const response = await client.get('/admin/reports/collections', { params: query });
    const data = response.data?.data ?? response.data;

    const items = data.items || data.payments || data.records || [];
    const totalCollected =
      data.totalCollected ??
      data.totalAmount ??
      items.reduce((sum, p) => (p.status === 'verified' ? sum + Number(p.amount || 0) : sum), 0);

    const verifiedCount =
      data.verifiedCount ??
      items.filter((p) => p.status === 'verified').length;

    const pendingCount =
      data.pendingCount ??
      items.filter((p) => p.status === 'pending').length;

    return {
      totalCollected: Number(totalCollected) || 0,
      verifiedCount: Number(verifiedCount) || 0,
      pendingCount: Number(pendingCount) || 0,
      items: Array.isArray(items) ? items : [],
      collectionsByPeriod: data.collectionsByPeriod || data.byPeriod || [],
      collectionsByBuilding: data.collectionsByBuilding || data.byBuilding || [],
      trends: data.trends || data.collectionTrends || [],
    };
  } catch (err) {
    // If specialized report endpoint is not mounted, attempt aggregation from verified payments
    if (err.response?.status === 404) {
      try {
        const paymentsRes = await client.get('/admin/payments', {
          params: { ...query, limit: 100 },
        });
        const pData = paymentsRes.data?.data ?? paymentsRes.data;
        const allPayments = Array.isArray(pData)
          ? pData
          : pData.payments || pData.items || [];

        const verified = allPayments.filter((p) => p.status === 'verified');
        const pending = allPayments.filter((p) => p.status === 'pending');
        const totalCollected = verified.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        // Group by period (month)
        const periodMap = {};
        verified.forEach((p) => {
          const dateStr = p.paymentDate || p.createdAt;
          const monthKey = dateStr
            ? new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
            : 'Unknown';
          periodMap[monthKey] = (periodMap[monthKey] || 0) + Number(p.amount || 0);
        });

        const collectionsByPeriod = Object.entries(periodMap).map(([period, amount]) => ({
          period,
          amount,
        }));

        // Group by building
        const buildingMap = {};
        verified.forEach((p) => {
          const bName =
            p.buildingName ||
            p.flat?.building?.name ||
            p.building?.name ||
            'General';
          buildingMap[bName] = (buildingMap[bName] || 0) + Number(p.amount || 0);
        });

        const collectionsByBuilding = Object.entries(buildingMap).map(([buildingName, amount]) => ({
          buildingName,
          amount,
        }));

        return {
          totalCollected,
          verifiedCount: verified.length,
          pendingCount: pending.length,
          items: verified,
          collectionsByPeriod,
          collectionsByBuilding,
          trends: collectionsByPeriod,
        };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Fetch Outstanding Bills Report.
 *
 * @param {object} params - { startDate, endDate, buildingId, status }
 * @returns {Promise<{
 *   totalOutstanding: number,
 *   outstandingBillsCount: number,
 *   overdueCount: number,
 *   overdueAmount: number,
 *   items: Array,
 *   outstandingByBuilding: Array,
 *   outstandingByPeriod: Array
 * }>}
 */
export async function getOutstandingReport(params = {}) {
  const query = cleanParams(params);

  try {
    const response = await client.get('/admin/reports/outstanding', { params: query });
    const data = response.data?.data ?? response.data;

    const items = data.items || data.bills || data.records || [];
    const totalOutstanding =
      data.totalOutstanding ??
      data.totalAmount ??
      items.reduce((sum, b) => sum + Number(b.amount || b.totalAmount || 0), 0);

    const outstandingBillsCount = data.outstandingBillsCount ?? items.length;
    const overdueCount =
      data.overdueCount ??
      items.filter((b) => b.isOverdue || b.status === 'overdue').length;

    const overdueAmount =
      data.overdueAmount ??
      items
        .filter((b) => b.isOverdue || b.status === 'overdue')
        .reduce((sum, b) => sum + Number(b.amount || 0), 0);

    return {
      totalOutstanding: Number(totalOutstanding) || 0,
      outstandingBillsCount: Number(outstandingBillsCount) || 0,
      overdueCount: Number(overdueCount) || 0,
      overdueAmount: Number(overdueAmount) || 0,
      items: Array.isArray(items) ? items : [],
      outstandingByBuilding: data.outstandingByBuilding || data.byBuilding || [],
      outstandingByPeriod: data.outstandingByPeriod || data.byPeriod || [],
    };
  } catch (err) {
    if (err.response?.status === 404) {
      try {
        const billsRes = await client.get('/admin/bills', {
          params: { ...query, status: 'unpaid', limit: 100 },
        });
        const bData = billsRes.data?.data ?? billsRes.data;
        const allBills = Array.isArray(bData)
          ? bData
          : bData.bills || bData.items || [];

        const now = new Date();
        let totalOutstanding = 0;
        let overdueCount = 0;
        let overdueAmount = 0;

        const periodMap = {};
        const buildingMap = {};

        allBills.forEach((b) => {
          const amt = Number(b.amount || b.totalAmount || 0);
          totalOutstanding += amt;

          const isOverdue =
            b.status === 'overdue' || (b.dueDate && new Date(b.dueDate) < now);
          if (isOverdue) {
            overdueCount += 1;
            overdueAmount += amt;
          }

          const period = b.billingPeriod || b.month || 'Current';
          periodMap[period] = (periodMap[period] || 0) + amt;

          const bName =
            b.buildingName ||
            b.flat?.building?.name ||
            b.building?.name ||
            'Building';
          buildingMap[bName] = (buildingMap[bName] || 0) + amt;
        });

        return {
          totalOutstanding,
          outstandingBillsCount: allBills.length,
          overdueCount,
          overdueAmount,
          items: allBills,
          outstandingByBuilding: Object.entries(buildingMap).map(([buildingName, amount]) => ({
            buildingName,
            amount,
          })),
          outstandingByPeriod: Object.entries(periodMap).map(([period, amount]) => ({
            period,
            amount,
          })),
        };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Fetch Expenses Report.
 *
 * @param {object} params - { startDate, endDate, buildingId, category }
 * @returns {Promise<{
 *   totalExpenses: number,
 *   expenseCount: number,
 *   items: Array,
 *   expensesByCategory: Array,
 *   trends: Array
 * }>}
 */
export async function getExpensesReport(params = {}) {
  const query = cleanParams(params);

  try {
    const response = await client.get('/admin/reports/expenses', { params: query });
    const data = response.data?.data ?? response.data;

    const items = data.items || data.expenses || data.records || [];
    const totalExpenses =
      data.totalExpenses ??
      data.totalAmount ??
      items.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      totalExpenses: Number(totalExpenses) || 0,
      expenseCount: data.expenseCount ?? items.length,
      items: Array.isArray(items) ? items : [],
      expensesByCategory: data.expensesByCategory || data.byCategory || [],
      trends: data.trends || data.monthlyTrends || [],
    };
  } catch (err) {
    if (err.response?.status === 404) {
      try {
        const expensesRes = await client.get('/admin/expenses', {
          params: { ...query, limit: 100 },
        });
        const eData = expensesRes.data?.data ?? expensesRes.data;
        const allExpenses = Array.isArray(eData)
          ? eData
          : eData.expenses || eData.items || [];

        let totalExpenses = 0;
        const catMap = {};
        const periodMap = {};

        allExpenses.forEach((e) => {
          const amt = Number(e.amount || 0);
          totalExpenses += amt;

          const cat = e.category || 'General';
          catMap[cat] = (catMap[cat] || 0) + amt;

          const dateStr = e.date || e.createdAt;
          const monthKey = dateStr
            ? new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
            : 'Unknown';
          periodMap[monthKey] = (periodMap[monthKey] || 0) + amt;
        });

        return {
          totalExpenses,
          expenseCount: allExpenses.length,
          items: allExpenses,
          expensesByCategory: Object.entries(catMap).map(([category, amount]) => ({
            category,
            amount,
          })),
          trends: Object.entries(periodMap).map(([period, amount]) => ({
            period,
            amount,
          })),
        };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}
