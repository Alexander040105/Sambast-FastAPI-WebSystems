// Mock driver data - replace with BE-B T3 API: GET /api/v1/drivers
export const mockDrivers = [
  {
    id: 1,
    user_id: 101,
    license_no: 'DL-2024-001234',
    status: 'active',
    home_location_id: 1,
    created_at: '2024-01-15T08:30:00Z',
    user: {
      id: 101,
      email: 'carlos.mendoza@sambast.ph',
      name: 'Carlos Mendoza',
      phone: '09171234567',
      role: 'driver',
      is_active: true,
    },
  },
  {
    id: 2,
    user_id: 102,
    license_no: 'DL-2024-001235',
    status: 'active',
    home_location_id: 2,
    created_at: '2024-01-20T09:00:00Z',
    user: {
      id: 102,
      email: 'juan.delacruz@sambast.ph',
      name: 'Juan Dela Cruz',
      phone: '09182345678',
      role: 'driver',
      is_active: true,
    },
  },
  {
    id: 3,
    user_id: 103,
    license_no: 'DL-2024-001236',
    status: 'off_duty',
    home_location_id: 3,
    created_at: '2024-02-01T10:15:00Z',
    user: {
      id: 103,
      email: 'pedro.santos@sambast.ph',
      name: 'Pedro Santos',
      phone: '09193456789',
      role: 'driver',
      is_active: true,
    },
  },
  {
    id: 4,
    user_id: 104,
    license_no: 'DL-2024-001237',
    status: 'active',
    home_location_id: 1,
    created_at: '2024-02-10T08:00:00Z',
    user: {
      id: 104,
      email: 'roberto.garcia@sambast.ph',
      name: 'Roberto Garcia',
      phone: '09204567890',
      role: 'driver',
      is_active: true,
    },
  },
  {
    id: 5,
    user_id: 105,
    license_no: 'DL-2024-001238',
    status: 'suspended',
    home_location_id: 2,
    created_at: '2024-02-15T14:30:00Z',
    user: {
      id: 105,
      email: 'miguel.lopez@sambast.ph',
      name: 'Miguel Lopez',
      phone: '09215678901',
      role: 'driver',
      is_active: false,
    },
  },
];

// Simulated API delay
export async function fetchDrivers() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...mockDrivers];
}

export async function fetchDriverById(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const driver = mockDrivers.find((d) => d.id === id);
  if (!driver) throw new Error('Driver not found');
  return { ...driver };
}

export async function createDriver(data) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const newDriver = {
    id: Math.max(...mockDrivers.map((d) => d.id)) + 1,
    user_id: data.user_id || mockDrivers.length + 100,
    license_no: data.license_no,
    status: data.status || 'active',
    home_location_id: data.home_location_id || 1,
    created_at: new Date().toISOString(),
    user: {
      id: data.user_id || mockDrivers.length + 100,
      email: data.email,
      name: data.name,
      phone: data.phone,
      role: 'driver',
      is_active: true,
    },
  };
  mockDrivers.push(newDriver);
  return { ...newDriver };
}

export async function updateDriver(id, data) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const index = mockDrivers.findIndex((d) => d.id === id);
  if (index === -1) throw new Error('Driver not found');
  mockDrivers[index] = { ...mockDrivers[index], ...data };
  if (data.user) {
    mockDrivers[index].user = { ...mockDrivers[index].user, ...data.user };
  }
  return { ...mockDrivers[index] };
}

export async function deleteDriver(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = mockDrivers.findIndex((d) => d.id === id);
  if (index === -1) throw new Error('Driver not found');
  mockDrivers.splice(index, 1);
  return { success: true };
}