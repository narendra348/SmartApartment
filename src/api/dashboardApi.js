import client from './client';

/**
 * Dashboard API Service
 * Centralizes all dashboard metrics and statistics requests.
 * Uses real backend endpoints without fake sample fallbacks.
 */

/**
 * Fetch super admin dashboard metrics
 * Expected backend endpoint: GET /dashboard/super-admin
 */
export async function getSuperAdminDashboardData() {
  const response = await client.get('/dashboard/super-admin');
  return response.data?.data ?? response.data;
}

/**
 * Fetch apartment admin dashboard metrics
 * Expected backend endpoint: GET /dashboard/admin
 */
export async function getAdminDashboardData() {
  const response = await client.get('/dashboard/admin');
  return response.data?.data ?? response.data;
}

/**
 * Fetch authenticated resident dashboard metrics
 * Expected backend endpoint: GET /dashboard/resident
 */
export async function getResidentDashboardData() {
  const response = await client.get('/dashboard/resident');
  return response.data?.data ?? response.data;
}

/**
 * Fetch maintenance staff dashboard metrics
 * Expected backend endpoint: GET /dashboard/staff
 */
export async function getStaffDashboardData() {
  const response = await client.get('/dashboard/staff');
  return response.data?.data ?? response.data;
}
