// Mock shift data - replace with BE-B T3 API: GET /api/v1/shifts
export const mockShifts = [
  {
    id: 1,
    driver_id: 1,
    vehicle_id: 1,
    starts_at: '2024-12-15T06:00:00Z',
    ends_at: '2024-12-15T14:00:00Z',
    status: 'scheduled',
    created_at: '2024-12-10T08:00:00Z',
    driver: {
      id: 1,
      user: { name: 'Carlos Mendoza', phone: '09171234567' },
      license_no: 'DL-2024-001234',
    },
    vehicle: {
      id: 1,
      plate_no: 'ABC-1234',
      type: 'van',
      max_weight_kg: 1500,
    },
  },
  {
    id: 2,
    driver_id: 2,
    vehicle_id: 2,
    starts_at: '2024-12-15T06:00:00Z',
    ends_at: '2024-12-15T14:00:00Z',
    status: 'active',
    created_at: '2024-12-10T08:05:00Z',
    driver: {
      id: 2,
      user: { name: 'Juan Dela Cruz', phone: '09182345678' },
      license_no: 'DL-2024-001235',
    },
    vehicle: {
      id: 2,
      plate_no: 'XYZ-5678',
      type: 'truck',
      max_weight_kg: 5000,
    },
  },
  {
    id: 3,
    driver_id: 3,
    vehicle_id: 3,
    starts_at: '2024-12-15T14:00:00Z',
    ends_at: '2024-12-15T22:00:00Z',
    status: 'scheduled',
    created_at: '2024-12-10T08:10:00Z',
    driver: {
      id: 3,
      user: { name: 'Pedro Santos', phone: '09193456789' },
      license_no: 'DL-2024-001236',
    },
    vehicle: {
      id: 3,
      plate_no: 'DEF-9012',
      type: 'van',
      max_weight_kg: 1200,
    },
  },
  {
    id: 4,
    driver_id: 4,
    vehicle_id: 4,
    starts_at: '2024-12-15T06:00:00Z',
    ends_at: '2024-12-15T14:00:00Z',
    status: 'completed',
    created_at: '2024-12-10T08:15:00Z',
    driver: {
      id: 4,
      user: { name: 'Roberto Garcia', phone: '09204567890' },
      license_no: 'DL-2024-001237',
    },
    vehicle: {
      id: 4,
      plate_no: 'GHI-3456',
      type: 'motorcycle',
      max_weight_kg: 200,
    },
  },
];

export async function fetchShifts() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...mockShifts];
}

export async function fetchShiftById(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const shift = mockShifts.find((s) => s.id === id);
  if (!shift) throw new Error('Shift not found');
  return { ...shift };
}

export async function createShift(data) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const newShift = {
    id: Math.max(...mockShifts.map((s) => s.id)) + 1,
    driver_id: Number(data.driver_id),
    vehicle_id: Number(data.vehicle_id),
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    status: data.status || 'scheduled',
    created_at: new Date().toISOString(),
    driver: mockShifts.find((s) => s.driver_id === Number(data.driver_id))?.driver || null,
    vehicle: mockShifts.find((s) => s.vehicle_id === Number(data.vehicle_id))?.vehicle || null,
  };
  mockShifts.push(newShift);
  return { ...newShift };
}

export async function updateShift(id, data) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const index = mockShifts.findIndex((s) => s.id === id);
  if (index === -1) throw new Error('Shift not found');
  mockShifts[index] = { ...mockShifts[index], ...data };
  return { ...mockShifts[index] };
}

export async function deleteShift(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = mockShifts.findIndex((s) => s.id === id);
  if (index === -1) throw new Error('Shift not found');
  mockShifts.splice(index, 1);
  return { success: true };
}