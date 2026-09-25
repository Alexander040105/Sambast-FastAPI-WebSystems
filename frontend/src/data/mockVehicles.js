// Mock vehicle data - replace with BE-B T3 API: GET /api/v1/vehicles
export const mockVehicles = [
  {
    id: 1,
    plate_no: 'ABC-1234',
    type: 'van',
    max_weight_kg: 1500,
    max_volume_m3: 12,
    is_active: true,
    created_at: '2024-01-10T08:00:00Z',
  },
  {
    id: 2,
    plate_no: 'XYZ-5678',
    type: 'truck',
    max_weight_kg: 5000,
    max_volume_m3: 35,
    is_active: true,
    created_at: '2024-01-12T09:30:00Z',
  },
  {
    id: 3,
    plate_no: 'DEF-9012',
    type: 'van',
    max_weight_kg: 1200,
    max_volume_m3: 10,
    is_active: true,
    created_at: '2024-01-25T10:00:00Z',
  },
  {
    id: 4,
    plate_no: 'GHI-3456',
    type: 'motorcycle',
    max_weight_kg: 200,
    max_volume_m3: 1.5,
    is_active: true,
    created_at: '2024-02-05T08:45:00Z',
  },
  {
    id: 5,
    plate_no: 'JKL-7890',
    type: 'truck',
    max_weight_kg: 8000,
    max_volume_m3: 50,
    is_active: false,
    created_at: '2024-02-12T11:20:00Z',
  },
];

export async function fetchVehicles() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...mockVehicles];
}

export async function fetchVehicleById(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const vehicle = mockVehicles.find((v) => v.id === id);
  if (!vehicle) throw new Error('Vehicle not found');
  return { ...vehicle };
}

export async function createVehicle(data) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const newVehicle = {
    id: Math.max(...mockVehicles.map((v) => v.id)) + 1,
    plate_no: data.plate_no,
    type: data.type,
    max_weight_kg: Number(data.max_weight_kg),
    max_volume_m3: Number(data.max_volume_m3),
    is_active: data.is_active !== false,
    created_at: new Date().toISOString(),
  };
  mockVehicles.push(newVehicle);
  return { ...newVehicle };
}

export async function updateVehicle(id, data) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const index = mockVehicles.findIndex((v) => v.id === id);
  if (index === -1) throw new Error('Vehicle not found');
  mockVehicles[index] = { ...mockVehicles[index], ...data };
  return { ...mockVehicles[index] };
}

export async function deleteVehicle(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = mockVehicles.findIndex((v) => v.id === id);
  if (index === -1) throw new Error('Vehicle not found');
  mockVehicles.splice(index, 1);
  return { success: true };
}